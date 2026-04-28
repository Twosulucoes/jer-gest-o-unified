-- Update pwa_lodging_register_presence with business intelligence
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
    v_active_occ RECORD;
    v_night_date DATE;
    v_now TIMESTAMP WITH TIME ZONE;
    v_already_registered TIMESTAMP WITH TIME ZONE;
BEGIN
    v_now := now();
    
    -- Definition of "Night":
    -- If before 06:00 AM, it's still the previous day's night.
    -- Otherwise, it's the current day's night.
    IF EXTRACT(HOUR FROM v_now) < 6 THEN
        v_night_date := (v_now - INTERVAL '1 day')::date;
    ELSE
        v_night_date := v_now::date;
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

    -- 2. Validate active check-in
    SELECT * INTO v_active_occ 
    FROM public.lodging_occupancies 
    WHERE participant_id = v_person_id 
      AND status = 'checked_in'
    LIMIT 1;

    IF NOT FOUND THEN
        INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, unit_id, success, notes)
        VALUES (p_device_id, auth.uid(), 'presence_denied', v_person_id, p_unit_id, false, 'PRESENCE_WITHOUT_CHECKIN');
        
        RETURN jsonb_build_object(
            'ok', false, 
            'error', 'PRESENCE_WITHOUT_CHECKIN', 
            'message', 'Pessoa não possui check-in ativo em nenhuma unidade.'
        );
    END IF;

    -- 3. Validate correct unit
    IF v_active_occ.unit_id != p_unit_id THEN
        DECLARE
            v_actual_unit_name TEXT;
        BEGIN
            SELECT name INTO v_actual_unit_name FROM public.lodging_units WHERE id = v_active_occ.unit_id;
            
            INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, unit_id, success, notes)
            VALUES (p_device_id, auth.uid(), 'presence_denied', v_person_id, p_unit_id, false, 'PRESENCE_WRONG_UNIT');
            
            RETURN jsonb_build_object(
                'ok', false, 
                'error', 'PRESENCE_WRONG_UNIT', 
                'message', format('Pessoa está hospedada na unidade %s, não nesta.', v_actual_unit_name)
            );
        END;
    END IF;

    -- 4. Check for duplicate on the same night
    -- We define a night as the log within the 6am-6am window.
    -- Here we check for records on the same v_night_date calculated above.
    SELECT recorded_at INTO v_already_registered
    FROM public.lodging_presence_logs
    WHERE participant_id = v_person_id
      AND unit_id = p_unit_id
      AND (
          (recorded_at >= v_night_date + TIME '18:00' AND recorded_at < v_night_date + INTERVAL '1 day' + TIME '06:00')
          OR 
          (recorded_at >= v_night_date + TIME '06:00' AND recorded_at < v_night_date + TIME '18:00' AND EXTRACT(HOUR FROM v_now) >= 6 AND EXTRACT(HOUR FROM v_now) < 18)
      )
    LIMIT 1;
    -- Simplified duplicate check: same v_night_date for the log
    -- But since we don't have a night_date column yet, let's just check the last 12 hours for simplicity in this version,
    -- or better, check records since 6pm of the current "night" start.
    
    SELECT recorded_at INTO v_already_registered
    FROM public.lodging_presence_logs
    WHERE participant_id = v_person_id
      AND recorded_at > (v_night_date + TIME '06:00')
    LIMIT 1;

    IF v_already_registered IS NOT NULL THEN
         RETURN jsonb_build_object(
            'ok', false, 
            'error', 'PRESENCE_ALREADY_REGISTERED', 
            'message', format('Presença já registrada às %s.', to_char(v_already_registered AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'))
        );
    END IF;

    -- 5. Record Presence
    INSERT INTO public.lodging_presence_logs (
        participant_id, unit_id, event_id, recorded_by, device_id
    ) VALUES (
        v_person_id, p_unit_id, v_active_occ.event_id, auth.uid(), p_device_id
    );

    -- 6. Audit Log
    INSERT INTO public.lodging_audit_logs (device_id, user_id, action, participant_id, unit_id, success)
    VALUES (p_device_id, auth.uid(), 'presence', v_person_id, p_unit_id, true);

    RETURN jsonb_build_object('ok', true, 'recorded_at', v_now);
END;
$function$;
