-- Create a comprehensive view for sport event statistics to optimize the dashboard
CREATE OR REPLACE VIEW public.vw_sport_event_summary AS
WITH 
  enrolled_stats AS (
    SELECT sport_event_id, COUNT(*) as enrolled_count
    FROM participant_sport_events
    WHERE status IN ('confirmed', 'approved', 'valid', 'active')
    GROUP BY sport_event_id
  ),
  team_stats AS (
    SELECT sport_event_id, COUNT(*) as team_count
    FROM teams
    WHERE status = 'active'
    GROUP BY sport_event_id
  ),
  phase_stats AS (
    SELECT sport_event_id, COUNT(*) as phase_count
    FROM competition_phases
    GROUP BY sport_event_id
  ),
  group_stats AS (
    SELECT cp.sport_event_id, COUNT(cg.id) as group_count
    FROM competition_groups cg
    JOIN competition_phases cp ON cg.phase_id = cp.id
    GROUP BY cp.sport_event_id
  ),
  match_stats AS (
    SELECT 
      m.sport_event_id, 
      COUNT(m.id) as match_count,
      COUNT(m.id) FILTER (WHERE m.match_date IS NOT NULL AND m.start_time IS NOT NULL) as matches_with_schedule,
      COUNT(DISTINCT r.match_id) as matches_with_result,
      COUNT(DISTINCT r.match_id) FILTER (WHERE r.result_status::text IN ('resultado_validado', 'publicado')) as results_validated,
      COUNT(DISTINCT r.match_id) FILTER (WHERE r.result_status::text = 'publicado') as results_published
    FROM competition_matches m
    LEFT JOIN competition_match_results r ON m.id = r.match_id
    GROUP BY m.sport_event_id
  )
SELECT 
  se.id as sport_event_id,
  se.event_id,
  se.name,
  se.sport_id,
  se.category_id,
  se.is_active,
  s.name as sport_name,
  s.is_collective as is_collective,
  c.name as category_name,
  ser.released_at,
  COALESCE(es.enrolled_count, 0) as enrolled_count,
  COALESCE(ts.team_count, 0) as team_count,
  COALESCE(ps.phase_count, 0) as phase_count,
  COALESCE(gs.group_count, 0) as group_count,
  COALESCE(ms.match_count, 0) as match_count,
  COALESCE(ms.matches_with_schedule, 0) as matches_with_schedule,
  COALESCE(ms.matches_with_result, 0) as matches_with_result,
  COALESCE(ms.results_validated, 0) as results_validated,
  COALESCE(ms.results_published, 0) as results_published
FROM sport_events se
JOIN sports s ON se.sport_id = s.id
JOIN categories c ON se.category_id = c.id
LEFT JOIN sport_event_rules ser ON se.id = ser.sport_event_id
LEFT JOIN enrolled_stats es ON se.id = es.sport_event_id
LEFT JOIN team_stats ts ON se.id = ts.sport_event_id
LEFT JOIN phase_stats ps ON se.id = ps.sport_event_id
LEFT JOIN group_stats gs ON se.id = gs.sport_event_id
LEFT JOIN match_stats ms ON se.id = ms.sport_event_id;
