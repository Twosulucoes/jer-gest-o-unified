-- Etapa 2 da Auditoria do Módulo de Alojamento
-- Adiciona validação de participants.needs_lodging em pwa_lodging_checkin.
-- Hoje qualquer participante ativo consegue fazer check-in, mesmo quem
-- declarou na inscrição que NÃO precisa de hospedagem (visitantes, staff
-- de fora, delegados que voltam para casa). Isso ocupa vaga indevidamente
-- e enviesa relatórios de presença/divergências.
--
-- Comportamento:
--   * Se needs_lodging = false e p_force = false: retorna
--     { ok: false, error: 'NEEDS_LODGING_FALSE' }, com mensagem
--     orientando o operador.
--   * Se p_force = true: aceita o check-in mas grava em
--     divergence_notes a frase "Check-in autorizado manualmente
--     (needs_lodging=false)" e em lodging_audit_logs.metadata
--     marca override=true para auditoria.
--
-- Mantém retrocompatibilidade: p_force tem DEFAULT FALSE; o app antigo
-- (que não envia o parâmetro) continua funcionando.

CREATE OR REPLACE FUNCTION public.pwa_lodging_checkin(
    p_device_id TEXT,
    p_token TEXT,
    p_location_id UUID,
    p_unit_id UUID DEFAULT NULL,
    p_mode TEXT DEFAULT 'person_qr',
    p_force BOOLEAN DEFAULT FALSE
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
    v_left_event_at TIMESTAMPTZ;
    v_needs_lodging BOOLEAN;
    v_unit_gender_restriction TEXT;
    v_unit_capacity INTEGER;
    v_current_occupancy_count INTEGER;
    v_planned_unit_name TEXT;
    v_unit_name TEXT;
BEGIN
    -- [VALIDAÇÃO DE ETAPA]
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

    -- 2. Basic Validations: gender + saída antecipada + needs_lodging
    SELECT p.gender, prt.left_event_at, prt.needs_lodging
      INTO v_participant_gender, v_left_event_at, v_needs_lodging
    FROM public.people p
    JOIN public.participants prt ON prt.person_id = p.id
    WHERE prt.id = v_person_id AND prt.status = 'active';

    IF v_participant_gender IS NULL THEN
        INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, unit_id, success, error_code, error_message)
        VALUES (p_device_id, auth.uid(), 'checkin', v_person_id, p_location_id, p_unit_id, false, 'PARTICIPANT_NOT_FOUND', 'Participante não encontrado ou inativo');
        RETURN jsonb_build_object('ok', false, 'error', 'PARTICIPANT_NOT_FOUND');
    END IF;

    -- Etapa 1: bloqueia check-in após saída antecipada do evento.
    IF v_left_event_at IS NOT NULL THEN
        INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, unit_id, success, error_code, error_message, metadata)
        VALUES (
            p_device_id, auth.uid(), 'checkin', v_person_id, p_location_id, p_unit_id,
            false, 'LEFT_EVENT',
            'Participante registrou saída antecipada do evento',
            jsonb_build_object('left_event_at', v_left_event_at)
        );
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'LEFT_EVENT',
            'message', format('Participante registrou saída antecipada do evento em %s.', to_char(v_left_event_at, 'DD/MM/YYYY HH24:MI'))
        );
    END IF;

    -- Etapa 2: bloqueia check-in quando o participante declarou na
    -- inscrição que não precisa de alojamento, salvo override do operador.
    IF v_needs_lodging IS DISTINCT FROM TRUE AND NOT p_force THEN
        INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, unit_id, success, error_code, error_message, metadata)
        VALUES (
            p_device_id, auth.uid(), 'checkin', v_person_id, p_location_id, p_unit_id,
            false, 'NEEDS_LODGING_FALSE',
            'Participante não declarou necessidade de alojamento na inscrição',
            jsonb_build_object('needs_lodging', v_needs_lodging)
        );
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'NEEDS_LODGING_FALSE',
            'can_force', true,
            'message', 'Participante não declarou necessidade de alojamento. Confirme manualmente para hospedar mesmo assim.'
        );
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

    -- Etapa 2: se o operador forçou hospedagem de quem não precisa,
    -- registra essa exceção em divergence_notes para a coordenação ver.
    IF p_force AND v_needs_lodging IS DISTINCT FROM TRUE THEN
        v_divergence_notes := COALESCE(v_divergence_notes || ' | ', '') ||
            'Check-in autorizado manualmente (needs_lodging=false)';
    END IF;

    IF v_planned_occupancy.id IS NOT NULL THEN
        IF p_unit_id IS NOT NULL AND v_planned_occupancy.unit_id != p_unit_id THEN
            v_divergence_notes := COALESCE(v_divergence_notes || ' | ', '') ||
                'Divergência: Alocação planejada na Unidade [' || v_planned_occupancy.unit_name || '], mas check-in realizado na Unidade [' || v_unit_name || ']';
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
            p_location_id, p_unit_id,
            COALESCE(v_divergence_notes, 'Check-in não planejado')
        )
        RETURNING id INTO v_occupancy_id;
    END IF;

    -- 7. Log Success (com flag override quando aplicável)
    INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, unit_id, success, metadata)
    VALUES (
        p_device_id, auth.uid(), 'checkin', v_person_id, p_location_id, p_unit_id, true,
        jsonb_build_object(
            'occupancy_id', v_occupancy_id,
            'divergence', v_divergence_notes,
            'override_needs_lodging', (p_force AND v_needs_lodging IS DISTINCT FROM TRUE)
        )
    );

    RETURN jsonb_build_object(
        'ok', true,
        'occupancy_id', v_occupancy_id,
        'divergence', v_divergence_notes,
        'planned_unit_name', v_planned_occupancy.unit_name,
        'actual_unit_name', v_unit_name
    );
END;
$$;
