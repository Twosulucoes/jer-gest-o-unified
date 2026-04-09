
-- Drop existing RPC and VIEW to recreate with new columns
DROP FUNCTION IF EXISTS public.get_participant_sport_history(_participant_id uuid);
DROP VIEW IF EXISTS public.vw_participant_sport_history;

-- Recreate expanded VIEW
CREATE OR REPLACE VIEW public.vw_participant_sport_history
WITH (security_invoker = true)
AS
-- Individual entries with match
SELECT
  p.id AS participant_id,
  m.event_id,
  se.id AS sport_event_id,
  se.name AS sport_event_name,
  'individual'::text AS participation_type,
  NULL::uuid AS team_id,
  NULL::text AS team_name,
  ph.id AS phase_id,
  ph.name AS phase_name,
  cg.id AS group_id,
  cg.name AS group_name,
  m.id AS match_id,
  m.match_date,
  me.id AS entry_id,
  r.id AS result_id,
  r.score,
  r."position",
  r.result_text,
  r.outcome,
  r.time_ms,
  r.distance_cm,
  r.points,
  r.result_status,
  r.validated_at,
  r.published_at,
  r.notes AS result_notes,
  -- delegation / institution
  d.id AS delegation_id,
  i.name AS delegation_name,
  i.id AS institution_id,
  i.name AS institution_name,
  -- attempts aggregates
  att.attempts_count,
  att.best_attempt_cm,
  att.best_attempt_ms,
  att.best_attempt_points,
  -- stats aggregate
  st.aggregated_stats_json,
  -- penalties count
  COALESCE(pen.penalties_count, 0)::integer AS penalties_count
FROM competition_match_entries me
  JOIN participant_sport_events pse ON pse.id = me.participant_sport_event_id
  JOIN participants p ON p.id = pse.participant_id
  JOIN competition_matches m ON m.id = me.match_id
  JOIN competition_phases ph ON ph.id = m.phase_id
  JOIN sport_events se ON se.id = COALESCE(m.sport_event_id, ph.sport_event_id)
  LEFT JOIN competition_groups cg ON cg.id = m.group_id
  LEFT JOIN competition_match_results r ON r.match_entry_id = me.id
  -- delegation / institution
  LEFT JOIN delegations d ON d.id = p.delegation_id
  LEFT JOIN institutions i ON i.id = d.institution_id
  -- attempts
  LEFT JOIN LATERAL (
    SELECT
      count(*)::integer AS attempts_count,
      max(ma.value_cm) AS best_attempt_cm,
      min(CASE WHEN ma.value_ms > 0 THEN ma.value_ms END) AS best_attempt_ms,
      max(ma.value_points) AS best_attempt_points
    FROM match_attempts ma
    WHERE ma.match_entry_id = me.id AND ma.is_valid = true
  ) att ON true
  -- stats
  LEFT JOIN LATERAL (
    SELECT jsonb_object_agg(sub.stat_key, sub.total) AS aggregated_stats_json
    FROM (
      SELECT mps.stat_key, sum(mps.stat_value)::numeric AS total
      FROM match_player_stats mps
      WHERE mps.match_id = m.id AND mps.participant_id = p.id
      GROUP BY mps.stat_key
    ) sub
  ) st ON true
  -- penalties
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS penalties_count
    FROM match_penalties mp
    WHERE mp.match_id = m.id AND mp.participant_id = p.id
  ) pen ON true
WHERE me.participant_sport_event_id IS NOT NULL

UNION ALL

-- Team entries with match
SELECT
  p.id AS participant_id,
  m.event_id,
  se.id AS sport_event_id,
  se.name AS sport_event_name,
  'team'::text AS participation_type,
  t.id AS team_id,
  t.name AS team_name,
  ph.id AS phase_id,
  ph.name AS phase_name,
  cg.id AS group_id,
  cg.name AS group_name,
  m.id AS match_id,
  m.match_date,
  me.id AS entry_id,
  r.id AS result_id,
  r.score,
  r."position",
  r.result_text,
  r.outcome,
  r.time_ms,
  r.distance_cm,
  r.points,
  r.result_status,
  r.validated_at,
  r.published_at,
  r.notes AS result_notes,
  -- delegation / institution
  d.id AS delegation_id,
  i.name AS delegation_name,
  i.id AS institution_id,
  i.name AS institution_name,
  -- attempts (not applicable for team, but keep columns)
  0::integer AS attempts_count,
  NULL::bigint AS best_attempt_cm,
  NULL::bigint AS best_attempt_ms,
  NULL::numeric AS best_attempt_points,
  -- stats aggregate
  st.aggregated_stats_json,
  -- penalties count
  COALESCE(pen.penalties_count, 0)::integer AS penalties_count
FROM competition_match_entries me
  JOIN teams t ON t.id = me.team_id
  JOIN team_members tm ON tm.team_id = t.id AND tm.is_active = true
  JOIN participants p ON p.id = tm.participant_id
  JOIN competition_matches m ON m.id = me.match_id
  JOIN competition_phases ph ON ph.id = m.phase_id
  JOIN sport_events se ON se.id = COALESCE(m.sport_event_id, ph.sport_event_id)
  LEFT JOIN competition_groups cg ON cg.id = m.group_id
  LEFT JOIN competition_match_results r ON r.match_entry_id = me.id
  -- delegation / institution
  LEFT JOIN delegations d ON d.id = p.delegation_id
  LEFT JOIN institutions i ON i.id = d.institution_id
  -- stats
  LEFT JOIN LATERAL (
    SELECT jsonb_object_agg(sub.stat_key, sub.total) AS aggregated_stats_json
    FROM (
      SELECT mps.stat_key, sum(mps.stat_value)::numeric AS total
      FROM match_player_stats mps
      WHERE mps.match_id = m.id AND mps.participant_id = p.id
      GROUP BY mps.stat_key
    ) sub
  ) st ON true
  -- penalties
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS penalties_count
    FROM match_penalties mp
    WHERE mp.match_id = m.id AND mp.participant_id = p.id
  ) pen ON true
WHERE me.team_id IS NOT NULL

UNION ALL

-- Confirmed enrollments without matches
SELECT
  p.id AS participant_id,
  se.event_id,
  se.id AS sport_event_id,
  se.name AS sport_event_name,
  'individual'::text AS participation_type,
  NULL::uuid AS team_id,
  NULL::text AS team_name,
  NULL::uuid AS phase_id,
  NULL::text AS phase_name,
  NULL::uuid AS group_id,
  NULL::text AS group_name,
  NULL::uuid AS match_id,
  NULL::date AS match_date,
  NULL::uuid AS entry_id,
  NULL::uuid AS result_id,
  NULL::text AS score,
  NULL::integer AS "position",
  NULL::text AS result_text,
  NULL::text AS outcome,
  NULL::bigint AS time_ms,
  NULL::bigint AS distance_cm,
  NULL::numeric AS points,
  NULL::text AS result_status,
  NULL::timestamp with time zone AS validated_at,
  NULL::timestamp with time zone AS published_at,
  NULL::text AS result_notes,
  -- delegation / institution
  d.id AS delegation_id,
  i.name AS delegation_name,
  i.id AS institution_id,
  i.name AS institution_name,
  -- attempts
  0::integer AS attempts_count,
  NULL::bigint AS best_attempt_cm,
  NULL::bigint AS best_attempt_ms,
  NULL::numeric AS best_attempt_points,
  -- stats
  NULL::jsonb AS aggregated_stats_json,
  -- penalties
  0::integer AS penalties_count
FROM participant_sport_events pse
  JOIN participants p ON p.id = pse.participant_id
  JOIN sport_events se ON se.id = pse.sport_event_id
  LEFT JOIN delegations d ON d.id = p.delegation_id
  LEFT JOIN institutions i ON i.id = d.institution_id
WHERE pse.status = 'confirmed'
  AND NOT EXISTS (
    SELECT 1 FROM competition_match_entries me2
    WHERE me2.participant_sport_event_id = pse.id
  );

-- Recreate RPC
CREATE OR REPLACE FUNCTION public.get_participant_sport_history(_participant_id uuid)
RETURNS SETOF public.vw_participant_sport_history
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT * FROM public.vw_participant_sport_history
  WHERE participant_id = _participant_id
  ORDER BY match_date DESC NULLS LAST, sport_event_name, phase_name;
$$;
