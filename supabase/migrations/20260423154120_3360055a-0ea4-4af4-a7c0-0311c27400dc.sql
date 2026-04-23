DROP VIEW IF EXISTS public.vw_stage_sport_event_summary;

CREATE VIEW public.vw_stage_sport_event_summary AS
 WITH enrolled_stats AS (
         SELECT pse.sport_event_id,
            pes.event_stage_id,
            count(*) AS enrolled_count
           FROM public.participant_sport_events pse
             JOIN public.participant_event_stages pes ON pse.participant_id = pes.participant_id
          WHERE pse.status = ANY (ARRAY['confirmed'::text, 'approved'::text, 'valid'::text, 'active'::text])
          GROUP BY pse.sport_event_id, pes.event_stage_id
        ), team_stats AS (
         SELECT t.sport_event_id,
            pes.event_stage_id,
            count(DISTINCT t.id) AS team_count
           FROM public.teams t
             JOIN public.team_members tm ON t.id = tm.team_id
             JOIN public.participant_event_stages pes ON tm.participant_id = pes.participant_id
          WHERE t.status = 'active'::text
          GROUP BY t.sport_event_id, pes.event_stage_id
        ), match_stats AS (
         SELECT m.sport_event_id,
            v.event_stage_id,
            count(m.id) AS match_count,
            count(m.id) FILTER (WHERE m.match_date IS NOT NULL AND m.start_time IS NOT NULL) AS matches_with_schedule,
            count(DISTINCT r.match_id) AS matches_with_result,
            count(DISTINCT r.match_id) FILTER (WHERE (r.result_status)::text = ANY (ARRAY['resultado_validado'::text, 'publicado'::text])) AS results_validated,
            count(DISTINCT r.match_id) FILTER (WHERE (r.result_status)::text = 'publicado'::text) AS results_published
           FROM public.competition_matches m
             JOIN public.venues v ON m.venue_id = v.id
             LEFT JOIN public.competition_match_results r ON m.id = r.match_id
          GROUP BY m.sport_event_id, v.event_stage_id
        ), phase_stats AS (
         SELECT sport_event_id, count(*) AS phase_count FROM public.competition_phases GROUP BY sport_event_id
        ), group_stats AS (
         SELECT cp.sport_event_id, count(cg.id) AS group_count 
         FROM public.competition_groups cg 
         JOIN public.competition_phases cp ON cg.phase_id = cp.id 
         GROUP BY cp.sport_event_id
        ), stage_sport_events AS (
            SELECT sport_event_id, event_stage_id FROM enrolled_stats
            UNION
            SELECT sport_event_id, event_stage_id FROM team_stats
            UNION
            SELECT sport_event_id, event_stage_id FROM match_stats
        )
 SELECT se.id AS sport_event_id,
    se.event_id,
    sse.event_stage_id,
    se.name,
    se.sport_id,
    se.category_id,
    se.is_active,
    s.name AS sport_name,
    s.is_collective,
    c.name AS category_name,
    ser.released_at,
    COALESCE(es.enrolled_count, 0) AS enrolled_count,
    COALESCE(ts.team_count, 0) AS team_count,
    COALESCE(ps.phase_count, 0) AS phase_count,
    COALESCE(gs.group_count, 0) AS group_count,
    COALESCE(ms.match_count, 0) AS match_count,
    COALESCE(ms.matches_with_schedule, 0) AS matches_with_schedule,
    COALESCE(ms.matches_with_result, 0) AS matches_with_result,
    COALESCE(ms.results_validated, 0) AS results_validated,
    COALESCE(ms.results_published, 0) AS results_published
   FROM stage_sport_events sse
     JOIN public.sport_events se ON sse.sport_event_id = se.id
     JOIN public.sports s ON se.sport_id = s.id
     JOIN public.categories c ON se.category_id = c.id
     LEFT JOIN public.sport_event_rules ser ON se.id = ser.sport_event_id
     LEFT JOIN enrolled_stats es ON sse.sport_event_id = es.sport_event_id AND sse.event_stage_id = es.event_stage_id
     LEFT JOIN team_stats ts ON sse.sport_event_id = ts.sport_event_id AND sse.event_stage_id = ts.event_stage_id
     LEFT JOIN match_stats ms ON sse.sport_event_id = ms.sport_event_id AND sse.event_stage_id = ms.event_stage_id
     LEFT JOIN phase_stats ps ON sse.sport_event_id = ps.sport_event_id
     LEFT JOIN group_stats gs ON sse.sport_event_id = gs.sport_event_id;