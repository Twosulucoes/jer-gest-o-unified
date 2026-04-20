-- ============================================================
-- Pesquisa de Satisfação: isolamento por etapa
-- ============================================================

-- 1. Adiciona event_stage_id em pesquisa_surveys
ALTER TABLE public.pesquisa_surveys
  ADD COLUMN IF NOT EXISTS event_stage_id uuid REFERENCES public.event_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pesquisa_surveys_stage
  ON public.pesquisa_surveys(event_stage_id)
  WHERE event_stage_id IS NOT NULL;

-- Backfill: preenche event_stage_id para registros existentes a partir de pesquisa_events
UPDATE public.pesquisa_surveys ps
SET event_stage_id = pe.event_stage_id
FROM public.pesquisa_events pe
WHERE ps.event_id = pe.id
  AND pe.event_stage_id IS NOT NULL
  AND ps.event_stage_id IS NULL;

-- 2. Adiciona event_stage_id em pesquisa_researchers
ALTER TABLE public.pesquisa_researchers
  ADD COLUMN IF NOT EXISTS event_stage_id uuid REFERENCES public.event_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pesquisa_researchers_stage
  ON public.pesquisa_researchers(event_stage_id)
  WHERE event_stage_id IS NOT NULL;

-- Backfill: pesquisadores herdam a etapa do evento ao qual estão vinculados
UPDATE public.pesquisa_researchers pr
SET event_stage_id = pe.event_stage_id
FROM public.pesquisa_events pe
WHERE pr.event_id = pe.id
  AND pe.event_stage_id IS NOT NULL
  AND pr.event_stage_id IS NULL;

-- 3. Atualiza RPC pesquisa_pwa_submit_survey para gravar event_stage_id automaticamente
CREATE OR REPLACE FUNCTION public.pesquisa_pwa_submit_survey(p_session_id uuid, p_payload json)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session record;
  v_event_stage_id uuid;
  v_row_count int;
BEGIN
  SELECT s.researcher_id, s.event_id, s.device_id
  INTO v_session
  FROM pesquisa_sessions s
  WHERE s.id = p_session_id AND s.revoked_at IS NULL AND s.expires_at > now();

  IF v_session IS NULL THEN
    RETURN json_build_object('error', 'SESSION_INVALID');
  END IF;

  -- Resolve automaticamente a etapa a partir do evento de pesquisa vinculado
  SELECT event_stage_id INTO v_event_stage_id
  FROM public.pesquisa_events
  WHERE id = v_session.event_id;

  INSERT INTO pesquisa_surveys (
    client_uuid, researcher_id, event_id, event_stage_id, device_id,
    respondent_type, respondent_age, respondent_gender, mode,
    d1_organizacao, d1_infraestrutura, d1_alimentacao, d1_seguranca, d1_transporte,
    d2_igualdade, d2_acessibilidade, d2_inclusao,
    d3_aprendizado, d3_convivencia, d3_cidadania, d3_superacao,
    ponto_positivo, sugestao, collected_at
  ) VALUES (
    (p_payload->>'client_uuid')::uuid,
    v_session.researcher_id,
    v_session.event_id,
    v_event_stage_id,
    v_session.device_id,
    p_payload->>'respondent_type',
    p_payload->>'respondent_age',
    p_payload->>'respondent_gender',
    p_payload->>'mode',
    (p_payload->>'d1_organizacao')::int,
    (p_payload->>'d1_infraestrutura')::int,
    (p_payload->>'d1_alimentacao')::int,
    (p_payload->>'d1_seguranca')::int,
    (p_payload->>'d1_transporte')::int,
    (p_payload->>'d2_igualdade')::int,
    (p_payload->>'d2_acessibilidade')::int,
    (p_payload->>'d2_inclusao')::int,
    (p_payload->>'d3_aprendizado')::int,
    (p_payload->>'d3_convivencia')::int,
    (p_payload->>'d3_cidadania')::int,
    (p_payload->>'d3_superacao')::int,
    p_payload->>'ponto_positivo',
    p_payload->>'sugestao',
    COALESCE((p_payload->>'collected_at')::timestamptz, now())
  )
  ON CONFLICT (event_id, client_uuid) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  RETURN json_build_object('status', CASE WHEN v_row_count > 0 THEN 'created' ELSE 'duplicate' END);
END;
$$;

-- 4. Atualiza pesquisa_pwa_get_home para incluir a etapa no retorno
CREATE OR REPLACE FUNCTION public.pesquisa_pwa_get_home(p_session_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session record;
  v_researcher_name text;
  v_event record;
  v_today_count int;
  v_recent json;
BEGIN
  SELECT s.researcher_id, s.event_id
  INTO v_session
  FROM pesquisa_sessions s
  WHERE s.id = p_session_id AND s.revoked_at IS NULL AND s.expires_at > now();

  IF v_session IS NULL THEN
    RETURN json_build_object('error', 'SESSION_INVALID');
  END IF;

  SELECT r.name INTO v_researcher_name
  FROM pesquisa_researchers r WHERE r.id = v_session.researcher_id;

  SELECT e.id, e.name, e.location, e.event_date, e.event_stage_id,
         es.name AS stage_name, es.kind AS stage_kind
  INTO v_event
  FROM pesquisa_events e
  LEFT JOIN event_stages es ON es.id = e.event_stage_id
  WHERE e.id = v_session.event_id;

  SELECT COUNT(*) INTO v_today_count
  FROM pesquisa_surveys
  WHERE researcher_id = v_session.researcher_id
    AND collected_at::date = CURRENT_DATE;

  SELECT json_agg(t) INTO v_recent FROM (
    SELECT respondent_type, respondent_age, collected_at
    FROM pesquisa_surveys
    WHERE researcher_id = v_session.researcher_id
    ORDER BY collected_at DESC LIMIT 10
  ) t;

  RETURN json_build_object(
    'researcher_name', v_researcher_name,
    'event', json_build_object(
      'id', v_event.id,
      'name', v_event.name,
      'location', v_event.location,
      'event_date', v_event.event_date,
      'event_stage', CASE
        WHEN v_event.event_stage_id IS NOT NULL THEN
          json_build_object('id', v_event.event_stage_id, 'name', v_event.stage_name, 'kind', v_event.stage_kind)
        ELSE NULL
      END
    ),
    'today_count', v_today_count,
    'recent', COALESCE(v_recent, '[]'::json)
  );
END;
$$;
