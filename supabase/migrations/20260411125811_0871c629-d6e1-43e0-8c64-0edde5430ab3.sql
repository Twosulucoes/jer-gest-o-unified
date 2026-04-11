
CREATE OR REPLACE FUNCTION public.import_inscricoes_batch(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
  v_person record;
  v_enrollment record;
  v_person_id uuid;
  v_participant_id uuid;
  v_sport_event_id uuid;
  v_people_created int := 0;
  v_people_reused int := 0;
  v_participants_created int := 0;
  v_participants_reused int := 0;
  v_sport_events_created int := 0;
  v_sport_events_reused int := 0;
  v_enrollments_created int := 0;
  v_enrollments_skipped int := 0;
  v_staff_created int := 0;
  v_failed int := 0;
  v_person_key text;
  v_person_map jsonb := '{}'::jsonb;
  v_participant_type text;
  v_idx_people int := 0;
  v_idx_enroll int := 0;
  v_err_code text;
  v_err_msg text;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  -- Validar event_id antes de tudo
  IF payload->>'event_id' IS NULL OR trim(payload->>'event_id') = '' THEN
    RAISE EXCEPTION 'event_id é obrigatório no payload' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_event_id := (payload->>'event_id')::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'event_id inválido: %', payload->>'event_id' USING ERRCODE = '22023';
  END;

  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = v_event_id) THEN
    RAISE EXCEPTION 'Evento não encontrado: %', v_event_id USING ERRCODE = '22023';
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- Phase 1: Upsert people (COM subtransação por linha)
  -- ═══════════════════════════════════════════════════════════════
  FOR v_person IN SELECT * FROM jsonb_array_elements(payload->'people_to_create')
  LOOP
    v_idx_people := v_idx_people + 1;

    BEGIN
      v_person_id := NULL;

      IF v_person.value->>'cpf' IS NOT NULL THEN
        SELECT id INTO v_person_id
          FROM public.people
          WHERE cpf = v_person.value->>'cpf'
          LIMIT 1;
      END IF;

      IF v_person_id IS NULL THEN
        SELECT id INTO v_person_id
          FROM public.people
          WHERE full_name = v_person.value->>'full_name'
            AND birth_date = (v_person.value->>'birth_date')::date
            AND gender = v_person.value->>'gender'
          LIMIT 1;
      END IF;

      IF v_person_id IS NOT NULL THEN
        v_people_reused := v_people_reused + 1;
      ELSE
        INSERT INTO public.people (full_name, birth_date, gender, cpf, rg, email, phone, institution_id, disability_type)
        VALUES (
          v_person.value->>'full_name',
          (v_person.value->>'birth_date')::date,
          v_person.value->>'gender',
          v_person.value->>'cpf',
          v_person.value->>'rg',
          v_person.value->>'email',
          v_person.value->>'phone',
          NULLIF(v_person.value->>'institution_id', '')::uuid,
          v_person.value->>'disability_type'
        )
        RETURNING id INTO v_person_id;
        v_people_created := v_people_created + 1;
      END IF;

      IF v_person.value->>'cpf' IS NOT NULL THEN
        v_person_key := v_person.value->>'cpf';
      ELSE
        v_person_key := lower(v_person.value->>'full_name') || '|' || v_person.value->>'birth_date' || '|' || v_person.value->>'gender';
      END IF;

      v_person_map := v_person_map || jsonb_build_object(v_person_key, v_person_id::text);

    EXCEPTION
      WHEN others THEN
        v_failed := v_failed + 1;

        GET STACKED DIAGNOSTICS
          v_err_msg  = MESSAGE_TEXT,
          v_err_code = RETURNED_SQLSTATE;

        INSERT INTO public.import_row_errors (event_id, row_number, entity, error_code, error_message, payload)
        VALUES (
          v_event_id, v_idx_people, 'people', v_err_code, v_err_msg,
          jsonb_build_object('full_name', v_person.value->>'full_name',
                            'birth_date', v_person.value->>'birth_date')
        );

        IF jsonb_array_length(v_errors) < 50 THEN
          v_errors := v_errors || jsonb_build_array(
            jsonb_build_object(
              'phase', 'people',
              'row', v_idx_people,
              'code', v_err_code,
              'message', v_err_msg
            )
          );
        END IF;
    END;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════
  -- Phase 2: Process enrollments (COM subtransação por linha)
  -- ═══════════════════════════════════════════════════════════════
  FOR v_enrollment IN SELECT * FROM jsonb_array_elements(payload->'enrollments')
  LOOP
    v_idx_enroll := v_idx_enroll + 1;

    BEGIN
      v_person_key := v_enrollment.value->>'person_key';
      v_participant_type := COALESCE(v_enrollment.value->>'participant_type', 'athlete');

      -- Resolve person_id
      IF v_person_map ? v_person_key THEN
        v_person_id := (v_person_map->>v_person_key)::uuid;
      ELSE
        IF length(v_person_key) = 11 AND v_person_key ~ '^\d+$' THEN
          SELECT id INTO v_person_id FROM public.people WHERE cpf = v_person_key LIMIT 1;
        ELSE
          SELECT id INTO v_person_id FROM public.people
          WHERE lower(full_name) || '|' || birth_date::text || '|' || gender = v_person_key
          LIMIT 1;
        END IF;

        IF v_person_id IS NULL THEN
          RAISE EXCEPTION 'Person not found for key: %', v_person_key;
        END IF;
      END IF;

      -- Upsert participant
      SELECT id INTO v_participant_id
        FROM public.participants
        WHERE person_id = v_person_id AND event_id = v_event_id
        LIMIT 1;

      IF v_participant_id IS NOT NULL THEN
        v_participants_reused := v_participants_reused + 1;
      ELSE
        INSERT INTO public.participants (person_id, event_id, delegation_id, participant_type, status)
        VALUES (
          v_person_id,
          v_event_id,
          (v_enrollment.value->>'delegation_id')::uuid,
          v_participant_type,
          'confirmed'
        )
        RETURNING id INTO v_participant_id;
        v_participants_created := v_participants_created + 1;
      END IF;

      -- If no sport data (staff/commission), skip sport_event creation
      IF v_enrollment.value->>'sport_id' IS NULL OR v_enrollment.value->>'sport_id' = '' THEN
        v_staff_created := v_staff_created + 1;
        CONTINUE;
      END IF;

      -- Upsert sport_event
      SELECT id INTO v_sport_event_id
        FROM public.sport_events
        WHERE sport_id = (v_enrollment.value->>'sport_id')::uuid
          AND category_id = (v_enrollment.value->>'category_id')::uuid
          AND event_id = v_event_id
          AND slug = v_enrollment.value->>'sport_event_slug'
        LIMIT 1;

      IF v_sport_event_id IS NOT NULL THEN
        v_sport_events_reused := v_sport_events_reused + 1;
      ELSE
        INSERT INTO public.sport_events (event_id, sport_id, category_id, name, slug)
        VALUES (
          v_event_id,
          (v_enrollment.value->>'sport_id')::uuid,
          (v_enrollment.value->>'category_id')::uuid,
          v_enrollment.value->>'sport_event_name',
          v_enrollment.value->>'sport_event_slug'
        )
        RETURNING id INTO v_sport_event_id;
        v_sport_events_created := v_sport_events_created + 1;
      END IF;

      -- Insert participant_sport_event (pode disparar trigger C1)
      INSERT INTO public.participant_sport_events (participant_id, sport_event_id, status)
      VALUES (v_participant_id, v_sport_event_id, 'confirmed')
      ON CONFLICT (participant_id, sport_event_id) DO NOTHING;

      IF FOUND THEN
        v_enrollments_created := v_enrollments_created + 1;
      ELSE
        v_enrollments_skipped := v_enrollments_skipped + 1;
      END IF;

    EXCEPTION
      WHEN others THEN
        v_failed := v_failed + 1;

        GET STACKED DIAGNOSTICS
          v_err_msg  = MESSAGE_TEXT,
          v_err_code = RETURNED_SQLSTATE;

        INSERT INTO public.import_row_errors (event_id, row_number, entity, error_code, error_message, payload)
        VALUES (
          v_event_id, v_idx_enroll, 'enrollment', v_err_code, v_err_msg,
          jsonb_build_object('person_key', v_enrollment.value->>'person_key',
                            'sport_id', v_enrollment.value->>'sport_id',
                            'category_id', v_enrollment.value->>'category_id')
        );

        IF jsonb_array_length(v_errors) < 50 THEN
          v_errors := v_errors || jsonb_build_array(
            jsonb_build_object(
              'phase', 'enrollment',
              'row', v_idx_enroll,
              'code', v_err_code,
              'message', v_err_msg,
              'person_key', v_enrollment.value->>'person_key'
            )
          );
        END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'created', jsonb_build_object(
      'people', v_people_created,
      'participants', v_participants_created,
      'sport_events', v_sport_events_created,
      'participant_sport_events', v_enrollments_created,
      'staff', v_staff_created
    ),
    'skipped', jsonb_build_object(
      'people_existing', v_people_reused,
      'participants_existing', v_participants_reused,
      'sport_events_existing', v_sport_events_reused,
      'duplicate_enrollments', v_enrollments_skipped
    ),
    'failed_count', v_failed,
    'errors_preview', v_errors
  );
END;
$function$;
