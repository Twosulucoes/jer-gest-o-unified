
CREATE OR REPLACE FUNCTION public.rpc_generate_matches_collective(
  p_event_id uuid,
  p_sport_event_id uuid,
  p_phase_id uuid,
  p_group_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_group record;
  v_group_teams uuid[];
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

  -- Iterate over groups in this phase
  FOR v_group IN
    SELECT id FROM competition_groups
    WHERE event_id = p_event_id AND phase_id = p_phase_id
      AND (p_group_id IS NULL OR id = p_group_id)
    ORDER BY sort_order
  LOOP
    -- Get teams allocated to THIS group via group_draw_lots
    SELECT array_agg(gdl.team_id ORDER BY gdl.seed)
    INTO v_group_teams
    FROM group_draw_lots gdl
    WHERE gdl.group_id = v_group.id;

    -- If no teams allocated to this group, skip it
    IF v_group_teams IS NULL OR array_length(v_group_teams, 1) IS NULL THEN
      CONTINUE;
    END IF;

    -- Filter eligible teams within this group
    v_eligible_teams := ARRAY[]::uuid[];

    FOR v_team IN
      SELECT t.id, t.name
      FROM teams t
      WHERE t.id = ANY(v_group_teams)
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

    -- Generate round-robin matches for eligible teams in this group
    IF array_length(v_eligible_teams, 1) IS NOT NULL AND array_length(v_eligible_teams, 1) >= 2 THEN
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
    END IF;
  END LOOP;

  RETURN json_build_object(
    'matches_created', v_total,
    'entries_created', v_total_entries,
    'teams_skipped', jsonb_array_length(v_skipped),
    'skipped_preview', v_skipped
  );
END;
$function$;
