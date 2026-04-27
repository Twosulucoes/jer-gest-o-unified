-- 1. Tabela para registrar tentativas de consumo de voucher (auditoria operacional)
CREATE TABLE IF NOT EXISTS public.service_voucher_attempts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    voucher_id UUID REFERENCES public.service_vouchers(id) ON DELETE SET NULL,
    qr_value TEXT,
    service_kind TEXT NOT NULL,
    context_id UUID,
    outcome TEXT NOT NULL, -- 'success', 'refused'
    reason TEXT, -- 'not_found', 'inactive', 'expired', 'wrong_instance', 'already_used_here', etc.
    attempted_by UUID REFERENCES auth.users(id),
    attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.service_voucher_attempts ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Leitura de tentativas por perfis autorizados"
ON public.service_voucher_attempts FOR SELECT
USING (
    auth.uid() IN (
        SELECT id FROM auth.users 
        WHERE (raw_user_meta_data->>'app_role')::text IN ('admin', 'secretaria', 'super_admin', 'coordenacao_tecnica')
    )
);

-- 2. Atualizar a RPC redeem_voucher
CREATE OR REPLACE FUNCTION public.redeem_voucher(
    p_qr_value text,
    p_service_kind text,
    p_context_id uuid DEFAULT NULL
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
    v_already_used_here boolean;
    v_prev_usage record;
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

    -- 1. Verificar status
    IF v_voucher.status <> 'active' THEN
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'inactive', v_caller);
        RETURN jsonb_build_object('ok', false, 'reason', 'inactive', 'status', v_voucher.status);
    END IF;

    -- 2. Verificar validade temporal
    IF v_voucher.valid_until IS NOT NULL AND v_voucher.valid_until < now() THEN
        UPDATE public.service_vouchers SET status='expired' WHERE id = v_voucher.id;
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'expired', v_caller);
        RETURN jsonb_build_object('ok', false, 'reason', 'expired');
    END IF;
    
    IF v_voucher.valid_from > now() THEN
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'not_yet_valid', v_caller);
        RETURN jsonb_build_object('ok', false, 'reason', 'not_yet_valid');
    END IF;

    -- 3. Verificar escopo (meals/transport/lodging)
    IF (p_service_kind = 'transport' AND NOT v_voucher.scope_transport)
       OR (p_service_kind = 'meals'   AND NOT v_voucher.scope_meals)
       OR (p_service_kind = 'lodging' AND NOT v_voucher.scope_lodging) THEN
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'scope_denied', v_caller);
        RETURN jsonb_build_object('ok', false, 'reason', 'scope_denied');
    END IF;

    -- 4. Verificar INSTÂNCIA (Regra Fase 3)
    -- Se o voucher tem uma instância fixa, ele SÓ pode ser usado nela.
    IF (p_service_kind = 'meals' AND v_voucher.target_meal_window_id IS NOT NULL AND v_voucher.target_meal_window_id <> p_context_id)
       OR (p_service_kind = 'transport' AND v_voucher.target_trip_id IS NOT NULL AND v_voucher.target_trip_id <> p_context_id)
       OR (p_service_kind = 'lodging' AND v_voucher.target_facility_id IS NOT NULL AND v_voucher.target_facility_id <> p_context_id) THEN
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'wrong_instance', v_caller);
        RETURN jsonb_build_object('ok', false, 'reason', 'wrong_instance');
    END IF;

    -- 5. Verificar DUPLO CONSUMO na mesma instância (Regra Fase 3)
    IF p_context_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.service_voucher_uses 
            WHERE voucher_id = v_voucher.id 
            AND service_kind = p_service_kind 
            AND context_id = p_context_id
        ) INTO v_already_used_here;

        IF v_already_used_here THEN
            -- Busca detalhes do uso anterior
            SELECT used_at, display_name as operator_name 
            INTO v_prev_usage
            FROM public.service_voucher_uses vu
            LEFT JOIN public.profiles pr ON pr.id = vu.used_by
            WHERE vu.voucher_id = v_voucher.id AND vu.context_id = p_context_id
            LIMIT 1;

            INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by)
            VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'already_used_here', v_caller);
            
            RETURN jsonb_build_object(
                'ok', false, 
                'reason', 'already_used_here', 
                'used_at', v_prev_usage.used_at,
                'operator_name', v_prev_usage.operator_name
            );
        END IF;
    END IF;

    -- 6. Verificar limite total de usos
    IF v_voucher.max_uses IS NOT NULL AND v_voucher.current_uses >= v_voucher.max_uses THEN
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'max_uses_reached', v_caller);
        RETURN jsonb_build_object('ok', false, 'reason', 'max_uses_reached');
    END IF;

    -- Se chegou aqui, é VÁLIDO.
    -- Registrar consumo
    INSERT INTO public.service_voucher_uses (voucher_id, service_kind, context_id, used_by)
    VALUES (v_voucher.id, p_service_kind, p_context_id, v_caller);

    -- Atualizar contador
    UPDATE public.service_vouchers
    SET current_uses = current_uses + 1
    WHERE id = v_voucher.id;

    -- Registrar tentativa bem-sucedida
    INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, attempted_by)
    VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'success', v_caller);

    -- Identificar portador para resposta (nominal eventual ou participante legado)
    IF v_voucher.is_nominal THEN
        IF v_voucher.eventual_person_id IS NOT NULL THEN
            SELECT full_name INTO v_person_name FROM public.service_eventual_people WHERE id = v_voucher.eventual_person_id;
        ELSIF v_voucher.participant_id IS NOT NULL THEN
            SELECT pe.full_name INTO v_person_name
            FROM public.participants pa
            JOIN public.people pe ON pe.id = pa.person_id
            WHERE pa.id = v_voucher.participant_id;
        END IF;
    ELSE
        v_person_name := v_voucher.label;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'person_name', v_person_name,
        'voucher_type', v_voucher.voucher_type,
        'remaining_uses', CASE WHEN v_voucher.max_uses IS NULL THEN NULL ELSE v_voucher.max_uses - (v_voucher.current_uses + 1) END
    );
END;
$$;
