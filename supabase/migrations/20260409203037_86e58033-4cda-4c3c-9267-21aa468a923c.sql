
-- VIEW consolidada de histórico esportivo por participante
CREATE OR REPLACE VIEW public.vw_participant_sport_history AS

-- 1) Participações INDIVIDUAIS via match entries
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
  r.position,
  r.result_text,
  r.outcome,
  r.time_ms,
  r.distance_cm,
  r.points,
  r.result_status,
  r.validated_at,
  r.published_at,
  r.notes AS result_notes
FROM public.competition_match_entries me
JOIN public.participant_sport_events pse ON pse.id = me.participant_sport_event_id
JOIN public.participants p ON p.id = pse.participant_id
JOIN public.competition_matches m ON m.id = me.match_id
JOIN public.competition_phases ph ON ph.id = m.phase_id
JOIN public.sport_events se ON se.id = COALESCE(m.sport_event_id, ph.sport_event_id)
LEFT JOIN public.competition_groups cg ON cg.id = m.group_id
LEFT JOIN public.competition_match_results r ON r.match_entry_id = me.id
WHERE me.participant_sport_event_id IS NOT NULL

UNION ALL

-- 2) Participações por EQUIPE via team_members + match entries
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
  r.position,
  r.result_text,
  r.outcome,
  r.time_ms,
  r.distance_cm,
  r.points,
  r.result_status,
  r.validated_at,
  r.published_at,
  r.notes AS result_notes
FROM public.competition_match_entries me
JOIN public.teams t ON t.id = me.team_id
JOIN public.team_members tm ON tm.team_id = t.id AND tm.is_active = true
JOIN public.participants p ON p.id = tm.participant_id
JOIN public.competition_matches m ON m.id = me.match_id
JOIN public.competition_phases ph ON ph.id = m.phase_id
JOIN public.sport_events se ON se.id = COALESCE(m.sport_event_id, ph.sport_event_id)
LEFT JOIN public.competition_groups cg ON cg.id = m.group_id
LEFT JOIN public.competition_match_results r ON r.match_entry_id = me.id
WHERE me.team_id IS NOT NULL

UNION ALL

-- 3) Inscrições sem partida (participante inscrito mas sem entry ainda)
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
  NULL::integer AS position,
  NULL::text AS result_text,
  NULL::text AS outcome,
  NULL::bigint AS time_ms,
  NULL::bigint AS distance_cm,
  NULL::numeric AS points,
  NULL::text AS result_status,
  NULL::timestamptz AS validated_at,
  NULL::timestamptz AS published_at,
  NULL::text AS result_notes
FROM public.participant_sport_events pse
JOIN public.participants p ON p.id = pse.participant_id
JOIN public.sport_events se ON se.id = pse.sport_event_id
WHERE pse.status = 'confirmed'
  AND NOT EXISTS (
    SELECT 1 FROM public.competition_match_entries me2
    WHERE me2.participant_sport_event_id = pse.id
  );

-- RPC para consumo no frontend
CREATE OR REPLACE FUNCTION public.get_participant_sport_history(_participant_id uuid)
RETURNS SETOF public.vw_participant_sport_history
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.vw_participant_sport_history
  WHERE participant_id = _participant_id
  ORDER BY match_date DESC NULLS LAST, sport_event_name, phase_name;
$$;
