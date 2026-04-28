-- 1. Tabela de Logs de Presença Noturna
CREATE TABLE IF NOT EXISTS public.lodging_presence_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID REFERENCES public.participants(id) NOT NULL,
    unit_id UUID REFERENCES public.lodging_units(id) NOT NULL,
    event_id UUID REFERENCES public.events(id),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    recorded_by UUID REFERENCES auth.users(id),
    device_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lodging_presence_logs ENABLE ROW LEVEL SECURITY;

-- Policies for presence logs
CREATE POLICY "Alojamento users can insert presence logs"
ON public.lodging_presence_logs FOR INSERT
WITH CHECK (true); -- Filtered by API layer/RPC

CREATE POLICY "Alojamento users can view presence logs"
ON public.lodging_presence_logs FOR SELECT
USING (true);

-- 2. Atualizar pwa_lodging_checkin com validações de gênero e capacidade
CREATE OR REPLACE FUNCTION public.pwa_lodging_checkin(
    p_device_id text, 
    p_token text, 
    p_location_id uuid, 
    p_unit_id uuid DEFAULT NULL::uuid, 
    p_mode text DEFAULT 'person_qr'::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    v_person_id UUID;
    v_qr_result JSONB;
    v_occupancy_id UUID;
    v_planned_occupancy RECORD;
    v_divergence_notes TEXT := NULL;
    v_current_stage_id UUID;
    v_participant_gender TEXT;
    v_unit_gender_restriction TEXT;
    v_unit_capacity INTEGER;
    v_current_occupancy_count INTEGER;
    v_planned_unit_name TEXT;
    v_unit_name TEXT;
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

    -- 2. Basic Validations (Active status and Gender)
    SELECT p.gender INTO v_participant_gender
    FROM public.people p
    JOIN public.participants prt ON prt.person_id = p.id
    WHERE prt.id = v_person_id AND prt.status = 'active';

    IF v_participant_gender IS NULL THEN
        INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, unit_id, success, error_code, error_message)
        VALUES (p_device_id, auth.uid(), 'checkin', v_person_id, p_location_id, p_unit_id, false, 'PARTICIPANT_NOT_FOUND', 'Participante não encontrado, inativo ou sem gênero definido');
        RETURN jsonb_build_object('ok', false, 'error', 'PARTICIPANT_NOT_FOUND');
    END IF;

    -- 3. Unit Validations (if unit_id is provided)
    IF p_unit_id IS NOT NULL THEN
        SELECT gender_restriction, capacity, name INTO v_unit_gender_restriction, v_unit_capacity, v_unit_name
        FROM public.lodging_units WHERE id = p_unit_id;

        -- 3.1 Gender Validation
        IF v_unit_gender_restriction IS NOT NULL AND v_unit_gender_restriction != 'mixed' AND v_unit_gender_restriction != v_participant_gender THEN
            INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, unit_id, success, error_code, error_message)
            VALUES (p_device_id, auth.uid(), 'checkin', v_person_id, p_location_id, p_unit_id, false, 'GENDER_MISMATCH', 'Gênero incompatível com a unidade');
            RETURN jsonb_build_object('ok', false, 'error', 'GENDER_MISMATCH', 'message', 'O gênero do participante (' || v_participant_gender || ') não é permitido nesta unidade (' || v_unit_gender_restriction || ').');
        END IF;

        -- 3.2 Capacity Validation
        IF v_unit_capacity IS NULL OR v_unit_capacity <= 0 THEN
            INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, unit_id, success, error_code, error_message)
            VALUES (p_device_id, auth.uid(), 'checkin', v_person_id, p_location_id, p_unit_id, false, 'CAPACITY_NOT_DEFINED', 'Unidade sem capacidade definida');
            RETURN jsonb_build_object('ok', false, 'error', 'CAPACITY_NOT_DEFINED', 'message', 'Unidade sem capacidade definida — solicitar à coordenação');
        END IF;

        SELECT COUNT(*) INTO v_current_occupancy_count
        FROM public.lodging_occupancies
        WHERE (unit_id = p_unit_id OR checked_in_unit_id = p_unit_id)
          AND status = 'checked_in'
          AND participant_id != v_person_id;

        IF v_current_occupancy_count >= v_unit_capacity THEN
            INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, unit_id, success, error_code, error_message)
            VALUES (p_device_id, auth.uid(), 'checkin', v_person_id, p_location_id, p_unit_id, false, 'UNIT_FULL', 'Unidade está lotada');
            RETURN jsonb_build_object('ok', false, 'error', 'UNIT_FULL', 'message', 'Esta unidade já atingiu a capacidade máxima (' || v_unit_capacity || ').');
        END IF;
    END IF;

    -- 4. Find current stage
    SELECT stage_id INTO v_current_stage_id 
    FROM public.participant_event_stages 
    WHERE participant_id = v_person_id 
    ORDER BY created_at DESC LIMIT 1;

    -- 5. Check if already checked in
    IF EXISTS (
        SELECT 1 FROM public.lodging_occupancies 
        WHERE participant_id = v_person_id AND status = 'checked_in'
    ) THEN
        INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, location_id, unit_id, success, error_code, error_message)
        VALUES (p_device_id, auth.uid(), 'checkin', v_person_id, p_location_id, p_unit_id, false, 'ALREADY_CHECKED_IN', 'Pessoa já possui um check-in ativo');
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
        -- Check divergence
        IF p_unit_id IS NOT NULL AND v_planned_occupancy.unit_id != p_unit_id THEN
            v_divergence_notes := 'ATENÇÃO: pessoa estava alocada no [' || COALESCE(v_planned_occupancy.unit_name, 'Unidade Desconhecida') || '], foi registrada no [' || COALESCE(v_unit_name, 'Unidade Atual') || ']. Divergência registrada.';
            v_planned_unit_name := v_planned_occupancy.unit_name;
        ELSIF p_unit_id IS NULL AND EXISTS (
            SELECT 1 FROM public.lodging_units 
            WHERE id = v_planned_occupancy.unit_id AND location_id != p_location_id
        ) THEN
             v_divergence_notes := 'ATENÇÃO: Alocação planejada em Local diferente do atual.';
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

    RETURN jsonb_build_object(
        'ok', true, 
        'occupancy_id', v_occupancy_id, 
        'divergence', v_divergence_notes,
        'planned_unit_name', v_planned_unit_name,
        'actual_unit_name', v_unit_name
    );
END;
$function$;

-- 3. Nova RPC para Presença Noturna
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
AS $function$
DECLARE
    v_person_id UUID;
    v_qr_result JSONB;
    v_event_id UUID;
BEGIN
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

    -- 2. Validate active check-in (optional, but recommended)
    -- If we want to allow presence even without formal check-in, we just proceed.
    -- Here we just record the presence.
    
    SELECT event_id INTO v_event_id FROM public.participants WHERE id = v_person_id;

    -- 3. Record Presence
    INSERT INTO public.lodging_presence_logs (
        participant_id, unit_id, event_id, recorded_by, device_id
    ) VALUES (
        v_person_id, p_unit_id, v_event_id, auth.uid(), p_device_id
    );

    -- 4. Audit Log
    INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, unit_id, success)
    VALUES (p_device_id, auth.uid(), 'presence', v_person_id, p_unit_id, true);

    RETURN jsonb_build_object('ok', true, 'recorded_at', now());
END;
$function$;
