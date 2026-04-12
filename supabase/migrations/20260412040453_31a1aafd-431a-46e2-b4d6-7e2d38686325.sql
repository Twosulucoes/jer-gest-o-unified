
-- ==============================
-- 1) match_discipline table
-- ==============================
CREATE TABLE IF NOT EXISTS public.match_discipline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  match_id uuid NOT NULL REFERENCES competition_matches(id) ON DELETE CASCADE,
  match_entry_id uuid NOT NULL REFERENCES competition_match_entries(id) ON DELETE CASCADE,
  yellow_cards int NOT NULL DEFAULT 0,
  red_cards int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  CONSTRAINT match_discipline_cards_positive CHECK (yellow_cards >= 0 AND red_cards >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_discipline_entry ON public.match_discipline(match_entry_id);
CREATE INDEX IF NOT EXISTS idx_match_discipline_event_match ON public.match_discipline(event_id, match_id);
CREATE INDEX IF NOT EXISTS idx_match_discipline_match ON public.match_discipline(match_id);

ALTER TABLE public.match_discipline ENABLE ROW LEVEL SECURITY;

-- Audit triggers
CREATE OR REPLACE FUNCTION public.trg_match_discipline_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_match_discipline_audit
  BEFORE INSERT OR UPDATE ON public.match_discipline
  FOR EACH ROW EXECUTE FUNCTION trg_match_discipline_audit();

-- RLS policies
CREATE POLICY "Admin full access match_discipline" ON public.match_discipline
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "CoordTec manage match_discipline" ON public.match_discipline
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

CREATE POLICY "Secretaria read match_discipline" ON public.match_discipline
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role));

-- ==============================
-- 2) group_draw_lots table
-- ==============================
CREATE TABLE IF NOT EXISTS public.group_draw_lots (
  group_id uuid NOT NULL REFERENCES competition_groups(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  seed int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  PRIMARY KEY (group_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_group_draw_lots_group ON public.group_draw_lots(group_id);

ALTER TABLE public.group_draw_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access group_draw_lots" ON public.group_draw_lots
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "CoordTec manage group_draw_lots" ON public.group_draw_lots
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

CREATE POLICY "Secretaria read group_draw_lots" ON public.group_draw_lots
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role));

-- ==============================
-- 3) get_group_standings RPC
-- ==============================
CREATE OR REPLACE FUNCTION public.get_group_standings(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group record;
  v_sport_event_id uuid;
  v_rules_json jsonb;
  v_scoring jsonb;
  v_tiebreakers jsonb;
  v_pts_win int;
  v_pts_draw int;
  v_pts_loss int;
  v_pts_wo_win int;
  v_pts_wo_loss int;
  v_result jsonb;
BEGIN
  -- Validate caller
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria') OR has_role(auth.uid(), 'coordenacao_tecnica')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  -- Get group info
  SELECT cg.*, cp.sport_event_id
  INTO v_group
  FROM competition_groups cg
  JOIN competition_phases cp ON cp.id = cg.phase_id
  WHERE cg.id = p_group_id;

  IF v_group IS NULL THEN
    RAISE EXCEPTION 'GROUP_NOT_FOUND';
  END IF;

  v_sport_event_id := v_group.sport_event_id;

  -- Load rules
  SELECT ser.rules INTO v_rules_json
  FROM sport_event_rules ser
  WHERE ser.sport_event_id = v_sport_event_id AND ser.is_active = true
  LIMIT 1;

  v_scoring := COALESCE(v_rules_json->'scoring'->'group_points', v_rules_json->'scoring'->'points', '{}'::jsonb);
  v_tiebreakers := COALESCE(
    v_rules_json->'tiebreakers',
    '["head_to_head_points","head_to_head_goal_diff","head_to_head_goals_for","overall_goal_diff","overall_goals_for","fair_play_red_cards_asc","fair_play_yellow_cards_asc","draw_lots"]'::jsonb
  );

  v_pts_win := COALESCE((v_scoring->>'win')::int, 3);
  v_pts_draw := COALESCE((v_scoring->>'draw')::int, 1);
  v_pts_loss := COALESCE((v_scoring->>'loss')::int, 0);
  v_pts_wo_win := COALESCE((v_scoring->>'wo_win')::int, v_pts_win);
  v_pts_wo_loss := COALESCE((v_scoring->>'wo_loss')::int, 0);

  -- Build standings using a CTE-based approach
  WITH
  -- All finished matches in this group
  finished_matches AS (
    SELECT cm.id AS match_id
    FROM competition_matches cm
    WHERE cm.group_id = p_group_id
      AND cm.status = 'finished'
  ),
  -- All teams in this group (from match entries)
  group_teams AS (
    SELECT DISTINCT cme.team_id
    FROM competition_match_entries cme
    JOIN competition_matches cm ON cm.id = cme.match_id
    WHERE cm.group_id = p_group_id
      AND cme.team_id IS NOT NULL
  ),
  -- Match data with scores
  match_data AS (
    SELECT
      fm.match_id,
      cme.id AS entry_id,
      cme.team_id,
      cme.side,
      ms.score_final,
      ms.outcome,
      COALESCE(
        CASE WHEN ms.score_final ~ '^\d+$' THEN ms.score_final::int END,
        0
      ) AS goals
    FROM finished_matches fm
    JOIN competition_match_entries cme ON cme.match_id = fm.match_id
    LEFT JOIN match_scores ms ON ms.match_entry_id = cme.id AND ms.match_id = fm.match_id
    WHERE cme.team_id IS NOT NULL
  ),
  -- Pair home/away per match
  match_pairs AS (
    SELECT
      md1.match_id,
      md1.team_id AS team_a,
      md1.goals AS goals_a,
      md1.outcome AS outcome_a,
      md1.entry_id AS entry_a,
      md2.team_id AS team_b,
      md2.goals AS goals_b,
      md2.outcome AS outcome_b,
      md2.entry_id AS entry_b
    FROM match_data md1
    JOIN match_data md2 ON md2.match_id = md1.match_id AND md2.team_id != md1.team_id
    WHERE md1.team_id < md2.team_id
  ),
  -- Stats per team
  team_stats AS (
    SELECT
      gt.team_id,
      COALESCE(t.name, gt.team_id::text) AS team_name,
      COUNT(mp.match_id) FILTER (WHERE gt.team_id IN (mp.team_a, mp.team_b)) AS played,
      -- Wins
      COUNT(*) FILTER (WHERE
        (gt.team_id = mp.team_a AND (mp.outcome_a = 'win' OR mp.outcome_a = 'wo_win' OR (mp.outcome_a IS NULL AND mp.goals_a > mp.goals_b)))
        OR (gt.team_id = mp.team_b AND (mp.outcome_b = 'win' OR mp.outcome_b = 'wo_win' OR (mp.outcome_b IS NULL AND mp.goals_b > mp.goals_a)))
      ) AS wins,
      -- Draws
      COUNT(*) FILTER (WHERE
        (gt.team_id = mp.team_a AND (mp.outcome_a = 'draw' OR (mp.outcome_a IS NULL AND mp.goals_a = mp.goals_b)))
        OR (gt.team_id = mp.team_b AND (mp.outcome_b = 'draw' OR (mp.outcome_b IS NULL AND mp.goals_b = mp.goals_a)))
      ) AS draws,
      -- Losses
      COUNT(*) FILTER (WHERE
        (gt.team_id = mp.team_a AND (mp.outcome_a = 'loss' OR mp.outcome_a = 'wo_loss' OR (mp.outcome_a IS NULL AND mp.goals_a < mp.goals_b)))
        OR (gt.team_id = mp.team_b AND (mp.outcome_b = 'loss' OR mp.outcome_b = 'wo_loss' OR (mp.outcome_b IS NULL AND mp.goals_b < mp.goals_a)))
      ) AS losses,
      -- Goals
      SUM(CASE WHEN gt.team_id = mp.team_a THEN mp.goals_a WHEN gt.team_id = mp.team_b THEN mp.goals_b ELSE 0 END) AS goals_for,
      SUM(CASE WHEN gt.team_id = mp.team_a THEN mp.goals_b WHEN gt.team_id = mp.team_b THEN mp.goals_a ELSE 0 END) AS goals_against,
      -- WO
      COUNT(*) FILTER (WHERE
        (gt.team_id = mp.team_a AND mp.outcome_a = 'wo_win')
        OR (gt.team_id = mp.team_b AND mp.outcome_b = 'wo_win')
      ) AS wo_wins,
      COUNT(*) FILTER (WHERE
        (gt.team_id = mp.team_a AND mp.outcome_a = 'wo_loss')
        OR (gt.team_id = mp.team_b AND mp.outcome_b = 'wo_loss')
      ) AS wo_losses,
      -- Discipline from match_discipline
      COALESCE((SELECT SUM(md.yellow_cards) FROM match_discipline md
        JOIN competition_match_entries cme2 ON cme2.id = md.match_entry_id
        WHERE cme2.team_id = gt.team_id
        AND md.match_id IN (SELECT fm2.match_id FROM finished_matches fm2)
      ), 0)::int AS yellow_cards,
      COALESCE((SELECT SUM(md.red_cards) FROM match_discipline md
        JOIN competition_match_entries cme2 ON cme2.id = md.match_entry_id
        WHERE cme2.team_id = gt.team_id
        AND md.match_id IN (SELECT fm2.match_id FROM finished_matches fm2)
      ), 0)::int AS red_cards,
      -- Also count from match_penalties (existing structure)
      COALESCE((SELECT COUNT(*) FROM match_penalties mpen
        JOIN competition_match_entries cme3 ON cme3.id = mpen.match_entry_id
        WHERE cme3.team_id = gt.team_id
        AND mpen.match_id IN (SELECT fm3.match_id FROM finished_matches fm3)
        AND mpen.penalty_key = 'yellow_card'
      ), 0)::int AS penalties_yellow,
      COALESCE((SELECT COUNT(*) FROM match_penalties mpen
        JOIN competition_match_entries cme3 ON cme3.id = mpen.match_entry_id
        WHERE cme3.team_id = gt.team_id
        AND mpen.match_id IN (SELECT fm3.match_id FROM finished_matches fm3)
        AND mpen.penalty_key = 'red_card'
      ), 0)::int AS penalties_red
    FROM group_teams gt
    LEFT JOIN teams t ON t.id = gt.team_id
    LEFT JOIN match_pairs mp ON gt.team_id IN (mp.team_a, mp.team_b)
    GROUP BY gt.team_id, t.name
  ),
  -- Compute points
  with_points AS (
    SELECT
      ts.*,
      (ts.yellow_cards + ts.penalties_yellow) AS total_yellow,
      (ts.red_cards + ts.penalties_red) AS total_red,
      COALESCE(ts.goals_for, 0) - COALESCE(ts.goals_against, 0) AS goal_diff,
      (ts.wins - ts.wo_wins) * v_pts_win +
      ts.wo_wins * v_pts_wo_win +
      ts.draws * v_pts_draw +
      (ts.losses - ts.wo_losses) * v_pts_loss +
      ts.wo_losses * v_pts_wo_loss AS points,
      -- Draw lots seed
      COALESCE(
        (SELECT dl.seed FROM group_draw_lots dl WHERE dl.group_id = p_group_id AND dl.team_id = ts.team_id),
        abs(('x' || substr(md5(ts.team_id::text || p_group_id::text), 1, 8))::bit(32)::int)
      ) AS draw_lot_seed
    FROM team_stats ts
  ),
  -- Head-to-head: for each pair of teams with same points, compute h2h stats
  -- We do a simplified approach: compute h2h for all pairs
  h2h_pairs AS (
    SELECT
      mp.team_a,
      mp.team_b,
      -- A's perspective
      SUM(CASE
        WHEN mp.outcome_a = 'win' OR mp.outcome_a = 'wo_win' OR (mp.outcome_a IS NULL AND mp.goals_a > mp.goals_b) THEN v_pts_win
        WHEN mp.outcome_a = 'draw' OR (mp.outcome_a IS NULL AND mp.goals_a = mp.goals_b) THEN v_pts_draw
        ELSE v_pts_loss
      END) AS a_h2h_pts,
      SUM(CASE
        WHEN mp.outcome_b = 'win' OR mp.outcome_b = 'wo_win' OR (mp.outcome_b IS NULL AND mp.goals_b > mp.goals_a) THEN v_pts_win
        WHEN mp.outcome_b = 'draw' OR (mp.outcome_b IS NULL AND mp.goals_b = mp.goals_a) THEN v_pts_draw
        ELSE v_pts_loss
      END) AS b_h2h_pts,
      SUM(mp.goals_a) AS a_h2h_gf,
      SUM(mp.goals_b) AS b_h2h_gf,
      SUM(mp.goals_a - mp.goals_b) AS a_h2h_gd,
      SUM(mp.goals_b - mp.goals_a) AS b_h2h_gd
    FROM match_pairs mp
    GROUP BY mp.team_a, mp.team_b
  ),
  -- Self h2h aggregated (sum of h2h pts/gf/gd against all opponents with same total points)
  h2h_agg AS (
    SELECT
      wp.team_id,
      COALESCE(SUM(CASE
        WHEN wp.team_id = hp.team_a THEN hp.a_h2h_pts
        WHEN wp.team_id = hp.team_b THEN hp.b_h2h_pts
      END) FILTER (WHERE
        EXISTS (SELECT 1 FROM with_points wp2
          WHERE wp2.team_id = CASE WHEN wp.team_id = hp.team_a THEN hp.team_b ELSE hp.team_a END
          AND wp2.points = wp.points AND wp2.team_id != wp.team_id)
      ), 0) AS h2h_points,
      COALESCE(SUM(CASE
        WHEN wp.team_id = hp.team_a THEN hp.a_h2h_gd
        WHEN wp.team_id = hp.team_b THEN hp.b_h2h_gd
      END) FILTER (WHERE
        EXISTS (SELECT 1 FROM with_points wp2
          WHERE wp2.team_id = CASE WHEN wp.team_id = hp.team_a THEN hp.team_b ELSE hp.team_a END
          AND wp2.points = wp.points AND wp2.team_id != wp.team_id)
      ), 0) AS h2h_goal_diff,
      COALESCE(SUM(CASE
        WHEN wp.team_id = hp.team_a THEN hp.a_h2h_gf
        WHEN wp.team_id = hp.team_b THEN hp.b_h2h_gf
      END) FILTER (WHERE
        EXISTS (SELECT 1 FROM with_points wp2
          WHERE wp2.team_id = CASE WHEN wp.team_id = hp.team_a THEN hp.team_b ELSE hp.team_a END
          AND wp2.points = wp.points AND wp2.team_id != wp.team_id)
      ), 0) AS h2h_goals_for
    FROM with_points wp
    LEFT JOIN h2h_pairs hp ON wp.team_id IN (hp.team_a, hp.team_b)
    GROUP BY wp.team_id
  ),
  -- Final ranking
  final_standings AS (
    SELECT
      wp.team_id,
      wp.team_name,
      COALESCE(wp.played, 0)::int AS played,
      wp.wins::int,
      wp.draws::int,
      wp.losses::int,
      wp.points::int,
      COALESCE(wp.goals_for, 0)::int AS goals_for,
      COALESCE(wp.goals_against, 0)::int AS goals_against,
      wp.goal_diff::int,
      wp.wo_wins::int,
      wp.wo_losses::int,
      wp.total_red::int AS red_cards,
      wp.total_yellow::int AS yellow_cards,
      wp.draw_lot_seed,
      COALESCE(ha.h2h_points, 0)::int AS h2h_points,
      COALESCE(ha.h2h_goal_diff, 0)::int AS h2h_goal_diff,
      COALESCE(ha.h2h_goals_for, 0)::int AS h2h_goals_for,
      row_number() OVER (ORDER BY
        wp.points DESC,
        COALESCE(ha.h2h_points, 0) DESC,
        COALESCE(ha.h2h_goal_diff, 0) DESC,
        COALESCE(ha.h2h_goals_for, 0) DESC,
        wp.goal_diff DESC,
        COALESCE(wp.goals_for, 0) DESC,
        wp.total_red ASC,
        wp.total_yellow ASC,
        wp.draw_lot_seed ASC,
        wp.team_name ASC
      ) AS rank
    FROM with_points wp
    LEFT JOIN h2h_agg ha ON ha.team_id = wp.team_id
  )
  SELECT jsonb_build_object(
    'group_id', p_group_id,
    'sport_event_id', v_sport_event_id,
    'tiebreakers', v_tiebreakers,
    'standings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'rank', fs.rank,
        'team_id', fs.team_id,
        'team_name', fs.team_name,
        'played', fs.played,
        'wins', fs.wins,
        'draws', fs.draws,
        'losses', fs.losses,
        'points', fs.points,
        'goals_for', fs.goals_for,
        'goals_against', fs.goals_against,
        'goal_diff', fs.goal_diff,
        'wo_wins', fs.wo_wins,
        'wo_losses', fs.wo_losses,
        'red_cards', fs.red_cards,
        'yellow_cards', fs.yellow_cards,
        'tie_explain', NULL
      ) ORDER BY fs.rank)
      FROM final_standings fs
    ), '[]'::jsonb)
  )
  INTO v_result;

  -- Auto-insert draw lot seeds for teams that don't have one yet
  INSERT INTO group_draw_lots (group_id, team_id, seed, created_by)
  SELECT p_group_id, gt.team_id,
    abs(('x' || substr(md5(gt.team_id::text || p_group_id::text), 1, 8))::bit(32)::int),
    auth.uid()
  FROM group_teams gt
  WHERE NOT EXISTS (
    SELECT 1 FROM group_draw_lots dl WHERE dl.group_id = p_group_id AND dl.team_id = gt.team_id
  )
  ON CONFLICT DO NOTHING;

  RETURN v_result;
END;
$$;

-- Grant
REVOKE ALL ON FUNCTION public.get_group_standings FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_standings TO authenticated;
