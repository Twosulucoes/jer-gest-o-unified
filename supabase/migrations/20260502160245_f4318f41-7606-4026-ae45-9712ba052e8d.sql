-- 1. Simple Views
DROP VIEW IF EXISTS public.vw_import_errors CASCADE;
CREATE VIEW public.vw_import_errors WITH (security_invoker = true) AS 
SELECT ire.id, il.file_name, il.created_at AS imported_at, ire.row_number, ire.error_code, ire.error_message, (ire.payload ->> 'full_name'::text) AS aluno, (ire.payload ->> 'institution_name'::text) AS escola, (ire.payload ->> 'sport_name'::text) AS modalidade, (ire.payload ->> 'prova_name'::text) AS prova
FROM import_row_errors ire
LEFT JOIN import_logs il ON il.id = ire.import_log_id
ORDER BY ire.import_log_id, ire.row_number;

DROP VIEW IF EXISTS public.v_venue_dependencies CASCADE;
CREATE VIEW public.v_venue_dependencies WITH (security_invoker = true) AS 
SELECT v.id AS venue_id, v.event_id, COALESCE(m.total, (0)::bigint) AS matches_total, COALESCE(m.future, (0)::bigint) AS matches_future, COALESCE(m.past, (0)::bigint) AS matches_past
FROM venues v
LEFT JOIN LATERAL ( SELECT count(*) AS total, count(*) FILTER (WHERE competition_matches.match_date IS NOT NULL AND competition_matches.match_date >= now()) AS future, count(*) FILTER (WHERE competition_matches.match_date IS NOT NULL AND competition_matches.match_date < now()) AS past FROM competition_matches WHERE competition_matches.venue_id = v.id) m ON true;

-- 2. Critical Functions (fixing signatures)
ALTER FUNCTION public.get_participant_sport_history(uuid) SET search_path = public;
ALTER FUNCTION public.pwa_assign_bed(text, text, text) SET search_path = public;
ALTER FUNCTION public.pwa_lodging_checkin(text, text, uuid, uuid, text) SET search_path = public;
ALTER FUNCTION public.pwa_lodging_checkout(text, text, uuid) SET search_path = public;
ALTER FUNCTION public.pwa_lodging_register_presence(text, text, uuid, text) SET search_path = public;
ALTER FUNCTION public.resolve_qr(text) SET search_path = public;
