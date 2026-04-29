CREATE OR REPLACE FUNCTION public.redeem_voucher(
    p_qr_value text, 
    p_service_kind text, 
    p_context_id uuid DEFAULT NULL,
    p_is_offline boolean DEFAULT false,
    p_offline_at timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_voucher public.service_vouchers%ROWTYPE;
    v_caller uuid := auth.uid();
    v_allowed boolean;
    v_person_name text;
    v_event_id uuid;
    v_prev_usage record;
    v_reference_time timestamp with time zone;
    v_metadata jsonb := '{}'::jsonb;
BEGIN
    -- Define tempo de referência: instante real da leitura (se offline) ou agora (se online)
    v_reference_time := COALESCE(p_offline_at, now());

    IF p_service_kind NOT IN ('transport','meals','lodging') THEN
        RAISE EXCEPTION 'service_kind inválido' USING ERRCODE = '22023';
    END IF;

    -- Valida perfil do chamador conforme o serviço
    v_allowed := CASE p_service_kind
        WHEN 'transport' THEN public.has_role(v_caller,'transporte') OR public.has_role(v_caller,'admin') OR public.has_role(v_caller,'secretaria') OR public.has_role(v_caller,'super_admin')
        WHEN 'meals'     THEN public.has_role(v_caller,'alimentacao') OR public.has_role(v_caller,'admin') OR public.has_role(v_caller,'secretaria') OR public.has_role(v_caller,'super_admin')
        WHEN 'lodging'   THEN public.has_role(v_caller,'alojamento') OR public.has_role(v_caller,'admin') OR public.has_role(v_caller,'secretaria') OR public.has_role(v_caller,'super_admin')
    END;
    
    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Sem permissão para validar este serviço' USING ERRCODE = '42501';
    END IF;

    -- Lock pessimista do voucher
    SELECT * INTO v_voucher FROM public.service_vouchers
    WHERE qr_code_value = p_qr_value FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.service_voucher_attempts (qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at)
        VALUES (p_qr_value, p_service_kind, p_context_id, 'refused', 'not_found', v_caller, p_is_offline, p_offline_at);
        RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;

    v_event_id := v_voucher.event_id;

    -- 1. Verificar status
    IF v_voucher.status <> 'active' THEN
        v_metadata := jsonb_build_object('status', v_voucher.status);
        -- Se revogado, tenta pegar o motivo
        IF v_voucher.status = 'revoked' THEN
            v_metadata := v_metadata || jsonb_build_object(
                'revocation_reason', v_voucher.revoke_reason
            );
        END IF;

        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at, metadata)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'inactive', v_caller, p_is_offline, p_offline_at, v_metadata);
        
        RETURN jsonb_build_object('ok', false, 'reason', 'inactive') || v_metadata;
    END IF;

    -- 2. Verificar validade temporal (AGORA USANDO v_reference_time)
    IF v_voucher.valid_until IS NOT NULL AND v_voucher.valid_until < v_reference_time THEN
        v_metadata := jsonb_build_object('valid_until', v_voucher.valid_until);
        
        -- Só marca como expirado se a leitura for online ou se o tempo atual já passou (independente de quando foi lido)
        IF now() > v_voucher.valid_until THEN
            UPDATE public.service_vouchers SET status='expired' WHERE id = v_voucher.id;
        END IF;

        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at, metadata)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'expired', v_caller, p_is_offline, p_offline_at, v_metadata);
        
        RETURN jsonb_build_object('ok', false, 'reason', 'expired') || v_metadata;
    END IF;
    
    IF v_voucher.valid_from > v_reference_time THEN
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'not_yet_valid', v_caller, p_is_offline, p_offline_at);
        RETURN jsonb_build_object('ok', false, 'reason', 'not_yet_valid');
    END IF;

    -- 3. Verificar escopo
    IF (p_service_kind = 'transport' AND NOT v_voucher.scope_transport)
       OR (p_service_kind = 'meals'   AND NOT v_voucher.scope_meals)
       OR (p_service_kind = 'lodging' AND NOT v_voucher.scope_lodging) THEN
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'scope_denied', v_caller, p_is_offline, p_offline_at);
        RETURN jsonb_build_object('ok', false, 'reason', 'scope_denied');
    END IF;

    -- 4. Verificar INSTÂNCIA
    IF (p_service_kind = 'meals' AND v_voucher.target_meal_window_id IS NOT NULL AND v_voucher.target_meal_window_id <> p_context_id)
       OR (p_service_kind = 'transport' AND v_voucher.target_trip_id IS NOT NULL AND v_voucher.target_trip_id <> p_context_id)
       OR (p_service_kind = 'lodging' AND v_voucher.target_facility_id IS NOT NULL AND v_voucher.target_facility_id <> p_context_id) THEN
        
        v_metadata := jsonb_build_object(
            'correct_instance', COALESCE(v_voucher.target_meal_window_id::text, v_voucher.target_trip_id::text, v_voucher.target_facility_id::text),
            'attempted_instance', p_context_id::text
        );

        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at, metadata)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'wrong_instance', v_caller, p_is_offline, p_offline_at, v_metadata);
        
        RETURN jsonb_build_object('ok', false, 'reason', 'wrong_instance') || v_metadata;
    END IF;

    -- 5. Verificar consumo prévio (Double Check)
    IF v_voucher.voucher_type = 'nominal' THEN
        SELECT u.used_at, p.full_name INTO v_prev_usage
        FROM public.service_voucher_uses u
        JOIN public.profiles p ON p.id = u.used_by
        WHERE u.voucher_id = v_voucher.id
          AND u.service_kind = p_service_kind
          AND u.context_id = p_context_id
        LIMIT 1;

        IF FOUND THEN
            v_metadata := jsonb_build_object(
                'used_at', v_prev_usage.used_at,
                'operator_name', v_prev_usage.full_name
            );

            INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at, metadata)
            VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'already_used_here', v_caller, p_is_offline, p_offline_at, v_metadata);
            
            RETURN jsonb_build_object('ok', false, 'reason', 'already_used_here') || v_metadata;
        END IF;
    END IF;

    -- 6. Efetivar consumo
    INSERT INTO public.service_voucher_uses (voucher_id, service_kind, context_id, used_by, used_at)
    VALUES (v_voucher.id, p_service_kind, p_context_id, v_caller, v_reference_time);

    -- 7. Registrar tentativa de sucesso
    INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at)
    VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'success', NULL, v_caller, p_is_offline, p_offline_at);

    -- 8. Resolver nome para retorno
    IF v_voucher.is_nominal THEN
        SELECT full_name INTO v_person_name FROM public.service_eventual_people WHERE id = v_voucher.eventual_person_id;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'voucher_type', v_voucher.voucher_type,
        'person_name', v_person_name,
        'label', v_voucher.label,
        'used_at', v_reference_time
    );

END;
$$;