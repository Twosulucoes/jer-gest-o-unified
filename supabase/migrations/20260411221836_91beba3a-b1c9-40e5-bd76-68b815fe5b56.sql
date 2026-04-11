
CREATE OR REPLACE FUNCTION public.rpc_reprocess_event(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_map_result jsonb;
  v_irreg_result jsonb;
  v_open_count int;
BEGIN
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'event_id obrigatório' USING ERRCODE='22023';
  END IF;

  -- Step 1: refresh sport event prova map
  v_map_result := public.refresh_sport_event_prova_map(p_event_id);

  -- Step 2: recompute participation irregularities
  v_irreg_result := public.recompute_participation_irregularities(p_event_id);

  -- Count open irregularities
  SELECT COUNT(*) INTO v_open_count
  FROM public.participation_irregularities
  WHERE event_id = p_event_id AND status = 'open';

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'map_result', v_map_result,
    'irregularities_result', v_irreg_result,
    'irregularities_open_count', v_open_count,
    'processed_at', now()
  );
END;
$$;
