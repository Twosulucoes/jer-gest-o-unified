CREATE OR REPLACE FUNCTION public.redeem_voucher(p_qr_value text, p_service_kind text, p_context_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_voucher public.service_vouchers%ROWTYPE;
    v_caller uuid := auth.uid();
    v_allowed boolean;
    v_person_name text;
    v_event_id uuid;
BEGIN
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
        INSERT INTO public.service_voucher_attempts (qr_value, service_kind, context_id, outcome, reason, attempted_by)
        VALUES (p_qr_value, p_service_kind, p_context_id, 'refused', 'not_found', v_caller);
        RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;

    v_event_id := v_voucher.event_id;

    -- 1. Verificar validade temporal (Expirado)
    IF v_voucher.valid_until IS NOT NULL AND v_voucher.valid_until < now() THEN
        UPDATE public.service_vouchers SET status='expired' WHERE id = v_voucher.id;
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'expired', v_caller);
        RETURN jsonb_build_object('ok', false, 'reason', 'expired');
    END IF;

    -- 2. Verificar status
    IF v_voucher.status <> 'active' THEN
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'inactive', v_caller);
        RETURN jsonb_build_object('ok', false, 'reason', 'inactive', 'status', v_voucher.status);
    END IF;

    -- 3. Verificar limite de usos
    IF v_voucher.max_uses IS NOT NULL AND v_voucher.current_uses >= v_voucher.max_uses THEN
        UPDATE public.service_vouchers SET status='exhausted' WHERE id = v_voucher.id;
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'max_uses_reached', v_caller);
        RETURN jsonb_build_object('ok', false, 'reason', 'max_uses_reached');
    END IF;

    -- 4. Verificar escopo (meals/transport/lodging)
    IF (p_service_kind = 'transport' AND NOT v_voucher.scope_transport)
       OR (p_service_kind = 'meals'   AND NOT v_voucher.scope_meals)
       OR (p_service_kind = 'lodging' AND NOT v_voucher.scope_lodging) THEN
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'scope_denied', v_caller);
        RETURN jsonb_build_object('ok', false, 'reason', 'scope_denied');
    END IF;

    -- 5. Verificar duplicidade na mesma instância (se aplicável)
    IF p_context_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.service_voucher_attempts 
            WHERE voucher_id = v_voucher.id 
              AND context_id = p_context_id 
              AND outcome = 'accepted'
        ) THEN
            INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by)
            VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'already_used_here', v_caller);
            RETURN jsonb_build_object('ok', false, 'reason', 'already_used_here');
        END IF;
    END IF;

    -- Registrar sucesso
    UPDATE public.service_vouchers 
    SET current_uses = current_uses + 1,
        status = CASE 
            WHEN max_uses IS NOT NULL AND current_uses + 1 >= max_uses THEN 'exhausted' 
            ELSE status 
        END
    WHERE id = v_voucher.id;

    INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, attempted_by)
    VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'accepted', v_caller);

    -- Busca nome para retorno amigável
    SELECT COALESCE(v_voucher.label, p.full_name, ep.full_name, 'Portador de Voucher')
    INTO v_person_name
    FROM (SELECT 1) AS dummy
    LEFT JOIN public.participants p ON p.id = v_voucher.participant_id
    LEFT JOIN public.service_eventual_people ep ON ep.id = v_voucher.eventual_person_id;

    RETURN jsonb_build_object(
        'ok', true,
        'voucher_type', v_voucher.voucher_type,
        'person_name', v_person_name,
        'remaining_uses', CASE WHEN v_voucher.max_uses IS NULL THEN NULL ELSE v_voucher.max_uses - (v_voucher.current_uses + 1) END
    );
END;
$function$;