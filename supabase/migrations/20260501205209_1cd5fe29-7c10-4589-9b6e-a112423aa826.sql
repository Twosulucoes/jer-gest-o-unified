-- 1. Redefinir a função de controle de acesso por etapa
CREATE OR REPLACE FUNCTION public.check_user_stage_access(target_stage_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    IF target_stage_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Admins têm acesso total
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN app_roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.role = 'admin'
    ) INTO is_admin;

    IF is_admin THEN
        RETURN TRUE;
    END IF;

    -- Verifica se o usuário tem atribuição para esta etapa
    RETURN EXISTS (
        SELECT 1 FROM public.user_stage_assignments
        WHERE user_id = auth.uid() AND event_stage_id = target_stage_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 2. Restaurar e Proteger pwa_lodging_checkin
CREATE OR REPLACE FUNCTION public.pwa_lodging_checkin(
    p_device_id TEXT, 
    p_token TEXT, 
    p_location_id UUID, 
    p_unit_id UUID DEFAULT NULL,
    p_mode TEXT DEFAULT 'person_qr'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_person_id UUID;
    v_qr_result JSONB;
    v_occupancy_id UUID;
    v_planned_occupancy RECORD;
    v_divergence_notes TEXT := NULL;
    v_current_stage_id UUID;
    v_loc_stage_id UUID;
    v_participant_gender TEXT;
    v_unit_gender_restriction TEXT;
    v_unit_capacity INTEGER;
    v_current_occupancy_count INTEGER;
    v_planned_unit_name TEXT;
    v_unit_name TEXT;
BEGIN
    -- [VALDAÇÃO DE ETAPA]
    SELECT event_stage_id INTO v_loc_stage_id FROM public.lodging_locations WHERE id = p_location_id;
    IF NOT public.check_user_stage_access(v_loc_stage_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED_STAGE', 'message', 'Você não tem permissão para operar nesta etapa.');
    END IF;

    -- 1. Resolve Person ID
    IF p_mode = 'person_qr' THEN
        v_qr_result := alojamento.resolve_qr(p_token);
        IF NOT (v_qr_result->>'ok')::boolean THEN
            INSERT INTO public.lodging_audit_logs (device_id, user_id, action, location_id, unit_id, success, error_code, error_message, metadata)
            VALUES (p_device_id, auth.uid(), 'checkin', p_location_id, p_unit_id, false, v_qr_result->>'error', 'Token inválido', jsonb_build_object('token', p_token));
            RETURN v_qr_result;
        END IF;
        
        IF v_qr_result->>'qr_type' != 'person' THEN
             RETURN jsonb_build_object('ok', false, 'error', 'NOT_A_PERSON');
        END IF;
        v_person_id := (v_qr_result->>'entity_id')::uuid;
    ELSE
        v_person_id := p_token::uuid;
    END IF;

    -- 2. Basic Validations
    SELECT p.gender INTO v_participant_gender
    FROM public.people p
    JOIN public.participants prt ON prt.person_id = p.id
    WHERE prt.id = v_person_id AND prt.status = 'active';

    IF v_participant_gender IS NULL THEN
        INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, unit_id, success, error_code, error_message)
        VALUES (p_device_id, auth.uid(), 'checkin', v_person_id, p_location_id, p_unit_id, false, 'PARTICIPANT_NOT_FOUND', 'Participante não encontrado ou inativo');
        RETURN jsonb_build_object('ok', false, 'error', 'PARTICIPANT_NOT_FOUND');
    END IF;

    -- 3. Unit Validations
    IF p_unit_id IS NOT NULL THEN
        SELECT gender_restriction, capacity, name INTO v_unit_gender_restriction, v_unit_capacity, v_unit_name
        FROM public.lodging_units WHERE id = p_unit_id;

        IF v_unit_gender_restriction IS NOT NULL AND v_unit_gender_restriction != 'mixed' AND v_unit_gender_restriction != v_participant_gender THEN
            RETURN jsonb_build_object('ok', false, 'error', 'GENDER_MISMATCH', 'message', 'Gênero incompatível com a unidade');
        END IF;

        IF v_unit_capacity IS NOT NULL AND v_unit_capacity > 0 THEN
            SELECT COUNT(*) INTO v_current_occupancy_count
            FROM public.lodging_occupancies
            WHERE (unit_id = p_unit_id OR checked_in_unit_id = p_unit_id)
              AND status = 'checked_in'
              AND participant_id != v_person_id;

            IF v_current_occupancy_count >= v_unit_capacity THEN
                RETURN jsonb_build_object('ok', false, 'error', 'UNIT_FULL', 'message', 'Esta unidade já atingiu a capacidade máxima.');
            END IF;
        END IF;
    END IF;

    -- 4. Find current stage for the participant
    SELECT stage_id INTO v_current_stage_id 
    FROM public.participant_event_stages 
    WHERE participant_id = v_person_id 
    ORDER BY created_at DESC LIMIT 1;

    -- 5. Check if already checked in
    IF EXISTS (
        SELECT 1 FROM public.lodging_occupancies 
        WHERE participant_id = v_person_id AND status = 'checked_in'
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_CHECKED_IN');
    END IF;

    -- 6. Handle Planned vs Unplanned
    SELECT lo.*, lu.name as unit_name INTO v_planned_occupancy 
    FROM public.lodging_occupancies lo
    LEFT JOIN public.lodging_units lu ON lu.id = lo.unit_id
    WHERE lo.participant_id = v_person_id 
      AND lo.status = 'planned'
    LIMIT 1;

    IF v_planned_occupancy.id IS NOT NULL THEN
        IF p_unit_id IS NOT NULL AND v_planned_occupancy.unit_id != p_unit_id THEN
            v_divergence_notes := 'Divergência: Alocação planejada na Unidade [' || v_planned_occupancy.unit_name || '], mas check-in realizado na Unidade [' || v_unit_name || ']';
        END IF;

        UPDATE public.lodging_occupancies SET
            status = 'checked_in',
            checked_in_at = now(),
            checked_in_by = auth.uid(),
            checked_in_device_id = p_device_id,
            checked_in_location_id = p_location_id,
            checked_in_unit_id = p_unit_id,
            divergence_notes = v_divergence_notes,
            updated_at = now()
        WHERE id = v_planned_occupancy.id;
        v_occupancy_id := v_planned_occupancy.id;
    ELSE
        INSERT INTO public.lodging_occupancies (
            participant_id, unit_id, event_stage_id, status, 
            checked_in_at, checked_in_by, checked_in_device_id, 
            checked_in_location_id, checked_in_unit_id, divergence_notes
        )
        VALUES (
            v_person_id, p_unit_id, v_current_stage_id, 'checked_in',
            now(), auth.uid(), p_device_id,
            p_location_id, p_unit_id, 'Check-in não planejado'
        )
        RETURNING id INTO v_occupancy_id;
    END IF;

    -- 7. Log Success
    INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, unit_id, success, metadata)
    VALUES (p_device_id, auth.uid(), 'checkin', v_person_id, p_location_id, p_unit_id, true, jsonb_build_object('occupancy_id', v_occupancy_id, 'divergence', v_divergence_notes));

    RETURN jsonb_build_object('ok', true, 'occupancy_id', v_occupancy_id, 'divergence', v_divergence_notes, 'planned_unit_name', v_planned_occupancy.unit_name, 'actual_unit_name', v_unit_name);
END;
$$;

-- 3. Restaurar e Proteger pwa_lodging_checkout
CREATE OR REPLACE FUNCTION public.pwa_lodging_checkout(
    p_device_id TEXT, 
    p_token TEXT, 
    p_location_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_person_id UUID;
    v_qr_result JSONB;
    v_occupancy_id UUID;
    v_loc_stage_id UUID;
BEGIN
    -- [VALDAÇÃO DE ETAPA]
    SELECT event_stage_id INTO v_loc_stage_id FROM public.lodging_locations WHERE id = p_location_id;
    IF NOT public.check_user_stage_access(v_loc_stage_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED_STAGE', 'message', 'Você não tem permissão para operar nesta etapa.');
    END IF;

    -- 1. Resolve Person ID
    IF p_token ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_person_id := p_token::uuid;
    ELSE
        v_qr_result := alojamento.resolve_qr(p_token);
        IF NOT (v_qr_result->>'ok')::boolean THEN
             RETURN v_qr_result;
        END IF;
        v_person_id := (v_qr_result->>'entity_id')::uuid;
    END IF;

    -- 2. Find active check-in
    SELECT id INTO v_occupancy_id 
    FROM public.lodging_occupancies 
    WHERE participant_id = v_person_id AND status = 'checked_in'
    LIMIT 1;

    IF v_occupancy_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'NO_ACTIVE_CHECKIN');
    END IF;

    -- 3. Perform Checkout
    UPDATE public.lodging_occupancies SET
        status = 'checked_out',
        checked_out_at = now(),
        checked_out_by = auth.uid(),
        checked_out_device_id = p_device_id,
        updated_at = now()
    WHERE id = v_occupancy_id;

    -- 4. Log Success
    INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, success, metadata)
    VALUES (p_device_id, auth.uid(), 'checkout', v_person_id, p_location_id, true, jsonb_build_object('occupancy_id', v_occupancy_id));

    RETURN jsonb_build_object('ok', true, 'occupancy_id', v_occupancy_id);
END;
$$;

-- 4. Restaurar e Proteger pwa_lodging_register_presence
CREATE OR REPLACE FUNCTION public.pwa_lodging_register_presence(
    p_device_id text,
    p_token text,
    p_unit_id uuid,
    p_mode text DEFAULT 'person_qr'::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $$
DECLARE
    v_person_id UUID;
    v_qr_result JSONB;
    v_event_id UUID;
    v_unit_stage_id UUID;
BEGIN
    -- [VALDAÇÃO DE ETAPA]
    SELECT event_stage_id INTO v_unit_stage_id FROM public.lodging_units WHERE id = p_unit_id;
    IF NOT public.check_user_stage_access(v_unit_stage_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHORIZED_STAGE', 'message', 'Você não tem permissão para operar nesta etapa.');
    END IF;

    -- 1. Resolve Person ID
    IF p_mode = 'person_qr' THEN
        v_qr_result := alojamento.resolve_qr(p_token);
        IF NOT (v_qr_result->>'ok')::boolean THEN
            RETURN v_qr_result;
        END IF;
        v_person_id := (v_qr_result->>'entity_id')::uuid;
    ELSE
        v_person_id := p_token::uuid;
    END IF;

    SELECT event_id INTO v_event_id FROM public.participants WHERE id = v_person_id;

    -- 2. Record Presence
    INSERT INTO public.lodging_presence_logs (
        participant_id, unit_id, event_id, recorded_by, device_id
    ) VALUES (
        v_person_id, p_unit_id, v_event_id, auth.uid(), p_device_id
    );

    RETURN jsonb_build_object('ok', true, 'recorded_at', now());
END;
$$;

-- 5. Restaurar e Proteger redeem_voucher
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
SET search_path = public, auth
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
    v_context_stage_id UUID;
BEGIN
    v_reference_time := COALESCE(p_offline_at, now());

    -- [NOVO] Validação de Acesso à Etapa do Contexto
    IF p_context_id IS NOT NULL THEN
        IF p_service_kind = 'meals' THEN
            SELECT event_stage_id INTO v_context_stage_id FROM public.meal_windows WHERE id = p_context_id;
        ELSIF p_service_kind = 'lodging' THEN
            SELECT event_stage_id INTO v_context_stage_id FROM public.lodging_locations WHERE id = p_context_id;
        END IF;
        
        IF v_context_stage_id IS NOT NULL AND NOT public.check_user_stage_access(v_context_stage_id) THEN
            RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized_stage', 'message', 'Acesso negado para esta etapa.');
        END IF;
    END IF;

    IF p_service_kind NOT IN ('transport','meals','lodging') THEN
        RAISE EXCEPTION 'service_kind inválido' USING ERRCODE = '22023';
    END IF;

    v_allowed := CASE p_service_kind
        WHEN 'transport' THEN public.has_role(v_caller,'transporte') OR public.has_role(v_caller,'admin') OR public.has_role(v_caller,'secretaria') OR public.has_role(v_caller,'super_admin')
        WHEN 'meals'     THEN public.has_role(v_caller,'alimentacao') OR public.has_role(v_caller,'admin') OR public.has_role(v_caller,'secretaria') OR public.has_role(v_caller,'super_admin')
        WHEN 'lodging'   THEN public.has_role(v_caller,'alojamento') OR public.has_role(v_caller,'admin') OR public.has_role(v_caller,'secretaria') OR public.has_role(v_caller,'super_admin')
    END;
    
    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Sem permissão para validar este serviço' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_voucher FROM public.service_vouchers
    WHERE qr_code_value = p_qr_value FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;

    v_event_id := v_voucher.event_id;

    IF v_voucher.status <> 'active' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'inactive');
    END IF;

    IF v_voucher.valid_until IS NOT NULL AND v_voucher.valid_until < v_reference_time THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'expired');
    END IF;
    
    IF v_voucher.valid_from > v_reference_time THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'not_yet_valid');
    END IF;

    IF (p_service_kind = 'transport' AND NOT v_voucher.scope_transport)
       OR (p_service_kind = 'meals'   AND NOT v_voucher.scope_meals)
       OR (p_service_kind = 'lodging' AND NOT v_voucher.scope_lodging) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'scope_denied');
    END IF;

    -- Efetivar consumo
    INSERT INTO public.service_voucher_uses (voucher_id, service_kind, context_id, used_by, used_at)
    VALUES (v_voucher.id, p_service_kind, p_context_id, v_caller, v_reference_time);

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
