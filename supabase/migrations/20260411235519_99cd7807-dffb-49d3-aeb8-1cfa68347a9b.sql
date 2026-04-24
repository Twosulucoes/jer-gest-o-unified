DO $$
DECLARE
  v_event_id uuid := 'ee66d634-8d2e-489c-9f8c-b07297dcd710';
  v_sport_event_id uuid := '67fa3de3-931d-4558-be1d-c7c65afd98ab';
  v_phase_id uuid := '1472854b-ead6-4bb1-938e-2696ef955c32';
  v_bulletin_id uuid := '4f935fb0-4fe1-4584-8f6d-ff127afc1a68';
  v_match_id uuid;
  v_pse RECORD;
  v_entry_id uuid;
  v_pos int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.competition_phases
    WHERE id = v_phase_id
  ) THEN
    RAISE NOTICE 'Skipping seed match: competition phase % not found', v_phase_id;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sport_events
    WHERE id = v_sport_event_id
  ) THEN
    RAISE NOTICE 'Skipping seed match: sport event % not found', v_sport_event_id;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.events
    WHERE id = v_event_id
  ) THEN
    RAISE NOTICE 'Skipping seed match: event % not found', v_event_id;
    RETURN;
  END IF;

  INSERT INTO public.competition_matches (
    event_id,
    phase_id,
    sport_event_id,
    match_number,
    status,
    match_date
  )
  VALUES (
    v_event_id,
    v_phase_id,
    v_sport_event_id,
    1,
    'finished',
    CURRENT_DATE
  )
  RETURNING id INTO v_match_id;

  FOR v_pse IN
    SELECT pse.id AS pse_id, pse.participant_id
    FROM public.participant_sport_events pse
    JOIN public.participants p ON p.id = pse.participant_id
    WHERE p.event_id = v_event_id
      AND pse.sport_event_id = v_sport_event_id
    ORDER BY pse.created_at
    LIMIT 6
  LOOP
    v_pos := v_pos + 1;

    INSERT INTO public.competition_match_entries (
      match_id,
      participant_sport_event_id,
      side
    )
    VALUES (
      v_match_id,
      v_pse.pse_id,
      'participant'
    )
    RETURNING id INTO v_entry_id;

    INSERT INTO public.competition_match_results (
      match_id,
      match_entry_id,
      position,
      points,
      outcome,
      time_ms,
      result_status,
      recorded_by,
      recorded_at,
      validated_at,
      published_at,
      published_bulletin_id
    )
    VALUES (
      v_match_id,
      v_entry_id,
      v_pos,
      7 - v_pos,
      CASE WHEN v_pos = 1 THEN 'win' ELSE NULL END,
      11000 + (v_pos * 230),
      'published',
      '00000000-0000-0000-0000-000000000000',
      now(),
      now(),
      now(),
      v_bulletin_id
    );
  END LOOP;
END $$;