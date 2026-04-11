
-- ============================================================
-- B) Updated rpc_generate_matches_individual with eligibility skip
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_generate_matches_individual(
  p_event_id uuid, p_sport_event_id uuid, p_phase_id uuid, p_heat_size integer DEFAULT 8
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_all_pse_ids uuid[];
  v_eligible_pse_ids uuid[];
  v_skipped jsonb := '[]'::jsonb;
  v_match_id uuid;
  v_match_num int := 1;
  v_total_matches int := 0;
  v_total_entries int := 0;
  v_batch_start int;
  v_batch_end int;
  v_group_id uuid;
  v_pse record;
  v_has_credential boolean;
  v_has_blocking boolean;
  v_blocking_count int;
BEGIN
  -- Check if regeneration is safe
  IF EXISTS (
    SELECT 1 FROM competition_match_results cmr
    JOIN competition_match_entries cme ON cme.id = cmr.match_entry_id
    JOIN competition_matches cm ON cm.id = cme.match_id
    WHERE cm.event_id = p_event_id AND cm.sport_event_id = p_sport_event_id
  ) THEN
    RAISE EXCEPTION 'Não é possível regenerar: existem resultados lançados para esta prova. Remova os resultados primeiro.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Delete existing non-started matches
  DELETE FROM competition_match_entries
  WHERE match_id IN (
    SELECT id FROM competition_matches
    WHERE event_id = p_event_id AND sport_event_id = p_sport_event_id
      AND phase_id = p_phase_id AND status = 'scheduled'
  );
  DELETE FROM competition_matches
  WHERE event_id = p_event_id AND sport_event_id = p_sport_event_id
    AND phase_id = p_phase_id AND status = 'scheduled';

  SELECT id INTO v_group_id
  FROM competition_groups
  WHERE event_id = p_event_id AND phase_id = p_phase_id
  ORDER BY sort_order LIMIT 1;

  -- Check eligibility for each enrolled participant
  v_eligible_pse_ids := ARRAY[]::uuid[];

  FOR v_pse IN
    SELECT pse.id AS pse_id, pse.participant_id, pse.status AS pse_status,
           p.full_name
    FROM participant_sport_events pse
    JOIN participants part ON part.id = pse.participant_id AND part.event_id = p_event_id
    JOIN people p ON p.id = part.person_id
    WHERE pse.sport_event_id = p_sport_event_id
    ORDER BY random()
  LOOP
    -- Check enrollment status
    IF v_pse.pse_status NOT IN ('confirmed','approved','valid','active') THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'participant_id', v_pse.participant_id,
        'participant_sport_event_id', v_pse.pse_id,
        'full_name', v_pse.full_name,
        'reason', 'ENROLLMENT_INVALID'
      ));
      CONTINUE;
    END IF;

    -- Check credential
    SELECT EXISTS (
      SELECT 1 FROM participant_credentials pc
      WHERE pc.participant_id = v_pse.participant_id
        AND pc.event_id = p_event_id AND pc.status = 'active'
    ) INTO v_has_credential;

    IF NOT v_has_credential THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'participant_id', v_pse.participant_id,
        'participant_sport_event_id', v_pse.pse_id,
        'full_name', v_pse.full_name,
        'reason', 'NO_CREDENTIAL'
      ));
      CONTINUE;
    END IF;

    -- Check blocking irregularity
    SELECT EXISTS (
      SELECT 1 FROM participation_irregularities pi
      WHERE pi.participant_id = v_pse.participant_id
        AND pi.event_id = p_event_id AND pi.status = 'open' AND pi.severity = 'blocking'
    ) INTO v_has_blocking;

    IF v_has_blocking THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'participant_id', v_pse.participant_id,
        'participant_sport_event_id', v_pse.pse_id,
        'full_name', v_pse.full_name,
        'reason', 'BLOCKING_IRREGULARITY'
      ));
      CONTINUE;
    END IF;

    v_eligible_pse_ids := array_append(v_eligible_pse_ids, v_pse.pse_id);
  END LOOP;

  IF array_length(v_eligible_pse_ids, 1) IS NULL OR array_length(v_eligible_pse_ids, 1) = 0 THEN
    RETURN json_build_object(
      'matches_created', 0, 'entries_created', 0,
      'entries_skipped', jsonb_array_length(v_skipped),
      'skipped_preview', v_skipped,
      'message', 'Nenhum inscrito elegível encontrado'
    );
  END IF;

  v_batch_start := 1;
  WHILE v_batch_start <= array_length(v_eligible_pse_ids, 1) LOOP
    v_batch_end := LEAST(v_batch_start + p_heat_size - 1, array_length(v_eligible_pse_ids, 1));

    INSERT INTO competition_matches (event_id, phase_id, group_id, sport_event_id, match_number, status)
    VALUES (p_event_id, p_phase_id, v_group_id, p_sport_event_id, v_match_num, 'scheduled')
    RETURNING id INTO v_match_id;

    FOR idx IN v_batch_start..v_batch_end LOOP
      INSERT INTO competition_match_entries (match_id, participant_sport_event_id, side, seed)
      VALUES (v_match_id, v_eligible_pse_ids[idx], 'participant', idx - v_batch_start + 1);
      v_total_entries := v_total_entries + 1;
    END LOOP;

    v_match_num := v_match_num + 1;
    v_total_matches := v_total_matches + 1;
    v_batch_start := v_batch_end + 1;
  END LOOP;

  RETURN json_build_object(
    'matches_created', v_total_matches,
    'entries_created', v_total_entries,
    'entries_skipped', jsonb_array_length(v_skipped),
    'skipped_preview', v_skipped
  );
END;
$function$;

-- ============================================================
-- B) Updated rpc_generate_matches_collective with eligibility skip
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_generate_matches_collective(
  p_event_id uuid, p_sport_event_id uuid, p_phase_id uuid, p_group_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_group record;
  v_all_teams uuid[];
  v_eligible_teams uuid[];
  v_skipped jsonb := '[]'::jsonb;
  v_match_id uuid;
  v_match_num int := 1;
  v_total int := 0;
  v_total_entries int := 0;
  v_team record;
  v_invalid_members int;
  v_blocking_members int;
  i int;
  j int;
BEGIN
  -- Check if regeneration is safe
  IF EXISTS (
    SELECT 1 FROM competition_match_results cmr
    JOIN competition_match_entries cme ON cme.id = cmr.match_entry_id
    JOIN competition_matches cm ON cm.id = cme.match_id
    WHERE cm.event_id = p_event_id AND cm.sport_event_id = p_sport_event_id
  ) THEN
    RAISE EXCEPTION 'Não é possível regenerar: existem resultados lançados para esta prova. Remova os resultados primeiro.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Delete existing non-started matches
  DELETE FROM competition_match_entries
  WHERE match_id IN (
    SELECT id FROM competition_matches
    WHERE event_id = p_event_id AND sport_event_id = p_sport_event_id
      AND phase_id = p_phase_id
      AND (p_group_id IS NULL OR group_id = p_group_id)
      AND status = 'scheduled'
  );
  DELETE FROM competition_matches
  WHERE event_id = p_event_id AND sport_event_id = p_sport_event_id
    AND phase_id = p_phase_id
    AND (p_group_id IS NULL OR group_id = p_group_id)
    AND status = 'scheduled';

  -- Check eligibility for each team
  v_eligible_teams := ARRAY[]::uuid[];

  FOR v_team IN
    SELECT t.id, t.name
    FROM teams t
    WHERE t.sport_event_id = p_sport_event_id AND t.event_id = p_event_id
    ORDER BY t.name
  LOOP
    -- Check members without active credential
    SELECT COUNT(*) INTO v_invalid_members
    FROM team_members tm
    LEFT JOIN participant_credentials pc
      ON pc.participant_id = tm.participant_id
      AND pc.event_id = p_event_id AND pc.status = 'active'
    WHERE tm.team_id = v_team.id AND tm.is_active = true AND pc.id IS NULL;

    -- Check members with blocking irregularity
    SELECT COUNT(*) INTO v_blocking_members
    FROM team_members tm
    JOIN participation_irregularities pi
      ON pi.participant_id = tm.participant_id
      AND pi.event_id = p_event_id AND pi.status = 'open' AND pi.severity = 'blocking'
    WHERE tm.team_id = v_team.id AND tm.is_active = true;

    IF v_invalid_members > 0 THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'team_id', v_team.id, 'team_name', v_team.name,
        'reason', 'NO_CREDENTIAL', 'members_affected', v_invalid_members
      ));
      CONTINUE;
    END IF;

    IF v_blocking_members > 0 THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'team_id', v_team.id, 'team_name', v_team.name,
        'reason', 'BLOCKING_IRREGULARITY', 'members_affected', v_blocking_members
      ));
      CONTINUE;
    END IF;

    v_eligible_teams := array_append(v_eligible_teams, v_team.id);
  END LOOP;

  IF array_length(v_eligible_teams, 1) IS NULL OR array_length(v_eligible_teams, 1) < 2 THEN
    RETURN json_build_object(
      'matches_created', 0, 'entries_created', 0,
      'teams_skipped', jsonb_array_length(v_skipped),
      'skipped_preview', v_skipped,
      'message', 'Menos de 2 equipes elegíveis'
    );
  END IF;

  FOR v_group IN
    SELECT id FROM competition_groups
    WHERE event_id = p_event_id AND phase_id = p_phase_id
      AND (p_group_id IS NULL OR id = p_group_id)
    ORDER BY sort_order
  LOOP
    FOR i IN 1..array_length(v_eligible_teams, 1) LOOP
      FOR j IN (i+1)..array_length(v_eligible_teams, 1) LOOP
        INSERT INTO competition_matches (event_id, phase_id, group_id, sport_event_id, match_number, status)
        VALUES (p_event_id, p_phase_id, v_group.id, p_sport_event_id, v_match_num, 'scheduled')
        RETURNING id INTO v_match_id;

        INSERT INTO competition_match_entries (match_id, team_id, side)
        VALUES (v_match_id, v_eligible_teams[i], 'home'),
               (v_match_id, v_eligible_teams[j], 'away');

        v_match_num := v_match_num + 1;
        v_total := v_total + 1;
        v_total_entries := v_total_entries + 2;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN json_build_object(
    'matches_created', v_total,
    'entries_created', v_total_entries,
    'teams_skipped', jsonb_array_length(v_skipped),
    'skipped_preview', v_skipped
  );
END;
$function$;

-- ============================================================
-- B) Updated rpc_list_eligibility_pending with extended fields
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_list_eligibility_pending(p_event_id uuid, p_sport_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result json;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO v_result
  FROM (
    SELECT
      pse.id AS pse_id,
      pse.participant_id,
      part.person_id,
      part.delegation_id,
      p.full_name,
      inst.name AS institution_name,
      pse.status AS enrollment_status,
      CASE WHEN pc.id IS NOT NULL AND pc.status = 'active' THEN true ELSE false END AS has_active_credential,
      CASE WHEN pi_block.id IS NOT NULL THEN true ELSE false END AS has_blocking_irregularity,
      COALESCE(pi_block.message, '') AS irregularity_message,
      CASE
        WHEN pc.id IS NULL OR pc.status != 'active' THEN 'NO_CREDENTIAL'
        WHEN pse.status NOT IN ('confirmed','approved','valid','active') THEN 'ENROLLMENT_INVALID'
        WHEN pi_block.id IS NOT NULL THEN 'BLOCKING_IRREGULARITY'
        ELSE 'UNKNOWN'
      END AS reason_code
    FROM participant_sport_events pse
    JOIN participants part ON part.id = pse.participant_id AND part.event_id = p_event_id
    JOIN people p ON p.id = part.person_id
    LEFT JOIN delegations del ON del.id = part.delegation_id
    LEFT JOIN institutions inst ON inst.id = del.institution_id
    LEFT JOIN participant_credentials pc ON pc.participant_id = pse.participant_id
      AND pc.event_id = p_event_id AND pc.status = 'active'
    LEFT JOIN LATERAL (
      SELECT pi.id, pi.message FROM participation_irregularities pi
      WHERE pi.participant_id = pse.participant_id
        AND pi.event_id = p_event_id AND pi.status = 'open' AND pi.severity = 'blocking'
      LIMIT 1
    ) pi_block ON true
    WHERE pse.sport_event_id = p_sport_event_id
      AND (
        pc.id IS NULL
        OR pse.status NOT IN ('confirmed','approved','valid','active')
        OR pi_block.id IS NOT NULL
      )
    ORDER BY p.full_name
  ) t;

  RETURN COALESCE(v_result, '[]'::json);
END;
$function$;

-- ============================================================
-- C) rpc_can_regenerate_matches
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_can_regenerate_matches(p_event_id uuid, p_sport_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(DISTINCT cm.id) INTO v_count
  FROM competition_matches cm
  JOIN competition_match_entries cme ON cme.match_id = cm.id
  JOIN competition_match_results cmr ON cmr.match_entry_id = cme.id
  WHERE cm.event_id = p_event_id AND cm.sport_event_id = p_sport_event_id;

  IF v_count > 0 THEN
    RETURN json_build_object(
      'can_regenerate', false,
      'reason', format('%s partida(s) já possuem resultado lançado. Remova os resultados antes de regenerar.', v_count),
      'blocking_matches_count', v_count
    );
  END IF;

  RETURN json_build_object(
    'can_regenerate', true,
    'reason', '',
    'blocking_matches_count', 0
  );
END;
$function$;

-- ============================================================
-- A) rpc_launch_match_result
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_launch_match_result(p_event_id uuid, p_match_id uuid, p_payload jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_match record;
  v_entry record;
  v_entry_data jsonb;
  v_results_count int := 0;
BEGIN
  -- Validate match belongs to event
  SELECT * INTO v_match FROM competition_matches
  WHERE id = p_match_id AND event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada para este evento' USING ERRCODE = 'P0001';
  END IF;

  -- Process each entry result from payload
  -- payload format: { "entries": [{ "match_entry_id": "...", "outcome": "win", "score": "2x1", "time_ms": null, "distance_cm": null, "points": null, "position": null }] }
  FOR v_entry_data IN SELECT * FROM jsonb_array_elements(p_payload->'entries')
  LOOP
    -- Verify entry belongs to this match
    SELECT * INTO v_entry FROM competition_match_entries
    WHERE id = (v_entry_data->>'match_entry_id')::uuid AND match_id = p_match_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Entry % não pertence à partida %', v_entry_data->>'match_entry_id', p_match_id
        USING ERRCODE = 'P0001';
    END IF;

    -- Upsert result
    INSERT INTO competition_match_results (
      match_id, match_entry_id, outcome, score, time_ms, distance_cm, points, position,
      result_status, recorded_by, recorded_at
    ) VALUES (
      p_match_id,
      (v_entry_data->>'match_entry_id')::uuid,
      v_entry_data->>'outcome',
      v_entry_data->>'score',
      (v_entry_data->>'time_ms')::int,
      (v_entry_data->>'distance_cm')::int,
      (v_entry_data->>'points')::numeric,
      (v_entry_data->>'position')::int,
      'launched',
      COALESCE(auth.uid()::text, 'system'),
      now()
    )
    ON CONFLICT (match_entry_id) DO UPDATE SET
      outcome = EXCLUDED.outcome,
      score = EXCLUDED.score,
      time_ms = EXCLUDED.time_ms,
      distance_cm = EXCLUDED.distance_cm,
      points = EXCLUDED.points,
      position = EXCLUDED.position,
      result_status = 'launched',
      recorded_by = EXCLUDED.recorded_by,
      recorded_at = now(),
      updated_at = now();

    v_results_count := v_results_count + 1;
  END LOOP;

  -- Mark match as finished
  UPDATE competition_matches SET status = 'finished', updated_at = now()
  WHERE id = p_match_id;

  RETURN json_build_object(
    'ok', true,
    'match_id', p_match_id,
    'results_saved', v_results_count
  );
END;
$function$;

-- ============================================================
-- D) rpc_detect_schedule_conflicts
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_detect_schedule_conflicts(p_event_id uuid, p_sport_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_venue_conflicts json;
  v_team_conflicts json;
  v_participant_conflicts json;
BEGIN
  -- Venue conflicts: same venue, same date+time, different matches
  SELECT json_agg(row_to_json(sub)) INTO v_venue_conflicts
  FROM (
    SELECT cm1.venue_id, v.name AS venue_name, cm1.match_date, cm1.start_time,
           json_agg(json_build_object('match_id', cm1.id, 'match_number', cm1.match_number)) AS matches
    FROM competition_matches cm1
    JOIN venues v ON v.id = cm1.venue_id
    WHERE cm1.event_id = p_event_id
      AND (p_sport_event_id IS NULL OR cm1.sport_event_id = p_sport_event_id)
      AND cm1.venue_id IS NOT NULL
      AND cm1.match_date IS NOT NULL
      AND cm1.start_time IS NOT NULL
    GROUP BY cm1.venue_id, v.name, cm1.match_date, cm1.start_time
    HAVING COUNT(*) > 1
  ) sub;

  -- Team conflicts: same team in different matches at same date+time
  SELECT json_agg(row_to_json(sub)) INTO v_team_conflicts
  FROM (
    SELECT cme.team_id, t.name AS team_name, cm.match_date, cm.start_time,
           json_agg(json_build_object('match_id', cm.id, 'match_number', cm.match_number)) AS matches
    FROM competition_match_entries cme
    JOIN competition_matches cm ON cm.id = cme.match_id
    JOIN teams t ON t.id = cme.team_id
    WHERE cm.event_id = p_event_id
      AND (p_sport_event_id IS NULL OR cm.sport_event_id = p_sport_event_id)
      AND cme.team_id IS NOT NULL
      AND cm.match_date IS NOT NULL
      AND cm.start_time IS NOT NULL
    GROUP BY cme.team_id, t.name, cm.match_date, cm.start_time
    HAVING COUNT(DISTINCT cm.id) > 1
  ) sub;

  -- Participant conflicts: same participant in different matches at same date+time
  SELECT json_agg(row_to_json(sub)) INTO v_participant_conflicts
  FROM (
    SELECT cme.participant_sport_event_id, p.full_name, cm.match_date, cm.start_time,
           json_agg(json_build_object('match_id', cm.id, 'match_number', cm.match_number)) AS matches
    FROM competition_match_entries cme
    JOIN competition_matches cm ON cm.id = cme.match_id
    JOIN participant_sport_events pse ON pse.id = cme.participant_sport_event_id
    JOIN participants part ON part.id = pse.participant_id
    JOIN people p ON p.id = part.person_id
    WHERE cm.event_id = p_event_id
      AND (p_sport_event_id IS NULL OR cm.sport_event_id = p_sport_event_id)
      AND cme.participant_sport_event_id IS NOT NULL
      AND cm.match_date IS NOT NULL
      AND cm.start_time IS NOT NULL
    GROUP BY cme.participant_sport_event_id, p.full_name, cm.match_date, cm.start_time
    HAVING COUNT(DISTINCT cm.id) > 1
  ) sub;

  RETURN json_build_object(
    'venue_conflicts', COALESCE(v_venue_conflicts, '[]'::json),
    'team_conflicts', COALESCE(v_team_conflicts, '[]'::json),
    'participant_conflicts', COALESCE(v_participant_conflicts, '[]'::json)
  );
END;
$function$;
