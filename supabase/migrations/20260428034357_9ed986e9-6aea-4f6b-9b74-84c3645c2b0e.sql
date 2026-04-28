-- Rename operational columns for consistency if needed, but primarily consolidate
-- The previous migration added check_in_by, check_out_by, check_in_device_id, checkout_device_id.
-- The table already had checked_in_by, checked_out_by, checked_in_at, checked_out_at.

-- 1. Data consolidation (if any exists)
UPDATE public.lodging_occupancies SET checked_in_by = check_in_by WHERE checked_in_by IS NULL AND check_in_by IS NOT NULL;
UPDATE public.lodging_occupancies SET checked_out_by = check_out_by WHERE checked_out_by IS NULL AND check_out_by IS NOT NULL;

-- 2. Drop redundant columns
ALTER TABLE public.lodging_occupancies DROP COLUMN IF EXISTS check_in_by;
ALTER TABLE public.lodging_occupancies DROP COLUMN IF EXISTS check_out_by;

-- 3. Rename others for perfect consistency (using check_in prefix)
-- We keep checked_in_at/by because they are already in many files.
-- We rename my new ones to match the style or vice versa.
-- I'll rename check_in_device_id to checked_in_device_id and checkout_device_id to checked_out_device_id.
ALTER TABLE public.lodging_occupancies RENAME COLUMN check_in_device_id TO checked_in_device_id;
ALTER TABLE public.lodging_occupancies RENAME COLUMN checkout_device_id TO checked_out_device_id;
ALTER TABLE public.lodging_occupancies RENAME COLUMN check_in_location_id TO checked_in_location_id;
ALTER TABLE public.lodging_occupancies RENAME COLUMN check_in_unit_id TO checked_in_unit_id;

-- 4. Update RPCs to use consolidated names
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
BEGIN
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
    IF NOT EXISTS (SELECT 1 FROM public.participants WHERE id = v_person_id AND status = 'active') THEN
        INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, unit_id, success, error_code, error_message)
        VALUES (p_device_id, auth.uid(), 'checkin', v_person_id, p_location_id, p_unit_id, false, 'PARTICIPANT_NOT_ACTIVE', 'Participante não está ativo');
        RETURN jsonb_build_object('ok', false, 'error', 'PARTICIPANT_NOT_ACTIVE');
    END IF;

    -- 3. Find current stage
    SELECT stage_id INTO v_current_stage_id 
    FROM public.participant_event_stages 
    WHERE participant_id = v_person_id 
    ORDER BY created_at DESC LIMIT 1;

    -- 4. Check if already checked in
    IF EXISTS (
        SELECT 1 FROM public.lodging_occupancies 
        WHERE participant_id = v_person_id AND status = 'checked_in'
    ) THEN
        INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, unit_id, success, error_code, error_message)
        VALUES (p_device_id, auth.uid(), 'checkin', v_person_id, p_location_id, p_unit_id, false, 'ALREADY_CHECKED_IN', 'Pessoa já possui um check-in ativo');
        RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_CHECKED_IN');
    END IF;

    -- 5. Handle Planned vs Unplanned
    SELECT * INTO v_planned_occupancy 
    FROM public.lodging_occupancies 
    WHERE participant_id = v_person_id 
      AND status = 'planned'
    LIMIT 1;

    IF v_planned_occupancy.id IS NOT NULL THEN
        -- Check divergence
        IF p_unit_id IS NOT NULL AND v_planned_occupancy.unit_id != p_unit_id THEN
            v_divergence_notes := 'Divergência: Alocação planejada na Unidade ' || v_planned_occupancy.unit_id || ', mas check-in realizado na Unidade ' || p_unit_id;
        ELSIF p_unit_id IS NULL AND EXISTS (
            SELECT 1 FROM public.lodging_units 
            WHERE id = v_planned_occupancy.unit_id AND location_id != p_location_id
        ) THEN
             v_divergence_notes := 'Divergência: Alocação planejada em Local diferente do atual.';
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

    -- 6. Log Success
    INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, unit_id, success, metadata)
    VALUES (p_device_id, auth.uid(), 'checkin', v_person_id, p_location_id, p_unit_id, true, jsonb_build_object('occupancy_id', v_occupancy_id, 'divergence', v_divergence_notes));

    RETURN jsonb_build_object('ok', true, 'occupancy_id', v_occupancy_id, 'divergence', v_divergence_notes);
END;
$$;

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
BEGIN
    -- 1. Resolve Person ID
    IF p_token ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_person_id := p_token::uuid;
    ELSE
        v_qr_result := alojamento.resolve_qr(p_token);
        IF NOT (v_qr_result->>'ok')::boolean THEN
             INSERT INTO public.lodging_audit_logs (device_id, user_id, action, location_id, success, error_code, error_message)
             VALUES (p_device_id, auth.uid(), 'checkout', p_location_id, false, v_qr_result->>'error', 'Token inválido');
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
        INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, success, error_code, error_message)
        VALUES (p_device_id, auth.uid(), 'checkout', v_person_id, p_location_id, false, 'NO_ACTIVE_CHECKIN', 'Nenhum check-in ativo encontrado para esta pessoa');
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
