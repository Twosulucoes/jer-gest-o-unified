-- Etapa 1 da Auditoria do Módulo de Alojamento
-- Cruza o conceito de "saída antecipada do evento" (introduzido pela
-- Etapa 2 do módulo Alimentação, em participants.left_event_at) com o
-- ciclo de check-in/out de alojamento.
--
-- Comportamento esperado:
--   1. pwa_lodging_checkin recusa novo check-in quando o participante
--      registrou saída antecipada. Erro padronizado LEFT_EVENT.
--   2. Trigger AFTER UPDATE em participants: ao registrar
--      left_event_at (NULL → não-NULL), faz auto-checkout dos
--      lodging_occupancies do participante que estejam em
--      'planned' ou 'checked_in'. Para 'checked_in', preenche
--      checked_out_at com left_event_at e marca a operação como
--      auto_checkout em lodging_audit_logs. Para 'planned', muda
--      o status para 'cancelled' (ocupação planejada que nunca
--      ocorreu) — mantém a linha para histórico.

-- =====================================================================
-- 1. RPC: pwa_lodging_checkin com bloqueio LEFT_EVENT
-- =====================================================================

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
    v_left_event_at TIMESTAMPTZ;
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

    -- 2. Basic Validations: gender + saída antecipada
    SELECT p.gender, prt.left_event_at
      INTO v_participant_gender, v_left_event_at
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

-- =====================================================================
-- 2. Trigger: auto-checkout ao registrar saída antecipada
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_participant_left_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_left_at TIMESTAMPTZ := NEW.left_event_at;
    v_occupancy RECORD;
BEGIN
    -- Só age na transição NULL → não-NULL.
    IF OLD.left_event_at IS NOT NULL OR NEW.left_event_at IS NULL THEN
        RETURN NEW;
    END IF;

    -- Auto-checkout dos check-ins ativos.
    FOR v_occupancy IN
        SELECT id, checked_in_unit_id, checked_in_location_id
        FROM public.lodging_occupancies
        WHERE participant_id = NEW.id
          AND status = 'checked_in'
    LOOP
        UPDATE public.lodging_occupancies
        SET status = 'checked_out',
            checked_out_at = v_left_at,
            checked_out_by = v_actor,
            divergence_notes = COALESCE(divergence_notes || ' | ', '') ||
                               'Auto-checkout: saída antecipada do evento em ' ||
                               to_char(v_left_at, 'DD/MM/YYYY HH24:MI'),
            updated_at = now()
        WHERE id = v_occupancy.id;

        INSERT INTO public.lodging_audit_logs (
            user_id, action, participant_id, location_id, unit_id,
            success, metadata
        ) VALUES (
            v_actor, 'auto_checkout', NEW.id,
            v_occupancy.checked_in_location_id, v_occupancy.checked_in_unit_id,
            true,
            jsonb_build_object(
                'reason', 'left_event',
                'left_event_at', v_left_at,
                'occupancy_id', v_occupancy.id
            )
        );
    END LOOP;

    -- Cancela alocações planejadas que ainda não viraram check-in.
    UPDATE public.lodging_occupancies
    SET status = 'cancelled',
        divergence_notes = COALESCE(divergence_notes || ' | ', '') ||
                           'Cancelada: participante registrou saída antecipada em ' ||
                           to_char(v_left_at, 'DD/MM/YYYY HH24:MI'),
        updated_at = now()
    WHERE participant_id = NEW.id
      AND status = 'planned';

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_participant_left_event_lodging ON public.participants;
CREATE TRIGGER trg_participant_left_event_lodging
    AFTER UPDATE OF left_event_at ON public.participants
    FOR EACH ROW
    WHEN (OLD.left_event_at IS DISTINCT FROM NEW.left_event_at)
    EXECUTE FUNCTION public.handle_participant_left_event();
