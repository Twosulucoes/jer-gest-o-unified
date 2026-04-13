
-- =============================================================
-- 1) SANITIZE existing data
-- =============================================================
UPDATE public.competition_match_results
SET result_status = 'resultado_lancado', updated_at = now()
WHERE result_status = 'launched';

UPDATE public.competition_match_results
SET result_status = 'resultado_validado', updated_at = now()
WHERE result_status = 'validated';

-- =============================================================
-- 2) Add combat_detail JSONB column
-- =============================================================
ALTER TABLE public.competition_match_results
  ADD COLUMN IF NOT EXISTS combat_detail jsonb;

CREATE INDEX IF NOT EXISTS idx_cmr_combat_detail
  ON public.competition_match_results USING gin (combat_detail);

-- =============================================================
-- 3) Create audit_events table
-- =============================================================
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert audit" ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can read audit" ON public.audit_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================================
-- 4) Fix rpc_launch_match_result — use resultado_lancado
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_launch_match_result(p_event_id uuid, p_match_id uuid, p_payload jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match record;
  v_entry record;
  v_entry_data jsonb;
  v_results_count int := 0;
BEGIN
  SELECT * INTO v_match FROM competition_matches
  WHERE id = p_match_id AND event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada para este evento' USING ERRCODE = 'P0001';
  END IF;

  FOR v_entry_data IN SELECT * FROM jsonb_array_elements(p_payload->'entries')
  LOOP
    SELECT * INTO v_entry FROM competition_match_entries
    WHERE id = (v_entry_data->>'match_entry_id')::uuid AND match_id = p_match_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Entry % não pertence à partida %', v_entry_data->>'match_entry_id', p_match_id
        USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO competition_match_results (
      match_id, match_entry_id, outcome, score, time_ms, distance_cm, points, position,
      result_status, recorded_by, recorded_at, combat_detail
    ) VALUES (
      p_match_id,
      (v_entry_data->>'match_entry_id')::uuid,
      v_entry_data->>'outcome',
      v_entry_data->>'score',
      (v_entry_data->>'time_ms')::bigint,
      (v_entry_data->>'distance_cm')::bigint,
      (v_entry_data->>'points')::numeric,
      (v_entry_data->>'position')::int,
      'resultado_lancado',
      COALESCE(auth.uid()::text, 'system'),
      now(),
      CASE WHEN v_entry_data ? 'combat_detail' THEN (v_entry_data->'combat_detail') ELSE NULL END
    )
    ON CONFLICT (match_entry_id) DO UPDATE SET
      outcome = EXCLUDED.outcome,
      score = EXCLUDED.score,
      time_ms = EXCLUDED.time_ms,
      distance_cm = EXCLUDED.distance_cm,
      points = EXCLUDED.points,
      position = EXCLUDED.position,
      result_status = 'resultado_lancado',
      recorded_by = EXCLUDED.recorded_by,
      recorded_at = now(),
      combat_detail = COALESCE(EXCLUDED.combat_detail, competition_match_results.combat_detail),
      updated_at = now();

    v_results_count := v_results_count + 1;
  END LOOP;

  UPDATE competition_matches SET status = 'finished', updated_at = now()
  WHERE id = p_match_id;

  RETURN json_build_object(
    'ok', true,
    'match_id', p_match_id,
    'results_saved', v_results_count
  );
END;
$function$;

-- =============================================================
-- 5) Fix rpc_validate — use resultado_validado
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_validate_results_for_sport_event(p_event_id uuid, p_sport_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretaria') OR public.has_role(auth.uid(), 'coordenacao_tecnica')) THEN
    RAISE EXCEPTION 'Permissão negada para validar resultados' USING ERRCODE = 'P0003';
  END IF;

  UPDATE public.competition_match_results cmr
  SET result_status = 'resultado_validado',
      validated_at = now(),
      validated_by = auth.uid(),
      updated_at = now()
  FROM public.competition_matches cm
  WHERE cmr.match_id = cm.id
    AND cm.event_id = p_event_id
    AND cm.sport_event_id = p_sport_event_id
    AND cmr.result_status = 'resultado_lancado';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('validated_count', v_count);
END;
$function$;

-- =============================================================
-- 6) Fix rpc_publish — filter resultado_validado
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_publish_results_for_sport_event(p_event_id uuid, p_sport_event_id uuid, p_bulletin_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int;
  v_bulletin_status text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem publicar resultados' USING ERRCODE = 'P0003';
  END IF;

  SELECT status INTO v_bulletin_status FROM public.official_bulletins WHERE id = p_bulletin_id;
  IF v_bulletin_status IS NULL OR v_bulletin_status <> 'published' THEN
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

  RETURN jsonb_build_object('published_count', v_count, 'bulletin_id', p_bulletin_id);
END;
$function$;

-- =============================================================
-- 7) rpc_sync_match_scores_to_results
-- =============================================================
CREATE OR REPLACE FUNCTION public.rpc_sync_match_scores_to_results(p_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  v_ms record;
BEGIN
  FOR v_ms IN
    SELECT ms.match_id, ms.match_entry_id, ms.score_final, ms.outcome
    FROM match_scores ms
    WHERE ms.match_id = p_match_id
  LOOP
    INSERT INTO competition_match_results (
      match_id, match_entry_id, score, outcome,
      result_status, recorded_by, recorded_at
    ) VALUES (
      v_ms.match_id,
      v_ms.match_entry_id,
      v_ms.score_final,
      v_ms.outcome,
      'resultado_lancado',
      COALESCE(auth.uid()::text, 'system'),
      now()
    )
    ON CONFLICT (match_entry_id) DO UPDATE SET
      score = EXCLUDED.score,
      outcome = EXCLUDED.outcome,
      result_status = 'resultado_lancado',
      recorded_by = EXCLUDED.recorded_by,
      recorded_at = now(),
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('synced_count', v_count);
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_sync_match_scores_to_results FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_sync_match_scores_to_results TO authenticated;
