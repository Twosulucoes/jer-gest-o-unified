
-- =============================================================
-- 0) Performance indexes
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_cm_event_sport_group_status
  ON public.competition_matches (event_id, sport_event_id, group_id, status);

CREATE INDEX IF NOT EXISTS idx_cme_match_id
  ON public.competition_match_entries (match_id);

CREATE INDEX IF NOT EXISTS idx_ms_match_id
  ON public.match_scores (match_id);

CREATE INDEX IF NOT EXISTS idx_cmr_match_id
  ON public.competition_match_results (match_id);

-- =============================================================
-- 1) rpc_extract_match_outcome
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_extract_match_outcome(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match record;
  v_entries jsonb;
  v_home_entry_id uuid;
  v_away_entry_id uuid;
  v_home_score int;
  v_away_score int;
  v_home_sets int;
  v_away_sets int;
  v_set_scores jsonb;
  v_wo boolean := false;
  v_finalized boolean := false;
  v_is_draw boolean := false;
  v_winner_entry_id uuid;
  v_home_outcome text;
  v_away_outcome text;
BEGIN
  SELECT * INTO v_match FROM competition_matches WHERE id = p_match_id;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('error', 'match_not_found');
  END IF;

  -- Get entries ordered by side (home=A first, away=B second)
  SELECT jsonb_agg(row_to_json(e)::jsonb ORDER BY e.side)
  INTO v_entries
  FROM (
    SELECT id, side, team_id, participant_sport_event_id
    FROM competition_match_entries
    WHERE match_id = p_match_id
    ORDER BY side
    LIMIT 2
  ) e;

  IF v_entries IS NULL OR jsonb_array_length(v_entries) < 2 THEN
    RETURN jsonb_build_object(
      'match_id', p_match_id,
      'finalized', false,
      'entries_count', COALESCE(jsonb_array_length(v_entries), 0)
    );
  END IF;

  v_home_entry_id := (v_entries->0->>'id')::uuid;
  v_away_entry_id := (v_entries->1->>'id')::uuid;

  -- Try match_scores first
  SELECT
    COALESCE(
      (SELECT ms.score_final::int FROM match_scores ms WHERE ms.match_id = p_match_id AND ms.match_entry_id = v_home_entry_id LIMIT 1),
      (SELECT (cmr.score)::int FROM competition_match_results cmr WHERE cmr.match_id = p_match_id AND cmr.match_entry_id = v_home_entry_id LIMIT 1)
    ),
    COALESCE(
      (SELECT ms.score_final::int FROM match_scores ms WHERE ms.match_id = p_match_id AND ms.match_entry_id = v_away_entry_id LIMIT 1),
      (SELECT (cmr.score)::int FROM competition_match_results cmr WHERE cmr.match_id = p_match_id AND cmr.match_entry_id = v_away_entry_id LIMIT 1)
    )
  INTO v_home_score, v_away_score;

  -- Get sets from score_detail
  SELECT
    (SELECT ms.score_detail FROM match_scores ms WHERE ms.match_id = p_match_id AND ms.match_entry_id = v_home_entry_id LIMIT 1)
  INTO v_set_scores;

  -- Get outcomes from match_scores or competition_match_results
  SELECT
    COALESCE(
      (SELECT ms.outcome FROM match_scores ms WHERE ms.match_id = p_match_id AND ms.match_entry_id = v_home_entry_id LIMIT 1),
      (SELECT cmr.outcome FROM competition_match_results cmr WHERE cmr.match_id = p_match_id AND cmr.match_entry_id = v_home_entry_id LIMIT 1)
    ),
    COALESCE(
      (SELECT ms.outcome FROM match_scores ms WHERE ms.match_id = p_match_id AND ms.match_entry_id = v_away_entry_id LIMIT 1),
      (SELECT cmr.outcome FROM competition_match_results cmr WHERE cmr.match_id = p_match_id AND cmr.match_entry_id = v_away_entry_id LIMIT 1)
    )
  INTO v_home_outcome, v_away_outcome;

  -- Determine finalized
  v_finalized := (v_match.status = 'finished') OR (v_home_score IS NOT NULL AND v_away_score IS NOT NULL) OR (v_home_outcome IS NOT NULL);

  IF NOT v_finalized THEN
    RETURN jsonb_build_object(
      'match_id', p_match_id,
      'finalized', false,
      'home_entry_id', v_home_entry_id,
      'away_entry_id', v_away_entry_id
    );
  END IF;

  -- Determine WO
  v_wo := (v_home_outcome IN ('wo','wo_win','wo_loss') OR v_away_outcome IN ('wo','wo_win','wo_loss'));

  -- Determine winner
  IF v_home_outcome = 'win' OR v_away_outcome = 'loss' OR v_away_outcome = 'wo_loss' THEN
    v_winner_entry_id := v_home_entry_id;
  ELSIF v_away_outcome = 'win' OR v_home_outcome = 'loss' OR v_home_outcome = 'wo_loss' THEN
    v_winner_entry_id := v_away_entry_id;
  ELSIF v_home_outcome = 'draw' OR v_away_outcome = 'draw' THEN
    v_is_draw := true;
  ELSIF v_home_score IS NOT NULL AND v_away_score IS NOT NULL THEN
    IF v_home_score > v_away_score THEN
      v_winner_entry_id := v_home_entry_id;
    ELSIF v_away_score > v_home_score THEN
      v_winner_entry_id := v_away_entry_id;
    ELSE
      v_is_draw := true;
    END IF;
  END IF;

  -- Count sets from score_detail if available
  IF v_set_scores IS NOT NULL AND jsonb_typeof(v_set_scores) = 'array' THEN
    v_home_sets := 0;
    v_away_sets := 0;
    FOR i IN 0..jsonb_array_length(v_set_scores)-1 LOOP
      IF (v_set_scores->i->>'home')::int > (v_set_scores->i->>'away')::int THEN
        v_home_sets := v_home_sets + 1;
      ELSIF (v_set_scores->i->>'away')::int > (v_set_scores->i->>'home')::int THEN
        v_away_sets := v_away_sets + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'match_id', p_match_id,
    'finalized', true,
    'home_entry_id', v_home_entry_id,
    'away_entry_id', v_away_entry_id,
    'winner_entry_id', v_winner_entry_id,
    'is_draw', v_is_draw,
    'wo', v_wo,
    'score', jsonb_build_object('home', v_home_score, 'away', v_away_score),
    'sets', CASE WHEN v_home_sets IS NOT NULL THEN
      jsonb_build_object('home', v_home_sets, 'away', v_away_sets, 'set_scores', COALESCE(v_set_scores, '[]'::jsonb))
    ELSE NULL END,
    'home_outcome', v_home_outcome,
    'away_outcome', v_away_outcome
  );
END;
$$;

-- =============================================================
-- 2) rpc_get_group_points_rules
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_get_group_points_rules(p_sport_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules jsonb;
  v_family text;
  v_format text;
  v_gp jsonb;
  v_tb jsonb;
  v_wo jsonb;
BEGIN
  SELECT ser.rules INTO v_rules
  FROM sport_event_rules ser
  WHERE ser.sport_event_id = p_sport_event_id AND ser.is_active = true
  LIMIT 1;

  IF v_rules IS NULL THEN
    -- Default for score family
    RETURN jsonb_build_object(
      'family', 'score',
      'format', 'group_stage',
      'group_points', jsonb_build_object('win',3,'draw',1,'loss',0,'wo_win',3,'wo_loss',0),
      'tie_breakers', '["points_table","head_to_head","goal_difference","goals_for","draw"]'::jsonb,
      'walkover_policy', NULL::jsonb,
      'source', 'default'
    );
  END IF;

  v_family := COALESCE(v_rules->>'family', 'score');
  v_format := COALESCE(v_rules->>'format', 'group_stage');
  v_gp := v_rules->'group_points';
  v_tb := v_rules->'tie_breakers';
  v_wo := v_rules->'scoring'->'walkover_policy';

  -- Apply defaults if missing
  IF v_gp IS NULL THEN
    IF v_family = 'sets' THEN
      v_gp := jsonb_build_object('win',2,'loss',1,'wo_win',2,'wo_loss',0);
    ELSE
      v_gp := jsonb_build_object('win',3,'draw',1,'loss',0,'wo_win',3,'wo_loss',0);
    END IF;
  END IF;

  IF v_tb IS NULL OR jsonb_array_length(v_tb) = 0 THEN
    IF v_family = 'sets' THEN
      v_tb := '["points_table","head_to_head","sets_quotient","points_quotient","draw"]'::jsonb;
    ELSE
      v_tb := '["points_table","head_to_head","goal_difference","goals_for","draw"]'::jsonb;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'family', v_family,
    'format', v_format,
    'group_points', v_gp,
    'tie_breakers', v_tb,
    'walkover_policy', v_wo,
    'source', 'db'
  );
END;
$$;

-- =============================================================
-- 3) rpc_compute_standings_score
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_compute_standings_score(
  p_event_id uuid,
  p_sport_event_id uuid,
  p_phase_id uuid DEFAULT NULL,
  p_group_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules jsonb;
  v_gp jsonb;
  v_tb jsonb;
  v_wo_policy jsonb;
  v_matches_count int := 0;
  v_matches_finalized int := 0;
  v_standings jsonb := '[]'::jsonb;
  v_match record;
  v_outcome jsonb;
  v_participants jsonb := '{}'::jsonb;
  v_pid text;
  v_home_id text;
  v_away_id text;
  v_home_score int;
  v_away_score int;
  v_winner text;
  v_is_draw boolean;
  v_is_wo boolean;
  v_home_pts int;
  v_away_pts int;
  v_result jsonb := '[]'::jsonb;
  v_ignored jsonb := '[]'::jsonb;
  v_p record;
  v_rank int;
  v_prev_key text;
  v_cur_key text;
BEGIN
  -- Get rules
  v_rules := rpc_get_group_points_rules(p_sport_event_id);
  v_gp := v_rules->'group_points';
  v_tb := v_rules->'tie_breakers';
  v_wo_policy := v_rules->'walkover_policy';

  -- Iterate through matches
  FOR v_match IN
    SELECT cm.id as match_id, cm.status
    FROM competition_matches cm
    WHERE cm.event_id = p_event_id
      AND cm.sport_event_id = p_sport_event_id
      AND (p_phase_id IS NULL OR cm.phase_id = p_phase_id)
      AND (p_group_id IS NULL OR cm.group_id = p_group_id)
  LOOP
    v_matches_count := v_matches_count + 1;
    v_outcome := rpc_extract_match_outcome(v_match.match_id);

    IF NOT (v_outcome->>'finalized')::boolean THEN
      CONTINUE;
    END IF;
    v_matches_finalized := v_matches_finalized + 1;

    v_home_id := v_outcome->>'home_entry_id';
    v_away_id := v_outcome->>'away_entry_id';

    -- Get team_id or participant_sport_event_id for labeling
    IF NOT v_participants ? v_home_id THEN
      v_participants := v_participants || jsonb_build_object(v_home_id, jsonb_build_object(
        'entry_id', v_home_id,
        'team_id', (SELECT cme.team_id FROM competition_match_entries cme WHERE cme.id = v_home_id::uuid),
        'pse_id', (SELECT cme.participant_sport_event_id FROM competition_match_entries cme WHERE cme.id = v_home_id::uuid),
        'played',0,'wins',0,'draws',0,'losses',0,
        'points_for',0,'points_against',0,'goal_diff',0,
        'points_table',0,'wo_for',0,'wo_against',0,
        'label', COALESCE(
          (SELECT t.name FROM teams t JOIN competition_match_entries cme ON cme.team_id = t.id WHERE cme.id = v_home_id::uuid LIMIT 1),
          (SELECT p.name FROM people p JOIN participants pt ON pt.person_id = p.id JOIN participant_sport_events pse ON pse.participant_id = pt.id JOIN competition_match_entries cme ON cme.participant_sport_event_id = pse.id WHERE cme.id = v_home_id::uuid LIMIT 1),
          v_home_id
        )
      ));
    END IF;
    IF NOT v_participants ? v_away_id THEN
      v_participants := v_participants || jsonb_build_object(v_away_id, jsonb_build_object(
        'entry_id', v_away_id,
        'team_id', (SELECT cme.team_id FROM competition_match_entries cme WHERE cme.id = v_away_id::uuid),
        'pse_id', (SELECT cme.participant_sport_event_id FROM competition_match_entries cme WHERE cme.id = v_away_id::uuid),
        'played',0,'wins',0,'draws',0,'losses',0,
        'points_for',0,'points_against',0,'goal_diff',0,
        'points_table',0,'wo_for',0,'wo_against',0,
        'label', COALESCE(
          (SELECT t.name FROM teams t JOIN competition_match_entries cme ON cme.team_id = t.id WHERE cme.id = v_away_id::uuid LIMIT 1),
          (SELECT p.name FROM people p JOIN participants pt ON pt.person_id = p.id JOIN participant_sport_events pse ON pse.participant_id = pt.id JOIN competition_match_entries cme ON cme.participant_sport_event_id = pse.id WHERE cme.id = v_away_id::uuid LIMIT 1),
          v_away_id
        )
      ));
    END IF;

    v_home_score := COALESCE((v_outcome->'score'->>'home')::int, 0);
    v_away_score := COALESCE((v_outcome->'score'->>'away')::int, 0);
    v_is_draw := COALESCE((v_outcome->>'is_draw')::boolean, false);
    v_is_wo := COALESCE((v_outcome->>'wo')::boolean, false);
    v_winner := v_outcome->>'winner_entry_id';

    -- Update home participant
    v_participants := jsonb_set(v_participants, ARRAY[v_home_id, 'played'],
      to_jsonb((v_participants->v_home_id->>'played')::int + 1));
    v_participants := jsonb_set(v_participants, ARRAY[v_home_id, 'points_for'],
      to_jsonb((v_participants->v_home_id->>'points_for')::int + v_home_score));
    v_participants := jsonb_set(v_participants, ARRAY[v_home_id, 'points_against'],
      to_jsonb((v_participants->v_home_id->>'points_against')::int + v_away_score));

    -- Update away participant
    v_participants := jsonb_set(v_participants, ARRAY[v_away_id, 'played'],
      to_jsonb((v_participants->v_away_id->>'played')::int + 1));
    v_participants := jsonb_set(v_participants, ARRAY[v_away_id, 'points_for'],
      to_jsonb((v_participants->v_away_id->>'points_for')::int + v_away_score));
    v_participants := jsonb_set(v_participants, ARRAY[v_away_id, 'points_against'],
      to_jsonb((v_participants->v_away_id->>'points_against')::int + v_home_score));

    -- Points assignment
    IF v_is_wo THEN
      IF v_winner = v_home_id THEN
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id, 'wins'], to_jsonb((v_participants->v_home_id->>'wins')::int + 1));
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id, 'wo_for'], to_jsonb((v_participants->v_home_id->>'wo_for')::int + 1));
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id, 'points_table'], to_jsonb((v_participants->v_home_id->>'points_table')::int + COALESCE((v_gp->>'wo_win')::int, (v_gp->>'win')::int)));
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id, 'losses'], to_jsonb((v_participants->v_away_id->>'losses')::int + 1));
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id, 'wo_against'], to_jsonb((v_participants->v_away_id->>'wo_against')::int + 1));
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id, 'points_table'], to_jsonb((v_participants->v_away_id->>'points_table')::int + COALESCE((v_gp->>'wo_loss')::int, 0)));
      ELSIF v_winner = v_away_id THEN
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id, 'wins'], to_jsonb((v_participants->v_away_id->>'wins')::int + 1));
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id, 'wo_for'], to_jsonb((v_participants->v_away_id->>'wo_for')::int + 1));
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id, 'points_table'], to_jsonb((v_participants->v_away_id->>'points_table')::int + COALESCE((v_gp->>'wo_win')::int, (v_gp->>'win')::int)));
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id, 'losses'], to_jsonb((v_participants->v_home_id->>'losses')::int + 1));
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id, 'wo_against'], to_jsonb((v_participants->v_home_id->>'wo_against')::int + 1));
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id, 'points_table'], to_jsonb((v_participants->v_home_id->>'points_table')::int + COALESCE((v_gp->>'wo_loss')::int, 0)));
      END IF;
    ELSIF v_is_draw THEN
      v_participants := jsonb_set(v_participants, ARRAY[v_home_id, 'draws'], to_jsonb((v_participants->v_home_id->>'draws')::int + 1));
      v_participants := jsonb_set(v_participants, ARRAY[v_home_id, 'points_table'], to_jsonb((v_participants->v_home_id->>'points_table')::int + COALESCE((v_gp->>'draw')::int, 1)));
      v_participants := jsonb_set(v_participants, ARRAY[v_away_id, 'draws'], to_jsonb((v_participants->v_away_id->>'draws')::int + 1));
      v_participants := jsonb_set(v_participants, ARRAY[v_away_id, 'points_table'], to_jsonb((v_participants->v_away_id->>'points_table')::int + COALESCE((v_gp->>'draw')::int, 1)));
    ELSIF v_winner = v_home_id THEN
      v_participants := jsonb_set(v_participants, ARRAY[v_home_id, 'wins'], to_jsonb((v_participants->v_home_id->>'wins')::int + 1));
      v_participants := jsonb_set(v_participants, ARRAY[v_home_id, 'points_table'], to_jsonb((v_participants->v_home_id->>'points_table')::int + COALESCE((v_gp->>'win')::int, 3)));
      v_participants := jsonb_set(v_participants, ARRAY[v_away_id, 'losses'], to_jsonb((v_participants->v_away_id->>'losses')::int + 1));
      v_participants := jsonb_set(v_participants, ARRAY[v_away_id, 'points_table'], to_jsonb((v_participants->v_away_id->>'points_table')::int + COALESCE((v_gp->>'loss')::int, 0)));
    ELSIF v_winner = v_away_id THEN
      v_participants := jsonb_set(v_participants, ARRAY[v_away_id, 'wins'], to_jsonb((v_participants->v_away_id->>'wins')::int + 1));
      v_participants := jsonb_set(v_participants, ARRAY[v_away_id, 'points_table'], to_jsonb((v_participants->v_away_id->>'points_table')::int + COALESCE((v_gp->>'win')::int, 3)));
      v_participants := jsonb_set(v_participants, ARRAY[v_home_id, 'losses'], to_jsonb((v_participants->v_home_id->>'losses')::int + 1));
      v_participants := jsonb_set(v_participants, ARRAY[v_home_id, 'points_table'], to_jsonb((v_participants->v_home_id->>'points_table')::int + COALESCE((v_gp->>'loss')::int, 0)));
    END IF;
  END LOOP;

  -- Build standings array with goal_diff and goal_average, sorted by tie_breakers
  v_result := '[]'::jsonb;
  FOR v_pid IN SELECT jsonb_object_keys(v_participants) LOOP
    v_participants := jsonb_set(v_participants, ARRAY[v_pid, 'goal_diff'],
      to_jsonb((v_participants->v_pid->>'points_for')::int - (v_participants->v_pid->>'points_against')::int));
    v_result := v_result || jsonb_build_array(v_participants->v_pid);
  END LOOP;

  -- Sort: primary by points_table desc, then goal_diff desc, then goals_for desc
  -- (Simplified sort - full tie-breaker logic applied client-side for complex cases)
  SELECT jsonb_agg(val ORDER BY
    (val->>'points_table')::int DESC,
    ((val->>'points_for')::int - (val->>'points_against')::int) DESC,
    (val->>'points_for')::int DESC,
    (val->>'points_against')::int ASC
  )
  INTO v_result
  FROM jsonb_array_elements(v_result) val;

  -- Assign ranks
  v_rank := 0;
  v_standings := '[]'::jsonb;
  FOR v_p IN SELECT * FROM jsonb_array_elements(COALESCE(v_result, '[]'::jsonb)) WITH ORDINALITY AS t(val, ord) LOOP
    v_rank := v_p.ord::int;
    v_standings := v_standings || jsonb_build_array(
      v_p.val || jsonb_build_object(
        'rank', v_rank,
        'participant_id', COALESCE(v_p.val->>'team_id', v_p.val->>'pse_id', v_p.val->>'entry_id'),
        'participant_label', v_p.val->>'label',
        'goal_average', CASE
          WHEN (v_p.val->>'points_against')::int = 0 AND (v_p.val->>'points_for')::int > 0 THEN 999.0
          WHEN (v_p.val->>'points_against')::int = 0 THEN 0.0
          ELSE round((v_p.val->>'points_for')::numeric / (v_p.val->>'points_against')::numeric, 3)
        END,
        'tie_unresolved', false
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'sport_event_id', p_sport_event_id,
    'phase_id', p_phase_id,
    'group_id', p_group_id,
    'family', 'score',
    'standings', v_standings,
    'meta', jsonb_build_object(
      'matches_count', v_matches_count,
      'matches_finalized_count', v_matches_finalized,
      'generated_at', now(),
      'tie_breakers_configured', v_tb,
      'ignored_rules', v_ignored
    )
  );
END;
$$;

-- =============================================================
-- 4) rpc_compute_standings_sets
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_compute_standings_sets(
  p_event_id uuid,
  p_sport_event_id uuid,
  p_phase_id uuid DEFAULT NULL,
  p_group_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules jsonb;
  v_gp jsonb;
  v_special jsonb;
  v_tb jsonb;
  v_matches_count int := 0;
  v_matches_finalized int := 0;
  v_participants jsonb := '{}'::jsonb;
  v_match record;
  v_outcome jsonb;
  v_home_id text;
  v_away_id text;
  v_home_sets int;
  v_away_sets int;
  v_home_score int;
  v_away_score int;
  v_winner text;
  v_is_wo boolean;
  v_home_pts int;
  v_away_pts int;
  v_result jsonb;
  v_standings jsonb := '[]'::jsonb;
  v_pid text;
  v_p record;
  v_rank int;
  v_set_detail jsonb;
  v_set_pts_home int;
  v_set_pts_away int;
BEGIN
  v_rules := rpc_get_group_points_rules(p_sport_event_id);
  v_gp := v_rules->'group_points';
  v_special := v_gp->'special';
  v_tb := v_rules->'tie_breakers';

  FOR v_match IN
    SELECT cm.id as match_id
    FROM competition_matches cm
    WHERE cm.event_id = p_event_id
      AND cm.sport_event_id = p_sport_event_id
      AND (p_phase_id IS NULL OR cm.phase_id = p_phase_id)
      AND (p_group_id IS NULL OR cm.group_id = p_group_id)
  LOOP
    v_matches_count := v_matches_count + 1;
    v_outcome := rpc_extract_match_outcome(v_match.match_id);

    IF NOT COALESCE((v_outcome->>'finalized')::boolean, false) THEN
      CONTINUE;
    END IF;
    v_matches_finalized := v_matches_finalized + 1;

    v_home_id := v_outcome->>'home_entry_id';
    v_away_id := v_outcome->>'away_entry_id';
    v_winner := v_outcome->>'winner_entry_id';
    v_is_wo := COALESCE((v_outcome->>'wo')::boolean, false);
    v_home_score := COALESCE((v_outcome->'score'->>'home')::int, 0);
    v_away_score := COALESCE((v_outcome->'score'->>'away')::int, 0);
    v_home_sets := COALESCE((v_outcome->'sets'->>'home')::int, 0);
    v_away_sets := COALESCE((v_outcome->'sets'->>'away')::int, 0);

    -- Calculate points within sets
    v_set_pts_home := 0;
    v_set_pts_away := 0;
    v_set_detail := v_outcome->'sets'->'set_scores';
    IF v_set_detail IS NOT NULL AND jsonb_typeof(v_set_detail) = 'array' THEN
      FOR i IN 0..jsonb_array_length(v_set_detail)-1 LOOP
        v_set_pts_home := v_set_pts_home + COALESCE((v_set_detail->i->>'home')::int, 0);
        v_set_pts_away := v_set_pts_away + COALESCE((v_set_detail->i->>'away')::int, 0);
      END LOOP;
    ELSE
      -- Use score as fallback for points
      v_set_pts_home := v_home_score;
      v_set_pts_away := v_away_score;
    END IF;

    -- Initialize participants
    IF NOT v_participants ? v_home_id THEN
      v_participants := v_participants || jsonb_build_object(v_home_id, jsonb_build_object(
        'entry_id', v_home_id,
        'team_id', (SELECT cme.team_id FROM competition_match_entries cme WHERE cme.id = v_home_id::uuid),
        'pse_id', (SELECT cme.participant_sport_event_id FROM competition_match_entries cme WHERE cme.id = v_home_id::uuid),
        'played',0,'wins',0,'losses',0,
        'sets_for',0,'sets_against',0,
        'pts_for',0,'pts_against',0,
        'points_table',0,'wo_for',0,'wo_against',0,
        'label', COALESCE(
          (SELECT t.name FROM teams t JOIN competition_match_entries cme ON cme.team_id = t.id WHERE cme.id = v_home_id::uuid LIMIT 1),
          (SELECT p.name FROM people p JOIN participants pt ON pt.person_id = p.id JOIN participant_sport_events pse ON pse.participant_id = pt.id JOIN competition_match_entries cme ON cme.participant_sport_event_id = pse.id WHERE cme.id = v_home_id::uuid LIMIT 1),
          v_home_id
        )
      ));
    END IF;
    IF NOT v_participants ? v_away_id THEN
      v_participants := v_participants || jsonb_build_object(v_away_id, jsonb_build_object(
        'entry_id', v_away_id,
        'team_id', (SELECT cme.team_id FROM competition_match_entries cme WHERE cme.id = v_away_id::uuid),
        'pse_id', (SELECT cme.participant_sport_event_id FROM competition_match_entries cme WHERE cme.id = v_away_id::uuid),
        'played',0,'wins',0,'losses',0,
        'sets_for',0,'sets_against',0,
        'pts_for',0,'pts_against',0,
        'points_table',0,'wo_for',0,'wo_against',0,
        'label', COALESCE(
          (SELECT t.name FROM teams t JOIN competition_match_entries cme ON cme.team_id = t.id WHERE cme.id = v_away_id::uuid LIMIT 1),
          (SELECT p.name FROM people p JOIN participants pt ON pt.person_id = p.id JOIN participant_sport_events pse ON pse.participant_id = pt.id JOIN competition_match_entries cme ON cme.participant_sport_event_id = pse.id WHERE cme.id = v_away_id::uuid LIMIT 1),
          v_away_id
        )
      ));
    END IF;

    -- Update stats
    v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'played'], to_jsonb((v_participants->v_home_id->>'played')::int+1));
    v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'played'], to_jsonb((v_participants->v_away_id->>'played')::int+1));
    v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'sets_for'], to_jsonb((v_participants->v_home_id->>'sets_for')::int+v_home_sets));
    v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'sets_against'], to_jsonb((v_participants->v_home_id->>'sets_against')::int+v_away_sets));
    v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'sets_for'], to_jsonb((v_participants->v_away_id->>'sets_for')::int+v_away_sets));
    v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'sets_against'], to_jsonb((v_participants->v_away_id->>'sets_against')::int+v_home_sets));
    v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'pts_for'], to_jsonb((v_participants->v_home_id->>'pts_for')::int+v_set_pts_home));
    v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'pts_against'], to_jsonb((v_participants->v_home_id->>'pts_against')::int+v_set_pts_away));
    v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'pts_for'], to_jsonb((v_participants->v_away_id->>'pts_for')::int+v_set_pts_away));
    v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'pts_against'], to_jsonb((v_participants->v_away_id->>'pts_against')::int+v_set_pts_home));

    -- Points assignment
    IF v_is_wo THEN
      IF v_winner = v_home_id THEN
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'wins'], to_jsonb((v_participants->v_home_id->>'wins')::int+1));
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'wo_for'], to_jsonb((v_participants->v_home_id->>'wo_for')::int+1));
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'points_table'], to_jsonb((v_participants->v_home_id->>'points_table')::int + COALESCE((v_gp->>'wo_win')::int,(v_gp->>'win')::int,2)));
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'losses'], to_jsonb((v_participants->v_away_id->>'losses')::int+1));
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'wo_against'], to_jsonb((v_participants->v_away_id->>'wo_against')::int+1));
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'points_table'], to_jsonb((v_participants->v_away_id->>'points_table')::int + COALESCE((v_gp->>'wo_loss')::int,0)));
      ELSIF v_winner = v_away_id THEN
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'wins'], to_jsonb((v_participants->v_away_id->>'wins')::int+1));
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'wo_for'], to_jsonb((v_participants->v_away_id->>'wo_for')::int+1));
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'points_table'], to_jsonb((v_participants->v_away_id->>'points_table')::int + COALESCE((v_gp->>'wo_win')::int,(v_gp->>'win')::int,2)));
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'losses'], to_jsonb((v_participants->v_home_id->>'losses')::int+1));
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'wo_against'], to_jsonb((v_participants->v_home_id->>'wo_against')::int+1));
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'points_table'], to_jsonb((v_participants->v_home_id->>'points_table')::int + COALESCE((v_gp->>'wo_loss')::int,0)));
      END IF;
    ELSE
      -- Special points for sets (volleyball style: 3-0/3-1 => 3pts winner; 3-2 => 2pts winner, 1pt loser)
      IF v_special IS NOT NULL AND v_winner IS NOT NULL THEN
        DECLARE
          v_w_sets int;
          v_l_sets int;
          v_key text;
          v_w_pts int;
          v_l_pts int;
        BEGIN
          IF v_winner = v_home_id THEN v_w_sets := v_home_sets; v_l_sets := v_away_sets;
          ELSE v_w_sets := v_away_sets; v_l_sets := v_home_sets; END IF;
          v_key := v_w_sets || '-' || v_l_sets;
          IF v_special ? v_key THEN
            v_w_pts := COALESCE((v_special->v_key->>'winner')::int, (v_gp->>'win')::int, 2);
            v_l_pts := COALESCE((v_special->v_key->>'loser')::int, (v_gp->>'loss')::int, 0);
          ELSE
            v_w_pts := COALESCE((v_gp->>'win')::int, 2);
            v_l_pts := COALESCE((v_gp->>'loss')::int, 0);
          END IF;
          IF v_winner = v_home_id THEN
            v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'wins'], to_jsonb((v_participants->v_home_id->>'wins')::int+1));
            v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'points_table'], to_jsonb((v_participants->v_home_id->>'points_table')::int + v_w_pts));
            v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'losses'], to_jsonb((v_participants->v_away_id->>'losses')::int+1));
            v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'points_table'], to_jsonb((v_participants->v_away_id->>'points_table')::int + v_l_pts));
          ELSE
            v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'wins'], to_jsonb((v_participants->v_away_id->>'wins')::int+1));
            v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'points_table'], to_jsonb((v_participants->v_away_id->>'points_table')::int + v_w_pts));
            v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'losses'], to_jsonb((v_participants->v_home_id->>'losses')::int+1));
            v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'points_table'], to_jsonb((v_participants->v_home_id->>'points_table')::int + v_l_pts));
          END IF;
        END;
      ELSIF v_winner = v_home_id THEN
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'wins'], to_jsonb((v_participants->v_home_id->>'wins')::int+1));
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'points_table'], to_jsonb((v_participants->v_home_id->>'points_table')::int + COALESCE((v_gp->>'win')::int,2)));
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'losses'], to_jsonb((v_participants->v_away_id->>'losses')::int+1));
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'points_table'], to_jsonb((v_participants->v_away_id->>'points_table')::int + COALESCE((v_gp->>'loss')::int,0)));
      ELSIF v_winner = v_away_id THEN
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'wins'], to_jsonb((v_participants->v_away_id->>'wins')::int+1));
        v_participants := jsonb_set(v_participants, ARRAY[v_away_id,'points_table'], to_jsonb((v_participants->v_away_id->>'points_table')::int + COALESCE((v_gp->>'win')::int,2)));
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'losses'], to_jsonb((v_participants->v_home_id->>'losses')::int+1));
        v_participants := jsonb_set(v_participants, ARRAY[v_home_id,'points_table'], to_jsonb((v_participants->v_home_id->>'points_table')::int + COALESCE((v_gp->>'loss')::int,0)));
      END IF;
    END IF;
  END LOOP;

  -- Build result array sorted
  v_result := '[]'::jsonb;
  FOR v_pid IN SELECT jsonb_object_keys(v_participants) LOOP
    v_result := v_result || jsonb_build_array(v_participants->v_pid);
  END LOOP;

  SELECT jsonb_agg(val ORDER BY
    (val->>'points_table')::int DESC,
    CASE WHEN (val->>'sets_against')::int = 0 THEN 999.0 ELSE (val->>'sets_for')::numeric / (val->>'sets_against')::numeric END DESC,
    CASE WHEN (val->>'pts_against')::int = 0 THEN 999.0 ELSE (val->>'pts_for')::numeric / (val->>'pts_against')::numeric END DESC
  )
  INTO v_result
  FROM jsonb_array_elements(v_result) val;

  v_rank := 0;
  v_standings := '[]'::jsonb;
  FOR v_p IN SELECT * FROM jsonb_array_elements(COALESCE(v_result, '[]'::jsonb)) WITH ORDINALITY AS t(val, ord) LOOP
    v_rank := v_p.ord::int;
    v_standings := v_standings || jsonb_build_array(
      v_p.val || jsonb_build_object(
        'rank', v_rank,
        'participant_id', COALESCE(v_p.val->>'team_id', v_p.val->>'pse_id', v_p.val->>'entry_id'),
        'participant_label', v_p.val->>'label',
        'sets_diff', (v_p.val->>'sets_for')::int - (v_p.val->>'sets_against')::int,
        'sets_quotient', CASE WHEN (v_p.val->>'sets_against')::int = 0 AND (v_p.val->>'sets_for')::int > 0 THEN 999.0
          WHEN (v_p.val->>'sets_against')::int = 0 THEN 0.0
          ELSE round((v_p.val->>'sets_for')::numeric / (v_p.val->>'sets_against')::numeric, 3) END,
        'pts_quotient', CASE WHEN (v_p.val->>'pts_against')::int = 0 AND (v_p.val->>'pts_for')::int > 0 THEN 999.0
          WHEN (v_p.val->>'pts_against')::int = 0 THEN 0.0
          ELSE round((v_p.val->>'pts_for')::numeric / (v_p.val->>'pts_against')::numeric, 3) END,
        'tie_unresolved', false
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'sport_event_id', p_sport_event_id,
    'phase_id', p_phase_id,
    'group_id', p_group_id,
    'family', 'sets',
    'standings', v_standings,
    'meta', jsonb_build_object(
      'matches_count', v_matches_count,
      'matches_finalized_count', v_matches_finalized,
      'generated_at', now(),
      'tie_breakers_configured', v_tb
    )
  );
END;
$$;

-- =============================================================
-- 5) rpc_compute_ranking_simple
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_compute_ranking_simple(
  p_event_id uuid,
  p_sport_event_id uuid,
  p_phase_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules jsonb;
  v_family text;
  v_standings jsonb := '[]'::jsonb;
  v_count int := 0;
BEGIN
  v_rules := rpc_get_group_points_rules(p_sport_event_id);
  v_family := v_rules->>'family';

  IF v_family = 'time' THEN
    SELECT jsonb_agg(row_data ORDER BY best_time ASC NULLS LAST)
    INTO v_standings
    FROM (
      SELECT jsonb_build_object(
        'participant_id', COALESCE(cme.participant_sport_event_id::text, cme.team_id::text, cme.id::text),
        'participant_label', COALESCE(
          (SELECT p.name FROM people p JOIN participants pt ON pt.person_id = p.id JOIN participant_sport_events pse ON pse.participant_id = pt.id WHERE pse.id = cme.participant_sport_event_id LIMIT 1),
          cme.id::text
        ),
        'time_ms', cmr.time_ms,
        'result_text', cmr.result_text
      ) as row_data,
      cmr.time_ms as best_time
      FROM competition_match_results cmr
      JOIN competition_match_entries cme ON cme.id = cmr.match_entry_id
      JOIN competition_matches cm ON cm.id = cmr.match_id
      WHERE cm.event_id = p_event_id
        AND cm.sport_event_id = p_sport_event_id
        AND (p_phase_id IS NULL OR cm.phase_id = p_phase_id)
        AND cmr.time_ms IS NOT NULL
      ORDER BY cmr.time_ms ASC
    ) sub;
  ELSIF v_family = 'mark' THEN
    SELECT jsonb_agg(row_data ORDER BY best_dist DESC NULLS LAST)
    INTO v_standings
    FROM (
      SELECT jsonb_build_object(
        'participant_id', COALESCE(cme.participant_sport_event_id::text, cme.team_id::text, cme.id::text),
        'participant_label', COALESCE(
          (SELECT p.name FROM people p JOIN participants pt ON pt.person_id = p.id JOIN participant_sport_events pse ON pse.participant_id = pt.id WHERE pse.id = cme.participant_sport_event_id LIMIT 1),
          cme.id::text
        ),
        'distance_cm', cmr.distance_cm,
        'result_text', cmr.result_text
      ) as row_data,
      cmr.distance_cm as best_dist
      FROM competition_match_results cmr
      JOIN competition_match_entries cme ON cme.id = cmr.match_entry_id
      JOIN competition_matches cm ON cm.id = cmr.match_id
      WHERE cm.event_id = p_event_id
        AND cm.sport_event_id = p_sport_event_id
        AND (p_phase_id IS NULL OR cm.phase_id = p_phase_id)
        AND cmr.distance_cm IS NOT NULL
      ORDER BY cmr.distance_cm DESC
    ) sub;
  ELSIF v_family IN ('ranking', 'swiss') THEN
    SELECT jsonb_agg(row_data ORDER BY pts DESC NULLS LAST)
    INTO v_standings
    FROM (
      SELECT jsonb_build_object(
        'participant_id', COALESCE(cme.participant_sport_event_id::text, cme.team_id::text, cme.id::text),
        'participant_label', COALESCE(
          (SELECT p.name FROM people p JOIN participants pt ON pt.person_id = p.id JOIN participant_sport_events pse ON pse.participant_id = pt.id WHERE pse.id = cme.participant_sport_event_id LIMIT 1),
          cme.id::text
        ),
        'points', cmr.points,
        'result_text', cmr.result_text
      ) as row_data,
      cmr.points as pts
      FROM competition_match_results cmr
      JOIN competition_match_entries cme ON cme.id = cmr.match_entry_id
      JOIN competition_matches cm ON cm.id = cmr.match_id
      WHERE cm.event_id = p_event_id
        AND cm.sport_event_id = p_sport_event_id
        AND (p_phase_id IS NULL OR cm.phase_id = p_phase_id)
        AND cmr.points IS NOT NULL
      ORDER BY cmr.points DESC
    ) sub;
  ELSE
    RETURN jsonb_build_object(
      'sport_event_id', p_sport_event_id,
      'family', v_family,
      'standings', '[]'::jsonb,
      'meta', jsonb_build_object('note', 'unsupported_family', 'generated_at', now())
    );
  END IF;

  -- Add rank
  IF v_standings IS NOT NULL THEN
    SELECT jsonb_agg(
      val || jsonb_build_object('rank', ord)
    )
    INTO v_standings
    FROM jsonb_array_elements(v_standings) WITH ORDINALITY AS t(val, ord);
    v_count := jsonb_array_length(v_standings);
  ELSE
    v_standings := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'sport_event_id', p_sport_event_id,
    'phase_id', p_phase_id,
    'family', v_family,
    'standings', v_standings,
    'meta', jsonb_build_object(
      'results_count', v_count,
      'generated_at', now(),
      'note', CASE WHEN v_count = 0 THEN 'awaiting_results' ELSE NULL END
    )
  );
END;
$$;
