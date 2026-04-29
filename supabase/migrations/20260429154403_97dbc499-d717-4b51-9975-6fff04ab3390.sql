-- Update pwa_search_person to include event_id filter (already partially present) and ensure it's efficient
CREATE OR REPLACE FUNCTION public.pwa_search_person(p_query text, p_facility_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 10, p_event_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_results jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_results
  FROM (
    SELECT 
      p.id AS participant_id, 
      pe.full_name, 
      pe.birth_date, 
      pe.gender, 
      pe.cpf, 
      p.participant_type, 
      p.delegation_id,
      inst.name as delegation_name,
      EXISTS(SELECT 1 FROM public.lodging_occupancies o WHERE o.participant_id = p.id AND o.status = 'checked_in') AS is_checked_in
    FROM public.participants p 
    JOIN public.people pe ON pe.id = p.person_id
    LEFT JOIN public.delegations d ON d.id = p.delegation_id
    LEFT JOIN public.institutions inst ON inst.id = d.institution_id
    WHERE (pe.full_name ILIKE '%' || p_query || '%' OR pe.cpf ILIKE '%' || p_query || '%') 
      AND p.is_active = true
      AND (p_event_id IS NULL OR p.event_id = p_event_id)
    ORDER BY pe.full_name 
    LIMIT p_limit
  ) r;
  RETURN jsonb_build_object('ok', true, 'results', v_results);
END;
$function$;

-- Update lodging_occupancies RLS to be more restrictive based on roles
-- (Assuming standard roles, just making sure they don't see across phases if we add that logic later)
-- For now, let's focus on the PWA query consistency.

-- Re-verify that lodging_locations policies allow stage filtering
-- The current policy is role-based, which is fine, but the app must pass the filters.
