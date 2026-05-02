DROP FUNCTION IF EXISTS public.get_unhandled_referee_indisponibilities(uuid);

CREATE OR REPLACE FUNCTION public.get_unhandled_referee_indisponibilities(p_etapa_id UUID)
RETURNS TABLE (id UUID) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ri.id
  FROM public.referee_indisponibilities ri
  WHERE ri.event_stage_id = p_etapa_id
  AND ri.status = 'pending';
END;
$$;