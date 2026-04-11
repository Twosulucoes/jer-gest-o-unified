
CREATE OR REPLACE FUNCTION public.rpc_sync_collective_teams(
  p_event_id uuid,
  p_sport_event_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_se record;
  v_group record;
  v_team_id uuid;
  v_team_name text;
  v_existing boolean;

  v_teams_created int := 0;
  v_teams_existing int := 0;
  v_members_added int := 0;
  v_members_existing int := 0;
  v_skipped jsonb := '[]'::jsonb;
BEGIN
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'event_id obrigatório' USING ERRCODE = '22023';
  END IF;

  -- For each collective sport_event in the event
  FOR v_se IN
    SELECT se.id AS sport_event_id, se.name AS se_name, s.name AS sport_name
    FROM sport_events se
    JOIN sports s ON s.id = se.sport_id
    WHERE se.event_id = p_event_id
      AND s.is_collective = true
      AND (p_sport_event_id IS NULL OR se.id = p_sport_event_id)
    ORDER BY se.name
  LOOP
    -- For each delegation with enrolled participants
    FOR v_group IN
      SELECT DISTINCT part.delegation_id
      FROM participant_sport_events pse
      JOIN participants part ON part.id = pse.participant_id AND part.event_id = p_event_id
      WHERE pse.sport_event_id = v_se.sport_event_id
        AND part.delegation_id IS NOT NULL
    LOOP
      -- Build team name
      v_team_name := format('%s — %s', v_se.sport_name,
        COALESCE((
          SELECT i.name FROM institutions i
          JOIN delegations d ON d.institution_id = i.id
          WHERE d.id = v_group.delegation_id LIMIT 1
        ), 'Delegação'));

      -- Check if team already exists
      SELECT id INTO v_team_id FROM teams
      WHERE event_id = p_event_id
        AND sport_event_id = v_se.sport_event_id
        AND delegation_id = v_group.delegation_id;

      IF v_team_id IS NOT NULL THEN
        v_teams_existing := v_teams_existing + 1;
        -- Update name in case it changed
        UPDATE teams SET name = v_team_name, updated_at = now() WHERE id = v_team_id;
      ELSE
        INSERT INTO teams (event_id, sport_event_id, delegation_id, name, status)
        VALUES (p_event_id, v_se.sport_event_id, v_group.delegation_id, v_team_name, 'active')
        RETURNING id INTO v_team_id;
        v_teams_created := v_teams_created + 1;
      END IF;

      -- Now add members from this delegation enrolled in this sport_event
      DECLARE
        v_member record;
        v_pse_status text;
        v_has_blocking boolean;
      BEGIN
        FOR v_member IN
          SELECT pse.participant_id, pse.status AS pse_status
          FROM participant_sport_events pse
          JOIN participants part ON part.id = pse.participant_id AND part.event_id = p_event_id
          WHERE pse.sport_event_id = v_se.sport_event_id
            AND part.delegation_id = v_group.delegation_id
        LOOP
          -- Check enrollment status
          IF v_member.pse_status NOT IN ('confirmed','approved','valid','active') THEN
            IF jsonb_array_length(v_skipped) < 100 THEN
              v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
                'sport_event_id', v_se.sport_event_id,
                'participant_id', v_member.participant_id,
                'reason', 'ENROLLMENT_INVALID'
              ));
            END IF;
            CONTINUE;
          END IF;

          -- Check blocking irregularity
          SELECT EXISTS (
            SELECT 1 FROM participation_irregularities pi
            WHERE pi.event_id = p_event_id
              AND pi.participant_id = v_member.participant_id
              AND pi.status = 'open' AND pi.severity = 'blocking'
          ) INTO v_has_blocking;

          IF v_has_blocking THEN
            IF jsonb_array_length(v_skipped) < 100 THEN
              v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
                'sport_event_id', v_se.sport_event_id,
                'participant_id', v_member.participant_id,
                'reason', 'BLOCKING_IRREGULARITY'
              ));
            END IF;
            CONTINUE;
          END IF;

          -- Upsert member
          BEGIN
            INSERT INTO team_members (team_id, participant_id)
            VALUES (v_team_id, v_member.participant_id)
            ON CONFLICT (team_id, participant_id) DO NOTHING;

            IF FOUND THEN
              v_members_added := v_members_added + 1;
            ELSE
              v_members_existing := v_members_existing + 1;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            IF jsonb_array_length(v_skipped) < 100 THEN
              v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
                'team_id', v_team_id,
                'participant_id', v_member.participant_id,
                'reason', 'MEMBER_INSERT_ERROR',
                'message', SQLERRM
              ));
            END IF;
          END;
        END LOOP;
      END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'teams_created', v_teams_created,
    'teams_existing', v_teams_existing,
    'members_added', v_members_added,
    'members_existing', v_members_existing,
    'skipped_count', jsonb_array_length(v_skipped),
    'skipped_preview', v_skipped
  );
END;
$function$;
