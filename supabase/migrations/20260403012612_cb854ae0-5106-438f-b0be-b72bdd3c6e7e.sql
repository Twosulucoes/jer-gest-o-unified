
CREATE OR REPLACE FUNCTION public.import_inscricoes_batch(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  v_person_key text;
  v_person_map jsonb := '{}'::jsonb;
BEGIN
  v_event_id := (payload->>'event_id')::uuid;

  -- Phase 1: Upsert people
  FOR v_person IN SELECT * FROM jsonb_array_elements(payload->'people_to_create')
  LOOP
    -- Try to find by CPF first
    IF v_person.value->>'cpf' IS NOT NULL THEN
      SELECT id INTO v_person_id
        FROM public.people
        WHERE cpf = v_person.value->>'cpf'
        LIMIT 1;
    END IF;

    -- If not found by CPF, try by name+dob+gender
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
      INSERT INTO public.people (full_name, birth_date, gender, cpf, institution_id)
      VALUES (
        v_person.value->>'full_name',
        (v_person.value->>'birth_date')::date,
        v_person.value->>'gender',
        v_person.value->>'cpf',
        NULLIF(v_person.value->>'institution_id', '')::uuid
      )
      RETURNING id INTO v_person_id;
      v_people_created := v_people_created + 1;
    END IF;

    -- Build person_key for mapping
    IF v_person.value->>'cpf' IS NOT NULL THEN
      v_person_key := v_person.value->>'cpf';
    ELSE
      v_person_key := lower(v_person.value->>'full_name') || '|' || v_person.value->>'birth_date' || '|' || v_person.value->>'gender';
    END IF;

    v_person_map := v_person_map || jsonb_build_object(v_person_key, v_person_id::text);
  END LOOP;

  -- Phase 2: Process enrollments
  FOR v_enrollment IN SELECT * FROM jsonb_array_elements(payload->'enrollments')
  LOOP
    v_person_key := v_enrollment.value->>'person_key';

    -- Resolve person_id from map or existing people
    IF v_person_map ? v_person_key THEN
      v_person_id := (v_person_map->>v_person_key)::uuid;
    ELSE
      -- Person already existed (was resolved as "reuse" by Edge Function)
      -- Try CPF match
      IF length(v_person_key) = 11 AND v_person_key ~ '^\d+$' THEN
        SELECT id INTO v_person_id FROM public.people WHERE cpf = v_person_key LIMIT 1;
      ELSE
        -- key format: "name|dob|gender"
        SELECT id INTO v_person_id FROM public.people
        WHERE lower(full_name) || '|' || birth_date::text || '|' || gender = v_person_key
        LIMIT 1;
      END IF;

      IF v_person_id IS NULL THEN
        RAISE EXCEPTION 'Person not found for key: %', v_person_key;
      END IF;
    END IF;

    -- Phase 2a: Upsert participant
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
        'athlete',
        'confirmed'
      )
      RETURNING id INTO v_participant_id;
      v_participants_created := v_participants_created + 1;
    END IF;

    -- Phase 2b: Upsert sport_event
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

    -- Phase 2c: Insert participant_sport_event
    INSERT INTO public.participant_sport_events (participant_id, sport_event_id, status)
    VALUES (v_participant_id, v_sport_event_id, 'confirmed')
    ON CONFLICT (participant_id, sport_event_id) DO NOTHING;

    IF FOUND THEN
      v_enrollments_created := v_enrollments_created + 1;
    ELSE
      v_enrollments_skipped := v_enrollments_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'created', jsonb_build_object(
      'people', v_people_created,
      'participants', v_participants_created,
      'sport_events', v_sport_events_created,
      'participant_sport_events', v_enrollments_created
    ),
    'skipped', jsonb_build_object(
      'people_existing', v_people_reused,
      'participants_existing', v_participants_reused,
      'sport_events_existing', v_sport_events_reused,
      'duplicate_enrollments', v_enrollments_skipped
    )
  );
END;
$$;
