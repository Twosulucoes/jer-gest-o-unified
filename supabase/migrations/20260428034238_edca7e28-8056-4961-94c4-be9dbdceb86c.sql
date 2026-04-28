-- Enhance lodging_units
ALTER TABLE public.lodging_units 
ADD COLUMN IF NOT EXISTS floor TEXT;

-- Enhance lodging_occupancies to support operational data
ALTER TABLE public.lodging_occupancies 
ADD COLUMN IF NOT EXISTS check_in_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS check_out_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS check_in_device_id TEXT,
ADD COLUMN IF NOT EXISTS checkout_device_id TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS check_in_location_id UUID REFERENCES public.lodging_locations(id),
ADD COLUMN IF NOT EXISTS check_in_unit_id UUID REFERENCES public.lodging_units(id),
ADD COLUMN IF NOT EXISTS divergence_notes TEXT;

-- Create audit log table in public schema
CREATE TABLE IF NOT EXISTS public.lodging_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    device_id TEXT,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    participant_id UUID REFERENCES public.participants(id),
    location_id UUID REFERENCES public.lodging_locations(id),
    unit_id UUID REFERENCES public.lodging_units(id),
    success BOOLEAN NOT NULL DEFAULT true,
    error_code TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS for the new table
ALTER TABLE public.lodging_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for lodging_audit_logs
CREATE POLICY "Admin/Secretaria can view all lodging audit logs" 
ON public.lodging_audit_logs FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretaria'::public.app_role));

CREATE POLICY "Alojamento can view own lodging audit logs" 
ON public.lodging_audit_logs FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "Alojamento can insert lodging audit logs" 
ON public.lodging_audit_logs FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

-- Update public.pwa_checkin to use the new public schema structure
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
    v_error_msg TEXT;
    v_error_code TEXT;
BEGIN
    -- 1. Resolve Person ID
    IF p_mode = 'person_qr' THEN
        -- Using the existing resolver in alojamento schema for now as it's the one managing tokens
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

    -- 2. Basic Validations (similar to previous pwa_checkin)
    -- Check if person exists and is active
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

    -- 4. Check if already checked in (hospedado)
    IF EXISTS (
        SELECT 1 FROM public.lodging_occupancies 
        WHERE participant_id = v_person_id AND status = 'check-in'
    ) THEN
        INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, unit_id, success, error_code, error_message)
        VALUES (p_device_id, auth.uid(), 'checkin', v_person_id, p_location_id, p_unit_id, false, 'ALREADY_CHECKED_IN', 'Pessoa já possui um check-in ativo');
        RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_CHECKED_IN');
    END IF;

    -- 5. Handle Planned vs Unplanned (Divergence)
    -- Try to find a 'planned' occupancy for this person in any unit/location for the current stage
    SELECT * INTO v_planned_occupancy 
    FROM public.lodging_occupancies 
    WHERE participant_id = v_person_id 
      AND status = 'planned'
    LIMIT 1;

    IF v_planned_occupancy.id IS NOT NULL THEN
        -- Check if scanning at the planned location/unit
        IF p_unit_id IS NOT NULL AND v_planned_occupancy.unit_id != p_unit_id THEN
            v_divergence_notes := 'Divergência: Alocação planejada na Unidade ' || v_planned_occupancy.unit_id || ', mas check-in realizado na Unidade ' || p_unit_id;
        ELSIF p_unit_id IS NULL AND EXISTS (
            SELECT 1 FROM public.lodging_units 
            WHERE id = v_planned_occupancy.unit_id AND location_id != p_location_id
        ) THEN
             v_divergence_notes := 'Divergência: Alocação planejada no Local ' || (SELECT location_id FROM public.lodging_units WHERE id = v_planned_occupancy.unit_id) || ', mas check-in realizado no Local ' || p_location_id;
        END IF;

        -- Update the planned record
        UPDATE public.lodging_occupancies SET
            status = 'check-in',
            check_in_at = now(),
            check_in_by = auth.uid(),
            check_in_device_id = p_device_id,
            check_in_location_id = p_location_id,
            check_in_unit_id = p_unit_id,
            divergence_notes = v_divergence_notes,
            updated_at = now()
        WHERE id = v_planned_occupancy.id;
        v_occupancy_id := v_planned_occupancy.id;
    ELSE
        -- No planned occupancy found, create a new one (Unplanned)
        INSERT INTO public.lodging_occupancies (
            participant_id, unit_id, stage_id, status, 
            check_in_at, check_in_by, check_in_device_id, 
            check_in_location_id, check_in_unit_id, divergence_notes
        )
        VALUES (
            v_person_id, p_unit_id, v_current_stage_id, 'check-in',
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

-- Update public.pwa_lodging_checkout
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
    WHERE participant_id = v_person_id AND status = 'check-in'
    LIMIT 1;

    IF v_occupancy_id IS NULL THEN
        INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, success, error_code, error_message)
        VALUES (p_device_id, auth.uid(), 'checkout', v_person_id, p_location_id, false, 'NO_ACTIVE_CHECKIN', 'Nenhum check-in ativo encontrado para esta pessoa');
        RETURN jsonb_build_object('ok', false, 'error', 'NO_ACTIVE_CHECKIN');
    END IF;

    -- 3. Perform Checkout
    UPDATE public.lodging_occupancies SET
        status = 'check-out',
        check_out_at = now(),
        check_out_by = auth.uid(),
        checkout_device_id = p_device_id,
        updated_at = now()
    WHERE id = v_occupancy_id;

    -- 4. Log Success
    INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, success, metadata)
    VALUES (p_device_id, auth.uid(), 'checkout', v_person_id, p_location_id, true, jsonb_build_object('occupancy_id', v_occupancy_id));

    RETURN jsonb_build_object('ok', true, 'occupancy_id', v_occupancy_id);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.pwa_lodging_checkin(text, text, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pwa_lodging_checkout(text, text, uuid) TO authenticated;

-- Keep old wrappers updated to point to the new ones to avoid breaking the PWA immediately
-- But we will update the PWA code next.
CREATE OR REPLACE FUNCTION public.pwa_checkin(p_device_id text, p_token text, p_facility_id uuid, p_mode text DEFAULT 'person_qr')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Re-route to the new unified function
  RETURN public.pwa_lodging_checkin(p_device_id, p_token, p_facility_id, NULL, p_mode);
END;
$$;

CREATE OR REPLACE FUNCTION public.pwa_checkout(p_device_id text, p_token text, p_facility_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Re-route to the new unified function
  RETURN public.pwa_lodging_checkout(p_device_id, p_token, p_facility_id);
END;
$$;
