-- 1. Drop dependent objects to allow type changes
DROP VIEW IF EXISTS public.public_results_view;
DROP FUNCTION IF EXISTS public.get_participant_sport_history(_participant_id uuid);
DROP VIEW IF EXISTS public.vw_participant_sport_history;

-- 2. Drop ALL policies on affected tables
DROP POLICY IF EXISTS "Admin full access competition_match_results" ON public.competition_match_results;
DROP POLICY IF EXISTS "Coord modalidade manage match_results" ON public.competition_match_results;
DROP POLICY IF EXISTS "Coordenacao tecnica can manage competition_match_results" ON public.competition_match_results;
DROP POLICY IF EXISTS "Mesario can read assigned match_results" ON public.competition_match_results;
DROP POLICY IF EXISTS "Public can read validated and published results" ON public.competition_match_results;
DROP POLICY IF EXISTS "Public can read published results" ON public.competition_match_results;
DROP POLICY IF EXISTS "Secretaria can manage competition_match_results" ON public.competition_match_results;

DROP POLICY IF EXISTS "Admin full access official_bulletins" ON public.official_bulletins;
DROP POLICY IF EXISTS "Coordenacao tecnica can manage official_bulletins" ON public.official_bulletins;
DROP POLICY IF EXISTS "Public can view published bulletins" ON public.official_bulletins;
DROP POLICY IF EXISTS "Secretaria full access official_bulletins" ON public.official_bulletins;

-- 3. Create Enums for standardization
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bulletin_status') THEN
        CREATE TYPE public.bulletin_status AS ENUM ('rascunho', 'publicado', 'cancelado');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_result_status') THEN
        CREATE TYPE public.match_result_status AS ENUM ('resultado_lancado', 'resultado_validado', 'publicado');
    END IF;
END $$;

-- 4. Prepare tables (drop defaults)
ALTER TABLE public.official_bulletins ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.competition_match_results ALTER COLUMN result_status DROP DEFAULT;

-- 5. Standardize data before conversion
UPDATE public.official_bulletins 
SET status = CASE 
    WHEN status IN ('draft', 'rascunho') THEN 'rascunho'
    WHEN status IN ('published', 'publicado') THEN 'publicado'
    WHEN status = 'cancelled' THEN 'cancelado'
    ELSE 'rascunho'
END;

UPDATE public.competition_match_results
SET result_status = CASE
    WHEN result_status IN ('launched', 'resultado_lancado') THEN 'resultado_lancado'
    WHEN result_status IN ('validated', 'resultado_validado', 'validated') THEN 'resultado_validado'
    WHEN result_status = 'publicado' THEN 'publicado'
    ELSE 'resultado_lancado'
END;

-- 6. Alter column types to Enums
ALTER TABLE public.official_bulletins 
ALTER COLUMN status TYPE public.bulletin_status USING status::public.bulletin_status;

ALTER TABLE public.competition_match_results 
ALTER COLUMN result_status TYPE public.match_result_status USING result_status::public.match_result_status;

-- 7. Restore defaults
ALTER TABLE public.official_bulletins ALTER COLUMN status SET DEFAULT 'rascunho'::public.bulletin_status;
ALTER TABLE public.competition_match_results ALTER COLUMN result_status SET DEFAULT 'resultado_lancado'::public.match_result_status;

-- 8. Recreate RLS policies
-- official_bulletins
CREATE POLICY "Admin full access official_bulletins" ON public.official_bulletins FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Coordenacao tecnica can manage official_bulletins" ON public.official_bulletins FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'coordenacao_tecnica'::app_role));
CREATE POLICY "Public can view published bulletins" ON public.official_bulletins FOR SELECT USING (status = 'publicado');
CREATE POLICY "Secretaria full access official_bulletins" ON public.official_bulletins FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'secretaria'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'secretaria'::app_role));

-- competition_match_results
CREATE POLICY "Admin full access competition_match_results" ON public.competition_match_results FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Coord modalidade manage match_results" ON public.competition_match_results FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coordenador_modalidade'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'coordenador_modalidade'::app_role));
CREATE POLICY "Coordenacao tecnica can manage competition_match_results" ON public.competition_match_results FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'coordenacao_tecnica'::app_role));
CREATE POLICY "Mesario can read assigned match_results" ON public.competition_match_results FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'mesario'::app_role) AND (EXISTS (SELECT 1 FROM public.match_user_assignments mua WHERE mua.match_id = competition_match_results.match_id AND mua.user_id = auth.uid())));
CREATE POLICY "Public can read validated and published results" ON public.competition_match_results FOR SELECT USING (result_status IN ('resultado_validado', 'publicado'));
CREATE POLICY "Secretaria can manage competition_match_results" ON public.competition_match_results FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'secretaria'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'secretaria'::app_role));

-- 9. Recreate View: vw_participant_sport_history
CREATE VIEW public.vw_participant_sport_history WITH (security_invoker = true) AS
SELECT p.id AS participant_id, m.event_id, se.id AS sport_event_id, se.name AS sport_event_name, 'individual'::text AS participation_type, NULL::uuid AS team_id, NULL::text AS team_name, ph.id AS phase_id, ph.name AS phase_name, cg.id AS group_id, cg.name AS group_name, m.id AS match_id, m.match_date, me.id AS entry_id, r.id AS result_id, r.score, r."position", r.result_text, r.outcome, r.time_ms, r.distance_cm, r.points, r.result_status::text, r.validated_at, r.published_at, r.notes AS result_notes, d.id AS delegation_id, i.name AS delegation_name, i.id AS institution_id, i.name AS institution_name, att.attempts_count, att.best_attempt_cm, att.best_attempt_ms, att.best_attempt_points, st.aggregated_stats_json, COALESCE(pen.penalties_count, 0)::integer AS penalties_count
FROM competition_match_entries me JOIN participant_sport_events pse ON pse.id = me.participant_sport_event_id JOIN participants p ON p.id = pse.participant_id JOIN competition_matches m ON m.id = me.match_id JOIN competition_phases ph ON ph.id = m.phase_id JOIN sport_events se ON se.id = COALESCE(m.sport_event_id, ph.sport_event_id) LEFT JOIN competition_groups cg ON cg.id = m.group_id LEFT JOIN competition_match_results r ON r.match_entry_id = me.id LEFT JOIN delegations d ON d.id = p.delegation_id LEFT JOIN institutions i ON i.id = d.institution_id LEFT JOIN LATERAL (SELECT count(*)::integer AS attempts_count, max(ma.value_cm) AS best_attempt_cm, min(CASE WHEN ma.value_ms > 0 THEN ma.value_ms END) AS best_attempt_ms, max(ma.value_points) AS best_attempt_points FROM match_attempts ma WHERE ma.match_entry_id = me.id AND ma.is_valid = true) att ON true LEFT JOIN LATERAL (SELECT jsonb_object_agg(sub.stat_key, sub.total) AS aggregated_stats_json FROM (SELECT mps.stat_key, sum(mps.stat_value)::numeric AS total FROM match_player_stats mps WHERE mps.match_id = m.id AND mps.participant_id = p.id GROUP BY mps.stat_key) sub) st ON true LEFT JOIN LATERAL (SELECT count(*)::integer AS penalties_count FROM match_penalties mp WHERE mp.match_id = m.id AND mp.participant_id = p.id) pen ON true
WHERE me.participant_sport_event_id IS NOT NULL
UNION ALL
SELECT p.id AS participant_id, m.event_id, se.id AS sport_event_id, se.name AS sport_event_name, 'team'::text AS participation_type, t.id AS team_id, t.name AS team_name, ph.id AS phase_id, ph.name AS phase_name, cg.id AS group_id, cg.name AS group_name, m.id AS match_id, m.match_date, me.id AS entry_id, r.id AS result_id, r.score, r."position", r.result_text, r.outcome, r.time_ms, r.distance_cm, r.points, r.result_status::text, r.validated_at, r.published_at, r.notes AS result_notes, d.id AS delegation_id, i.name AS delegation_name, i.id AS institution_id, i.name AS institution_name, 0::integer AS attempts_count, NULL::bigint AS best_attempt_cm, NULL::bigint AS best_attempt_ms, NULL::numeric AS best_attempt_points, st.aggregated_stats_json, COALESCE(pen.penalties_count, 0)::integer AS penalties_count
FROM competition_match_entries me JOIN teams t ON t.id = me.team_id JOIN team_members tm ON tm.team_id = t.id AND tm.is_active = true JOIN participants p ON p.id = tm.participant_id JOIN competition_matches m ON m.id = me.match_id JOIN competition_phases ph ON ph.id = m.phase_id JOIN sport_events se ON se.id = COALESCE(m.sport_event_id, ph.sport_event_id) LEFT JOIN competition_groups cg ON cg.id = m.group_id LEFT JOIN competition_match_results r ON r.match_entry_id = me.id LEFT JOIN delegations d ON d.id = p.delegation_id LEFT JOIN institutions i ON i.id = d.institution_id LEFT JOIN LATERAL (SELECT jsonb_object_agg(sub.stat_key, sub.total) AS aggregated_stats_json FROM (SELECT mps.stat_key, sum(mps.stat_value)::numeric AS total FROM match_player_stats mps WHERE mps.match_id = m.id AND mps.participant_id = p.id GROUP BY mps.stat_key) sub) st ON true LEFT JOIN LATERAL (SELECT count(*)::integer AS penalties_count FROM match_penalties mp WHERE mp.match_id = m.id AND mp.participant_id = p.id) pen ON true
WHERE me.team_id IS NOT NULL
UNION ALL
SELECT p.id AS participant_id, se.event_id, se.id AS sport_event_id, se.name AS sport_event_name, 'individual'::text AS participation_type, NULL::uuid AS team_id, NULL::text AS team_name, NULL::uuid AS phase_id, NULL::text AS phase_name, NULL::uuid AS group_id, NULL::text AS group_name, NULL::uuid AS match_id, NULL::date AS match_date, NULL::uuid AS entry_id, NULL::uuid AS result_id, NULL::text AS score, NULL::integer AS "position", NULL::text AS result_text, NULL::text AS outcome, NULL::bigint AS time_ms, NULL::bigint AS distance_cm, NULL::numeric AS points, NULL::text AS result_status, NULL::timestamp with time zone AS validated_at, NULL::timestamp with time zone AS published_at, NULL::text AS result_notes, d.id AS delegation_id, i.name AS delegation_name, i.id AS institution_id, i.name AS institution_name, 0::integer AS attempts_count, NULL::bigint AS best_attempt_cm, NULL::bigint AS best_attempt_ms, NULL::numeric AS best_attempt_points, NULL::jsonb AS aggregated_stats_json, 0::integer AS penalties_count
FROM participant_sport_events pse JOIN participants p ON p.id = pse.participant_id JOIN sport_events se ON se.id = pse.sport_event_id LEFT JOIN delegations d ON d.id = p.delegation_id LEFT JOIN institutions i ON i.id = d.institution_id
WHERE pse.status = 'confirmed' AND NOT EXISTS (SELECT 1 FROM competition_match_entries me2 WHERE me2.participant_sport_event_id = pse.id);

-- 9. Recreate RPC: get_participant_sport_history
CREATE OR REPLACE FUNCTION public.get_participant_sport_history(_participant_id uuid) RETURNS SETOF public.vw_participant_sport_history LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$ SELECT * FROM public.vw_participant_sport_history WHERE participant_id = _participant_id ORDER BY match_date DESC NULLS LAST, sport_event_name, phase_name; $$;

-- 10. Recreate View: public_results_view
CREATE VIEW public.public_results_view WITH (security_invoker = true) AS
SELECT cm.event_id, e.name AS event_name, e.year AS event_year, se.id AS sport_event_id, se.name AS sport_event_name, s.id AS sport_id, s.name AS sport_name, c.name AS category_name, cm.id AS match_id, cm.match_number, cm.match_date, cm.start_time, v.name AS venue_name, CASE WHEN cme.team_id IS NOT NULL THEN 'team'::text ELSE 'athlete'::text END AS entry_type, COALESCE(t.name, ppl.full_name) AS display_name, inst.name AS institution_name, cmr.outcome, cmr.score, cmr.time_ms, cmr.distance_cm, cmr.points, cmr."position", cmr.result_status, b.number AS bulletin_number, b.title AS bulletin_title, b.published_at AS bulletin_published_at, COALESCE(pse.event_stage_id, t_pse.event_stage_id) AS event_stage_id
FROM competition_match_results cmr JOIN competition_match_entries cme ON cme.id = cmr.match_entry_id JOIN competition_matches cm ON cm.id = cmr.match_id JOIN events e ON e.id = cm.event_id JOIN sport_events se ON se.id = cm.sport_event_id JOIN sports s ON s.id = se.sport_id LEFT JOIN categories c ON c.id = se.category_id LEFT JOIN venues v ON v.id = cm.venue_id LEFT JOIN teams t ON t.id = cme.team_id LEFT JOIN participant_sport_events pse ON pse.id = cme.participant_sport_event_id LEFT JOIN participants part ON part.id = pse.participant_id LEFT JOIN people ppl ON ppl.id = part.person_id LEFT JOIN delegations d ON d.id = COALESCE(t.delegation_id, part.delegation_id) LEFT JOIN institutions inst ON inst.id = d.institution_id LEFT JOIN official_bulletins b ON b.id = cmr.published_bulletin_id LEFT JOIN LATERAL (SELECT pse2.event_stage_id FROM participant_sport_events pse2 JOIN participants p2 ON p2.id = pse2.participant_id WHERE pse2.sport_event_id = t.sport_event_id AND p2.delegation_id = t.delegation_id AND pse2.event_stage_id IS NOT NULL LIMIT 1) t_pse ON t.id IS NOT NULL
WHERE cmr.result_status IN ('publicado', 'resultado_validado');

-- 11. Update other RPCs to use the new Enum values
CREATE OR REPLACE FUNCTION public.rpc_publish_bulletin(p_bulletin_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN UPDATE public.official_bulletins SET status = 'publicado', published_at = now(), published_by = auth.uid(), updated_at = now(), updated_by = auth.uid() WHERE id = p_bulletin_id AND status = 'rascunho'; IF NOT FOUND THEN RAISE EXCEPTION 'Boletim não encontrado ou já publicado.' USING ERRCODE = 'P0001'; END IF; RETURN jsonb_build_object('id', p_bulletin_id, 'status', 'publicado'); END; $$;
CREATE OR REPLACE FUNCTION public.rpc_publish_results_for_sport_event(p_event_id uuid, p_sport_event_id uuid, p_bulletin_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$ DECLARE v_count int; v_bulletin_status public.bulletin_status; BEGIN SELECT status INTO v_bulletin_status FROM public.official_bulletins WHERE id = p_bulletin_id; IF v_bulletin_status IS NULL OR v_bulletin_status <> 'publicado' THEN RAISE EXCEPTION 'Boletim precisa estar publicado antes de vincular resultados.' USING ERRCODE = 'P0001'; END IF; UPDATE public.competition_match_results cmr SET result_status = 'publicado', published_at = now(), published_by = auth.uid(), published_bulletin_id = p_bulletin_id, updated_at = now() FROM public.competition_matches cm WHERE cmr.match_id = cm.id AND cm.event_id = p_event_id AND cm.sport_event_id = p_sport_event_id AND cmr.result_status = 'resultado_validado'; GET DIAGNOSTICS v_count = ROW_COUNT; RETURN jsonb_build_object('published_count', v_count); END; $$;
CREATE OR REPLACE FUNCTION public.rpc_validate_results_for_sport_event(p_event_id uuid, p_sport_event_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$ DECLARE v_count int; BEGIN IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretaria') OR public.has_role(auth.uid(), 'coordenacao_tecnica')) THEN RAISE EXCEPTION 'Permissão negada para validar resultados' USING ERRCODE = 'P0003'; END IF; UPDATE public.competition_match_results cmr SET result_status = 'resultado_validado', validated_at = now(), validated_by = auth.uid(), updated_at = now() FROM public.competition_matches cm WHERE cmr.match_id = cm.id AND cm.event_id = p_event_id AND cm.sport_event_id = p_sport_event_id AND cmr.result_status = 'resultado_lancado'; GET DIAGNOSTICS v_count = ROW_COUNT; RETURN jsonb_build_object('validated_count', v_count); END; $$;
