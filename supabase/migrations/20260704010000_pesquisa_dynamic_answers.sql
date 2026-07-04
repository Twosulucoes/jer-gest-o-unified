-- ============================================================
-- Pesquisa de Satisfação: questionário dinâmico (answers jsonb)
--
-- Substitui o armazenamento rígido (12 colunas fixas d1_*/d2_*/d3_* + 2 textos)
-- por um único `answers jsonb`, keyed pela chave da pergunta. As perguntas passam
-- a ser 100% definidas por evento em pesquisa_events.questions_config (schema v2:
-- seções + perguntas tipadas), permitindo nº livre de perguntas, tipos variados
-- (scale/single_choice/multi_choice/text/boolean) e seções configuráveis.
--
-- Reset limpo autorizado (havia apenas respostas de teste). Ancorado no schema
-- REAL de produção (pesquisa_surveys NÃO possui event_stage_id).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Reset + nova coluna answers
-- ------------------------------------------------------------
TRUNCATE public.pesquisa_surveys;

ALTER TABLE public.pesquisa_surveys
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.pesquisa_surveys
  DROP CONSTRAINT IF EXISTS pesquisa_surveys_answers_is_object;
ALTER TABLE public.pesquisa_surveys
  ADD CONSTRAINT pesquisa_surveys_answers_is_object CHECK (jsonb_typeof(answers) = 'object');

-- ------------------------------------------------------------
-- 2. Remove as colunas fixas (perguntas viram entradas em answers)
--    ponto_positivo/sugestao passam a ser perguntas type='text' semeadas no default.
-- ------------------------------------------------------------
ALTER TABLE public.pesquisa_surveys
  DROP COLUMN IF EXISTS d1_organizacao,
  DROP COLUMN IF EXISTS d1_infraestrutura,
  DROP COLUMN IF EXISTS d1_alimentacao,
  DROP COLUMN IF EXISTS d1_seguranca,
  DROP COLUMN IF EXISTS d1_transporte,
  DROP COLUMN IF EXISTS d2_igualdade,
  DROP COLUMN IF EXISTS d2_acessibilidade,
  DROP COLUMN IF EXISTS d2_inclusao,
  DROP COLUMN IF EXISTS d3_aprendizado,
  DROP COLUMN IF EXISTS d3_convivencia,
  DROP COLUMN IF EXISTS d3_cidadania,
  DROP COLUMN IF EXISTS d3_superacao,
  DROP COLUMN IF EXISTS ponto_positivo,
  DROP COLUMN IF EXISTS sugestao;

-- ------------------------------------------------------------
-- 3. Backfill: garante questions_config v2 em todo evento (null ou legado v1 array).
--    O default espelha o modelo JER (12 escalas em 3 seções + 2 textos).
--    Mantém as MESMAS chaves das antigas colunas para continuidade de relatórios.
-- ------------------------------------------------------------
UPDATE public.pesquisa_events
SET questions_config = jsonb_build_object(
  'version', 2,
  'sections', jsonb_build_array(
    jsonb_build_object('key','d1','label','Operação','order',1),
    jsonb_build_object('key','d2','label','Valores','order',2),
    jsonb_build_object('key','d3','label','Impacto','order',3),
    jsonb_build_object('key','aberto','label','Comentários','order',4)
  ),
  'questions', jsonb_build_array(
    jsonb_build_object('key','d1_organizacao','section','d1','order',1,'type','scale','label','Organização do evento','required',true,'scaleMax',5),
    jsonb_build_object('key','d1_infraestrutura','section','d1','order',2,'type','scale','label','Infraestrutura','required',true,'scaleMax',5),
    jsonb_build_object('key','d1_alimentacao','section','d1','order',3,'type','scale','label','Alimentação','required',true,'scaleMax',5),
    jsonb_build_object('key','d1_seguranca','section','d1','order',4,'type','scale','label','Segurança','required',true,'scaleMax',5),
    jsonb_build_object('key','d1_transporte','section','d1','order',5,'type','scale','label','Transporte','required',true,'scaleMax',5),
    jsonb_build_object('key','d2_igualdade','section','d2','order',6,'type','scale','label','Igualdade de tratamento','required',true,'scaleMax',5),
    jsonb_build_object('key','d2_acessibilidade','section','d2','order',7,'type','scale','label','Acessibilidade','required',true,'scaleMax',5),
    jsonb_build_object('key','d2_inclusao','section','d2','order',8,'type','scale','label','Inclusão','required',true,'scaleMax',5),
    jsonb_build_object('key','d3_aprendizado','section','d3','order',9,'type','scale','label','Aprendizado','required',true,'scaleMax',5),
    jsonb_build_object('key','d3_convivencia','section','d3','order',10,'type','scale','label','Convivência e amizade','required',true,'scaleMax',5),
    jsonb_build_object('key','d3_cidadania','section','d3','order',11,'type','scale','label','Cidadania','required',true,'scaleMax',5),
    jsonb_build_object('key','d3_superacao','section','d3','order',12,'type','scale','label','Superação pessoal','required',true,'scaleMax',5),
    jsonb_build_object('key','ponto_positivo','section','aberto','order',13,'type','text','label','Ponto positivo','required',false),
    jsonb_build_object('key','sugestao','section','aberto','order',14,'type','text','label','Sugestão ou crítica','required',false)
  )
)
WHERE questions_config IS NULL OR jsonb_typeof(questions_config) <> 'object' OR NOT (questions_config ? 'questions');

-- ------------------------------------------------------------
-- 4. Novo submit RPC: grava answers jsonb, valida contra o questions_config v2 do
--    evento (obrigatórias / faixa de escala / opções válidas), descarta chaves
--    desconhecidas, e NUNCA lança em payload inválido — retorna status 'invalid'
--    para o fluxo offline poder descartar o item em vez de reenviar pra sempre.
--    Shim de transição: aceita payload legado com chaves flat (d*_/comentários).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pesquisa_pwa_submit_survey(p_session_id uuid, p_payload json)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session record;
  v_payload jsonb := p_payload::jsonb;
  v_config jsonb;
  v_answers jsonb;
  v_clean jsonb := '{}'::jsonb;
  v_collected_at timestamptz;
  v_row_count int;
  v_q jsonb;
  v_key text;
  v_type text;
  v_val jsonb;
  v_num numeric;
  v_scale_max int;
BEGIN
  -- Sessão válida (injeta researcher/event/device server-side).
  SELECT s.researcher_id, s.event_id, s.device_id
  INTO v_session
  FROM pesquisa_sessions s
  WHERE s.id = p_session_id AND s.revoked_at IS NULL AND s.expires_at > now();

  IF v_session IS NULL THEN
    RETURN json_build_object('error', 'SESSION_INVALID');
  END IF;

  SELECT questions_config INTO v_config
  FROM pesquisa_events WHERE id = v_session.event_id;

  -- Respostas: formato novo (aninhado) ou shim do formato legado (chaves flat).
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

  IF jsonb_typeof(v_answers) <> 'object' THEN
    RETURN json_build_object('status', 'invalid', 'reason', 'answers_not_object');
  END IF;

  -- Validação contra o config v2 (quando presente). Só chaves conhecidas persistem.
  IF v_config IS NOT NULL AND jsonb_typeof(v_config) = 'object' AND (v_config ? 'questions') THEN
    FOR v_q IN SELECT jsonb_array_elements(v_config->'questions') LOOP
      v_key := v_q->>'key';
      v_type := v_q->>'type';
      v_val := v_answers -> v_key;

      -- Obrigatória ausente/vazia.
      IF COALESCE((v_q->>'required')::boolean, false) THEN
        IF v_val IS NULL OR jsonb_typeof(v_val) = 'null'
           OR (jsonb_typeof(v_val) = 'string' AND btrim(v_val #>> '{}') = '')
           OR (jsonb_typeof(v_val) = 'array' AND jsonb_array_length(v_val) = 0) THEN
          RETURN json_build_object('status', 'invalid', 'reason', 'required:' || v_key);
        END IF;
      END IF;

      IF v_val IS NOT NULL AND jsonb_typeof(v_val) <> 'null' THEN
        IF v_type = 'scale' THEN
          v_scale_max := COALESCE((v_q->>'scaleMax')::int, 5);
          IF jsonb_typeof(v_val) <> 'number' THEN
            RETURN json_build_object('status','invalid','reason','type:'||v_key); END IF;
          v_num := (v_val #>> '{}')::numeric;
          IF v_num < 1 OR v_num > v_scale_max OR v_num <> floor(v_num) THEN
            RETURN json_build_object('status','invalid','reason','range:'||v_key); END IF;
        ELSIF v_type = 'boolean' THEN
          IF jsonb_typeof(v_val) <> 'boolean' THEN
            RETURN json_build_object('status','invalid','reason','type:'||v_key); END IF;
        ELSIF v_type = 'text' THEN
          IF jsonb_typeof(v_val) <> 'string' THEN
            RETURN json_build_object('status','invalid','reason','type:'||v_key); END IF;
        ELSIF v_type = 'single_choice' THEN
          IF jsonb_typeof(v_val) <> 'string'
             OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_q->'options','[]'::jsonb)) o
                            WHERE o->>'value' = (v_val #>> '{}')) THEN
            RETURN json_build_object('status','invalid','reason','option:'||v_key); END IF;
        ELSIF v_type = 'multi_choice' THEN
          IF jsonb_typeof(v_val) <> 'array'
             OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_val) sel
                        WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_q->'options','[]'::jsonb)) o
                                          WHERE o->>'value' = sel)) THEN
            RETURN json_build_object('status','invalid','reason','option:'||v_key); END IF;
        END IF;

        v_clean := v_clean || jsonb_build_object(v_key, v_val);
      END IF;
    END LOOP;
    v_answers := v_clean;  -- descarta chaves fora do config
  END IF;

  -- collected_at: preserva horário real de coleta (offline), mas bloqueia datas futuras.
  v_collected_at := COALESCE((v_payload->>'collected_at')::timestamptz, now());
  IF v_collected_at > now() + interval '5 minutes' THEN
    v_collected_at := now();
  END IF;

  INSERT INTO pesquisa_surveys (
    client_uuid, researcher_id, event_id, device_id,
    respondent_type, respondent_age, respondent_gender, mode,
    answers, collected_at, application_location
  ) VALUES (
    (v_payload->>'client_uuid')::uuid,
    v_session.researcher_id,
    v_session.event_id,
    v_session.device_id,
    v_payload->>'respondent_type',
    v_payload->>'respondent_age',
    v_payload->>'respondent_gender',
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
