-- Local da aplicação da pesquisa por pesquisador (campo operacional de relatório)
ALTER TABLE public.pesquisa_surveys
  ADD COLUMN IF NOT EXISTS application_location text;

CREATE OR REPLACE FUNCTION public.pesquisa_pwa_submit_survey(p_session_id uuid, p_payload json)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session record;
  v_row_count int;
BEGIN
  SELECT s.researcher_id, s.event_id, s.device_id
  INTO v_session
  FROM pesquisa_sessions s
  WHERE s.id = p_session_id AND s.revoked_at IS NULL AND s.expires_at > now();

  IF v_session IS NULL THEN
    RETURN json_build_object('error', 'SESSION_INVALID');
  END IF;

  INSERT INTO pesquisa_surveys (
    client_uuid, researcher_id, event_id, device_id,
    respondent_type, respondent_age, respondent_gender, mode,
    d1_organizacao, d1_infraestrutura, d1_alimentacao, d1_seguranca, d1_transporte,
    d2_igualdade, d2_acessibilidade, d2_inclusao,
    d3_aprendizado, d3_convivencia, d3_cidadania, d3_superacao,
    ponto_positivo, sugestao, collected_at, application_location
  ) VALUES (
    (p_payload->>'client_uuid')::uuid,
    v_session.researcher_id,
    v_session.event_id,
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
    COALESCE((p_payload->>'collected_at')::timestamptz, now()),
    NULLIF(trim(p_payload->>'application_location'), '')
  )
  ON CONFLICT (event_id, client_uuid) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  RETURN json_build_object('status', CASE WHEN v_row_count > 0 THEN 'created' ELSE 'duplicate' END);
END;
$$;
