
-- 1) rpc_get_competition_summary
CREATE OR REPLACE FUNCTION public.rpc_get_competition_summary(
  p_event_id uuid,
  p_sport_event_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrolled_count int;
  v_teams_count int;
  v_matches_count int;
  v_matches_no_result int;
  v_is_collective boolean;
BEGIN
  SELECT s.is_collective INTO v_is_collective
  FROM sport_events se
  JOIN sports s ON s.id = se.sport_id
  WHERE se.id = p_sport_event_id AND se.event_id = p_event_id;

  SELECT count(*) INTO v_enrolled_count
  FROM participant_sport_events
  WHERE sport_event_id = p_sport_event_id;

  SELECT count(*) INTO v_teams_count
  FROM teams
  WHERE sport_event_id = p_sport_event_id AND event_id = p_event_id;

  SELECT count(*) INTO v_matches_count
  FROM competition_matches
  WHERE sport_event_id = p_sport_event_id AND event_id = p_event_id;

  SELECT count(*) INTO v_matches_no_result
  FROM competition_matches cm
  WHERE cm.sport_event_id = p_sport_event_id
    AND cm.event_id = p_event_id
    AND NOT EXISTS (
      SELECT 1 FROM competition_match_results cmr
      JOIN competition_match_entries cme ON cme.id = cmr.match_entry_id
      WHERE cme.match_id = cm.id
    );

  RETURN json_build_object(
    'is_collective', COALESCE(v_is_collective, false),
    'enrolled_count', v_enrolled_count,
    'teams_count', v_teams_count,
    'matches_count', v_matches_count,
    'matches_no_result', v_matches_no_result
  );
END;
$$;

-- 2) rpc_generate_groups
CREATE OR REPLACE FUNCTION public.rpc_generate_groups(
  p_event_id uuid,
  p_sport_event_id uuid,
  p_phase_id uuid,
  p_group_count int,
  p_seed_mode text DEFAULT 'random'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_teams uuid[];
  v_pse_ids uuid[];
  v_is_collective boolean;
  v_idx int := 0;
  v_item uuid;
BEGIN
  SELECT s.is_collective INTO v_is_collective
  FROM sport_events se JOIN sports s ON s.id = se.sport_id
  WHERE se.id = p_sport_event_id;

  -- Create groups
  FOR i IN 1..p_group_count LOOP
    INSERT INTO competition_groups (event_id, phase_id, name, sort_order)
    VALUES (p_event_id, p_phase_id, 'Grupo ' || chr(64 + i), i);
  END LOOP;

  RETURN json_build_object('groups_created', p_group_count);
END;
$$;

-- 3) rpc_generate_matches_collective (round robin within each group or phase)
CREATE OR REPLACE FUNCTION public.rpc_generate_matches_collective(
  p_event_id uuid,
  p_sport_event_id uuid,
  p_phase_id uuid,
  p_group_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group record;
  v_teams uuid[];
  v_match_id uuid;
  v_match_num int := 1;
  v_total int := 0;
  i int;
  j int;
BEGIN
  -- Delete existing non-started matches for this scope
  DELETE FROM competition_match_entries
  WHERE match_id IN (
    SELECT id FROM competition_matches
    WHERE event_id = p_event_id
      AND sport_event_id = p_sport_event_id
      AND phase_id = p_phase_id
      AND (p_group_id IS NULL OR group_id = p_group_id)
      AND status = 'scheduled'
  );
  DELETE FROM competition_matches
  WHERE event_id = p_event_id
    AND sport_event_id = p_sport_event_id
    AND phase_id = p_phase_id
    AND (p_group_id IS NULL OR group_id = p_group_id)
    AND status = 'scheduled';

  FOR v_group IN
    SELECT id FROM competition_groups
    WHERE event_id = p_event_id AND phase_id = p_phase_id
      AND (p_group_id IS NULL OR id = p_group_id)
    ORDER BY sort_order
  LOOP
    SELECT array_agg(t.id ORDER BY t.name)
    INTO v_teams
    FROM teams t
    WHERE t.sport_event_id = p_sport_event_id AND t.event_id = p_event_id;

    IF v_teams IS NULL OR array_length(v_teams, 1) < 2 THEN
      CONTINUE;
    END IF;

    -- Round robin
    FOR i IN 1..array_length(v_teams, 1) LOOP
      FOR j IN (i+1)..array_length(v_teams, 1) LOOP
        INSERT INTO competition_matches (event_id, phase_id, group_id, sport_event_id, match_number, status)
        VALUES (p_event_id, p_phase_id, v_group.id, p_sport_event_id, v_match_num, 'scheduled')
        RETURNING id INTO v_match_id;

        INSERT INTO competition_match_entries (match_id, team_id, side)
        VALUES (v_match_id, v_teams[i], 'home'),
               (v_match_id, v_teams[j], 'away');

        v_match_num := v_match_num + 1;
        v_total := v_total + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN json_build_object('matches_created', v_total);
END;
$$;

-- 4) rpc_generate_matches_individual (heats/baterias)
CREATE OR REPLACE FUNCTION public.rpc_generate_matches_individual(
  p_event_id uuid,
  p_sport_event_id uuid,
  p_phase_id uuid,
  p_heat_size int DEFAULT 8
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pse_ids uuid[];
  v_match_id uuid;
  v_match_num int := 1;
  v_total int := 0;
  v_batch_start int;
  v_batch_end int;
  v_group_id uuid;
BEGIN
  -- Delete existing non-started matches
  DELETE FROM competition_match_entries
  WHERE match_id IN (
    SELECT id FROM competition_matches
    WHERE event_id = p_event_id
      AND sport_event_id = p_sport_event_id
      AND phase_id = p_phase_id
      AND status = 'scheduled'
  );
  DELETE FROM competition_matches
  WHERE event_id = p_event_id
    AND sport_event_id = p_sport_event_id
    AND phase_id = p_phase_id
    AND status = 'scheduled';

  -- Get first group if exists
  SELECT id INTO v_group_id
  FROM competition_groups
  WHERE event_id = p_event_id AND phase_id = p_phase_id
  ORDER BY sort_order LIMIT 1;

  -- Get enrolled participants
  SELECT array_agg(id ORDER BY random())
  INTO v_pse_ids
  FROM participant_sport_events
  WHERE sport_event_id = p_sport_event_id
    AND status IN ('confirmed', 'approved', 'valid', 'active');

  IF v_pse_ids IS NULL OR array_length(v_pse_ids, 1) = 0 THEN
    RETURN json_build_object('matches_created', 0, 'message', 'Nenhum inscrito válido encontrado');
  END IF;

  v_batch_start := 1;
  WHILE v_batch_start <= array_length(v_pse_ids, 1) LOOP
    v_batch_end := LEAST(v_batch_start + p_heat_size - 1, array_length(v_pse_ids, 1));

    INSERT INTO competition_matches (event_id, phase_id, group_id, sport_event_id, match_number, status)
    VALUES (p_event_id, p_phase_id, v_group_id, p_sport_event_id, v_match_num, 'scheduled')
    RETURNING id INTO v_match_id;

    FOR idx IN v_batch_start..v_batch_end LOOP
      INSERT INTO competition_match_entries (match_id, participant_sport_event_id, side, seed)
      VALUES (v_match_id, v_pse_ids[idx], 'participant', idx - v_batch_start + 1);
    END LOOP;

    v_match_num := v_match_num + 1;
    v_total := v_total + 1;
    v_batch_start := v_batch_end + 1;
  END LOOP;

  RETURN json_build_object('matches_created', v_total);
END;
$$;

-- 5) rpc_list_eligibility_pending
CREATE OR REPLACE FUNCTION public.rpc_list_eligibility_pending(
  p_event_id uuid,
  p_sport_event_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO v_result
  FROM (
    SELECT
      pse.id AS pse_id,
      pse.participant_id,
      p.full_name,
      pse.status AS enrollment_status,
      CASE WHEN pc.id IS NOT NULL AND pc.status = 'active' THEN true ELSE false END AS has_active_credential,
      CASE WHEN pi_block.id IS NOT NULL THEN true ELSE false END AS has_blocking_irregularity,
      COALESCE(pi_block.message, '') AS irregularity_message
    FROM participant_sport_events pse
    JOIN participants part ON part.id = pse.participant_id AND part.event_id = p_event_id
    JOIN people p ON p.id = part.person_id
    LEFT JOIN participant_credentials pc ON pc.participant_id = pse.participant_id
      AND pc.event_id = p_event_id AND pc.status = 'active'
    LEFT JOIN participation_irregularities pi_block ON pi_block.participant_id = pse.participant_id
      AND pi_block.event_id = p_event_id AND pi_block.status = 'open' AND pi_block.severity = 'blocking'
    WHERE pse.sport_event_id = p_sport_event_id
      AND (
        pc.id IS NULL
        OR pc.status != 'active'
        OR pse.status NOT IN ('confirmed', 'approved', 'valid', 'active')
        OR pi_block.id IS NOT NULL
      )
    ORDER BY p.full_name
  ) t;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
