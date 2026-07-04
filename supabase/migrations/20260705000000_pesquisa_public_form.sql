-- ============================================================
-- Pesquisa de Satisfação: formulário PÚBLICO (coleta anônima via QR code)
--
-- Adiciona um segundo caminho de coleta, sem login de pesquisador:
--   - researcher_id passa a aceitar NULL (coleta pública não tem pesquisador)
--   - novo mode 'publico'
--   - flag opt-in public_enabled por evento (só aceita coleta pública se ligado)
--   - validador COMPARTILHADO pesquisa_clean_answers (extraído do submit por sessão)
--   - novo RPC anônimo pesquisa_public_submit_survey(event_id, payload)
--
-- O fluxo do pesquisador (login por PIN + pesquisa_pwa_submit_survey) é preservado;
-- apenas passa a reutilizar o validador compartilhado (sem mudança de comportamento).
-- ============================================================

-- 1. Coleta pública não tem pesquisador nem sessão.
ALTER TABLE public.pesquisa_surveys ALTER COLUMN researcher_id DROP NOT NULL;

-- 2. Novo modo 'publico' (coleta autoatendida via QR).
ALTER TABLE public.pesquisa_surveys DROP CONSTRAINT IF EXISTS pesquisa_surveys_mode_check;
ALTER TABLE public.pesquisa_surveys
  ADD CONSTRAINT pesquisa_surveys_mode_check
  CHECK (mode IN ('autopreenchimento', 'entrevista', 'publico'));

-- 3. Opt-in por evento: o form público só coleta quando habilitado pelo admin.
ALTER TABLE public.pesquisa_events
  ADD COLUMN IF NOT EXISTS public_enabled boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 4. Validador compartilhado: avalia visibleIf, exige obrigatórias visíveis,
--    checa faixa de escala / opção válida / tipo, e descarta chaves fora do
--    config ou escondidas. NÃO lança: retorna { ok:false, reason } ou
--    { ok:true, answers:<limpo> }. Idêntico à validação que estava inline no
--    submit por sessão (migration 20260704010000).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pesquisa_clean_answers(p_config jsonb, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_clean jsonb := '{}'::jsonb;
  v_q jsonb;
  v_key text;
  v_type text;
  v_val jsonb;
  v_vis jsonb;
  v_ctrl jsonb;
  v_num numeric;
  v_scale_max int;
BEGIN
  IF jsonb_typeof(p_answers) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'answers_not_object');
  END IF;

  -- Sem config v2: nada a validar; devolve as respostas como estão.
  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object' OR NOT (p_config ? 'questions') THEN
    RETURN jsonb_build_object('ok', true, 'answers', p_answers);
  END IF;

  FOR v_q IN SELECT jsonb_array_elements(p_config->'questions') LOOP
    v_key := v_q->>'key';
    v_type := v_q->>'type';

    -- Exibição condicional: pergunta escondida é ignorada.
    v_vis := v_q->'visibleIf';
    IF v_vis IS NOT NULL AND jsonb_typeof(v_vis) = 'object' THEN
      v_ctrl := p_answers -> (v_vis->>'key');
      IF v_ctrl IS NULL OR NOT (COALESCE(v_vis->'values','[]'::jsonb) @> jsonb_build_array(v_ctrl)) THEN
        CONTINUE;
      END IF;
    END IF;

    v_val := p_answers -> v_key;

    IF COALESCE((v_q->>'required')::boolean, false) THEN
      IF v_val IS NULL OR jsonb_typeof(v_val) = 'null'
         OR (jsonb_typeof(v_val) = 'string' AND btrim(v_val #>> '{}') = '')
         OR (jsonb_typeof(v_val) = 'array' AND jsonb_array_length(v_val) = 0) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'required:' || v_key);
      END IF;
    END IF;

    IF v_val IS NOT NULL AND jsonb_typeof(v_val) <> 'null' THEN
      IF v_type = 'scale' THEN
        v_scale_max := COALESCE((v_q->>'scaleMax')::int, 5);
        IF jsonb_typeof(v_val) <> 'number' THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'type:' || v_key); END IF;
        v_num := (v_val #>> '{}')::numeric;
        IF v_num < 1 OR v_num > v_scale_max OR v_num <> floor(v_num) THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'range:' || v_key); END IF;
      ELSIF v_type = 'boolean' THEN
        IF jsonb_typeof(v_val) <> 'boolean' THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'type:' || v_key); END IF;
      ELSIF v_type = 'text' THEN
        IF jsonb_typeof(v_val) <> 'string' THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'type:' || v_key); END IF;
      ELSIF v_type = 'single_choice' THEN
        IF jsonb_typeof(v_val) <> 'string'
           OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_q->'options','[]'::jsonb)) o
                          WHERE o->>'value' = (v_val #>> '{}')) THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'option:' || v_key); END IF;
      ELSIF v_type = 'multi_choice' THEN
        IF jsonb_typeof(v_val) <> 'array'
           OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_val) sel
                      WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_q->'options','[]'::jsonb)) o
                                        WHERE o->>'value' = sel)) THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'option:' || v_key); END IF;
      END IF;

      v_clean := v_clean || jsonb_build_object(v_key, v_val);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'answers', v_clean);
END;
$$;

-- ------------------------------------------------------------
-- 5. Submit por sessão (pesquisador): reaproveita o validador compartilhado.
--    Mantém sessão, shim legado, clamp de collected_at e idempotência.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pesquisa_pwa_submit_survey(p_session_id uuid, p_payload json)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session record;
  v_payload jsonb := p_payload::jsonb;
  v_config jsonb;
  v_answers jsonb;
  v_res jsonb;
  v_collected_at timestamptz;
  v_row_count int;
BEGIN
  SELECT s.researcher_id, s.event_id, s.device_id
  INTO v_session
  FROM pesquisa_sessions s
  WHERE s.id = p_session_id AND s.revoked_at IS NULL AND s.expires_at > now();

  IF v_session IS NULL THEN
    RETURN json_build_object('error', 'SESSION_INVALID');
  END IF;

  SELECT questions_config INTO v_config FROM pesquisa_events WHERE id = v_session.event_id;

  -- Respostas: formato novo (aninhado) ou shim de payload legado (chaves flat).
  v_answers := COALESCE(v_payload->'answers', '{}'::jsonb);
  IF v_answers = '{}'::jsonb THEN
    SELECT COALESCE(jsonb_object_agg(k, v_payload->k), '{}'::jsonb) INTO v_answers
    FROM (VALUES
      ('d1_organizacao'),('d1_infraestrutura'),('d1_alimentacao'),('d1_seguranca'),('d1_transporte'),
      ('d2_igualdade'),('d2_acessibilidade'),('d2_inclusao'),
      ('d3_aprendizado'),('d3_convivencia'),('d3_cidadania'),('d3_superacao'),
      ('ponto_positivo'),('sugestao')
    ) AS t(k)
    WHERE (v_payload -> k) IS NOT NULL AND jsonb_typeof(v_payload -> k) <> 'null';
  END IF;

  v_res := pesquisa_clean_answers(v_config, v_answers);
  IF NOT (v_res->>'ok')::boolean THEN
    RETURN json_build_object('status', 'invalid', 'reason', v_res->>'reason');
  END IF;
  v_answers := v_res->'answers';

  v_collected_at := COALESCE((v_payload->>'collected_at')::timestamptz, now());
  IF v_collected_at > now() + interval '5 minutes' THEN
    v_collected_at := now();
  END IF;

  INSERT INTO pesquisa_surveys (
    client_uuid, researcher_id, event_id, device_id,
    mode, answers, collected_at, application_location
  ) VALUES (
    (v_payload->>'client_uuid')::uuid,
    v_session.researcher_id,
    v_session.event_id,
    v_session.device_id,
    v_payload->>'mode',
    v_answers,
    v_collected_at,
    NULLIF(trim(v_payload->>'application_location'), '')
  )
  ON CONFLICT (event_id, client_uuid) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  RETURN json_build_object('status', CASE WHEN v_row_count > 0 THEN 'created' ELSE 'duplicate' END);
END;
$$;

-- ------------------------------------------------------------
-- 6. Submit PÚBLICO (anônimo): sem sessão. Recebe event_id + payload.
--    Exige evento ativo E public_enabled. Valida contra o config.
--    Throttle leve por device (anti-spam casual). researcher_id NULL, mode 'publico'.
--    NUNCA lança para o cliente: retorna status.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pesquisa_public_submit_survey(p_event_id uuid, p_payload json)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payload jsonb := p_payload::jsonb;
  v_event record;
  v_answers jsonb;
  v_res jsonb;
  v_collected_at timestamptz;
  v_device text;
  v_client_uuid text;
  v_recent int;
  v_row_count int;
BEGIN
  SELECT active, public_enabled, questions_config
  INTO v_event
  FROM pesquisa_events
  WHERE id = p_event_id;

  IF v_event IS NULL OR NOT v_event.active OR NOT v_event.public_enabled THEN
    RETURN json_build_object('error', 'PUBLIC_DISABLED');
  END IF;

  -- client_uuid é obrigatório e precisa ser um UUID (idempotência).
  v_client_uuid := v_payload->>'client_uuid';
  IF v_client_uuid IS NULL OR v_client_uuid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN json_build_object('status', 'invalid', 'reason', 'client_uuid');
  END IF;

  v_answers := COALESCE(v_payload->'answers', '{}'::jsonb);
  v_res := pesquisa_clean_answers(v_event.questions_config, v_answers);
  IF NOT (v_res->>'ok')::boolean THEN
    RETURN json_build_object('status', 'invalid', 'reason', v_res->>'reason');
  END IF;
  v_answers := v_res->'answers';

  -- Throttle leve: no máx. 20 coletas públicas por device+evento em 10 min.
  v_device := NULLIF(trim(v_payload->>'device_id'), '');
  IF v_device IS NOT NULL THEN
    SELECT count(*) INTO v_recent
    FROM pesquisa_surveys
    WHERE event_id = p_event_id AND device_id = v_device
      AND mode = 'publico' AND created_at > now() - interval '10 minutes';
    IF v_recent >= 20 THEN
      RETURN json_build_object('status', 'invalid', 'reason', 'rate_limited');
    END IF;
  END IF;

  v_collected_at := COALESCE((v_payload->>'collected_at')::timestamptz, now());
  IF v_collected_at > now() + interval '5 minutes' THEN
    v_collected_at := now();
  END IF;

  INSERT INTO pesquisa_surveys (
    client_uuid, researcher_id, event_id, device_id,
    mode, answers, collected_at, application_location
  ) VALUES (
    v_client_uuid::uuid,
    NULL,
    p_event_id,
    v_device,
    'publico',
    v_answers,
    v_collected_at,
    NULLIF(trim(v_payload->>'application_location'), '')
  )
  ON CONFLICT (event_id, client_uuid) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  RETURN json_build_object('status', CASE WHEN v_row_count > 0 THEN 'created' ELSE 'duplicate' END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pesquisa_clean_answers(jsonb, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pesquisa_public_submit_survey(uuid, json) TO anon, authenticated;
