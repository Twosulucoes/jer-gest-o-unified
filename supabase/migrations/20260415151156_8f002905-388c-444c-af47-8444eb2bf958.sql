CREATE OR REPLACE VIEW public.public_results_view AS
SELECT cm.event_id,
    e.name AS event_name,
    e.year AS event_year,
    se.id AS sport_event_id,
    se.name AS sport_event_name,
    s.id AS sport_id,
    s.name AS sport_name,
    c.name AS category_name,
    cm.id AS match_id,
    cm.match_number,
    cm.match_date,
    cm.start_time,
    v.name AS venue_name,
    CASE
        WHEN cme.team_id IS NOT NULL THEN 'team'::text
        ELSE 'athlete'::text
    END AS entry_type,
    COALESCE(t.name, ppl.full_name) AS display_name,
    inst.name AS institution_name,
    cmr.outcome,
    cmr.score,
    cmr.time_ms,
    cmr.distance_cm,
    cmr.points,
    cmr."position",
    cmr.result_status,
    b.number AS bulletin_number,
    b.title AS bulletin_title,
    b.published_at AS bulletin_published_at
FROM competition_match_results cmr
    JOIN competition_match_entries cme ON cme.id = cmr.match_entry_id
    JOIN competition_matches cm ON cm.id = cmr.match_id
    JOIN events e ON e.id = cm.event_id
    JOIN sport_events se ON se.id = cm.sport_event_id
    JOIN sports s ON s.id = se.sport_id
    LEFT JOIN categories c ON c.id = se.category_id
    LEFT JOIN venues v ON v.id = cm.venue_id
    LEFT JOIN teams t ON t.id = cme.team_id
    LEFT JOIN participant_sport_events pse ON pse.id = cme.participant_sport_event_id
    LEFT JOIN participants part ON part.id = pse.participant_id
    LEFT JOIN people ppl ON ppl.id = part.person_id
    LEFT JOIN delegations d ON d.id = COALESCE(t.delegation_id, part.delegation_id)
    LEFT JOIN institutions inst ON inst.id = d.institution_id
    LEFT JOIN official_bulletins b ON b.id = cmr.published_bulletin_id
WHERE cmr.result_status = 'publicado'::text;