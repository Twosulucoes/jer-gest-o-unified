-- 1) Standardize status in official_bulletins
UPDATE public.official_bulletins SET status = 'publicado' WHERE status = 'published';

-- 2) Update rpc_publish_bulletin to use 'publicado'
CREATE OR REPLACE FUNCTION public.rpc_publish_bulletin(p_bulletin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.official_bulletins
  SET status = 'publicado', published_at = now(), published_by = auth.uid(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_bulletin_id AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boletim não encontrado ou já publicado.' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('id', p_bulletin_id, 'status', 'publicado');
END;
$$;

-- 3) Fix other functions that check for 'published'
CREATE OR REPLACE FUNCTION public.rpc_publish_results_for_sport_event(p_event_id uuid, p_sport_event_id uuid, p_bulletin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count int;
  v_bulletin_status text;
BEGIN
  SELECT status INTO v_bulletin_status FROM public.official_bulletins WHERE id = p_bulletin_id;
  IF v_bulletin_status IS NULL OR v_bulletin_status <> 'publicado' THEN
    RAISE EXCEPTION 'Boletim precisa estar publicado antes de vincular resultados.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.competition_match_results cmr
  SET result_status = 'publicado',
      published_at = now(),
      published_by = auth.uid(),
      published_bulletin_id = p_bulletin_id,
      updated_at = now()
  FROM public.competition_matches cm
  WHERE cmr.match_id = cm.id
    AND cm.event_id = p_event_id
    AND cm.sport_event_id = p_sport_event_id
    AND cmr.result_status = 'resultado_validado';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('published_count', v_count);
END;
$$;

-- 4) RLS for official_bulletins
-- Add public access
CREATE POLICY "Public can view published bulletins"
ON public.official_bulletins FOR SELECT
USING (status = 'publicado');

-- 5) RLS for competition_match_results
-- Update existing "Public can read published results"
DROP POLICY IF EXISTS "Public can read published results" ON public.competition_match_results;

CREATE POLICY "Public can read validated and published results"
ON public.competition_match_results FOR SELECT
USING (result_status IN ('resultado_validado', 'publicado'));

-- 6) Adjust Secretaria policies if needed (though they usually have ALL access)
-- If we want to ensure they see published ones, they already do via ALL.
-- But if the user wants them "protected", we might need to modify their existing policies.
-- Let's keep their management access but ensure they have clear SELECT access.
-- The existing "Secretaria can manage" policy for competition_match_results and 
-- "Secretaria full access" for official_bulletins are already sufficient for SELECT.
