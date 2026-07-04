-- ============================================================
-- Pesquisa de Satisfação: questionário 100% dinâmico (answers jsonb)
--
-- Substitui o armazenamento rígido (12 colunas d1_*/d2_*/d3_*, 2 textos e a
-- demografia fixa respondent_type/age/gender) por um único `answers jsonb`,
-- keyed pela chave da pergunta. TUDO passa a ser definido por evento em
-- pesquisa_events.questions_config (schema v2): seções + perguntas tipadas
-- (scale/single_choice/multi_choice/text/boolean), exibição condicional
-- (visibleIf) e rótulos de escala com emoji.
--
-- `mode` (autopreenchimento/entrevista) permanece como coluna: é metadado
-- operacional do pesquisador, não resposta do respondente.
--
-- Reset limpo autorizado (só havia respostas de teste). Ancorado no schema REAL
-- de produção. Preset default = formulário "JER Alojamento" (PDF de referência).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Reset + coluna answers
-- ------------------------------------------------------------
TRUNCATE public.pesquisa_surveys;

ALTER TABLE public.pesquisa_surveys
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.pesquisa_surveys
  DROP CONSTRAINT IF EXISTS pesquisa_surveys_answers_is_object;
ALTER TABLE public.pesquisa_surveys
  ADD CONSTRAINT pesquisa_surveys_answers_is_object CHECK (jsonb_typeof(answers) = 'object');

-- ------------------------------------------------------------
-- 2. Remove colunas fixas (perguntas + demografia viram entradas em answers)
-- ------------------------------------------------------------
ALTER TABLE public.pesquisa_surveys
  DROP COLUMN IF EXISTS d1_organizacao, DROP COLUMN IF EXISTS d1_infraestrutura, DROP COLUMN IF EXISTS d1_alimentacao,
  DROP COLUMN IF EXISTS d1_seguranca, DROP COLUMN IF EXISTS d1_transporte,
  DROP COLUMN IF EXISTS d2_igualdade, DROP COLUMN IF EXISTS d2_acessibilidade, DROP COLUMN IF EXISTS d2_inclusao,
  DROP COLUMN IF EXISTS d3_aprendizado, DROP COLUMN IF EXISTS d3_convivencia, DROP COLUMN IF EXISTS d3_cidadania, DROP COLUMN IF EXISTS d3_superacao,
  DROP COLUMN IF EXISTS ponto_positivo, DROP COLUMN IF EXISTS sugestao,
  DROP COLUMN IF EXISTS respondent_type, DROP COLUMN IF EXISTS respondent_age, DROP COLUMN IF EXISTS respondent_gender;

-- ------------------------------------------------------------
-- 3. Backfill: garante questions_config v2 (preset JER Alojamento) em todo
--    evento sem config v2. Emojis/rótulos de escala compartilhados em scaleLabels.
-- ------------------------------------------------------------
UPDATE public.pesquisa_events
SET questions_config = $json$
{
  "version": 2,
  "name": "JER Alojamento",
  "scaleLabels": [
    {"value": 1, "emoji": "😞", "label": "Não gostei"},
    {"value": 2, "emoji": "🤔", "label": "Pode melhorar"},
    {"value": 3, "emoji": "😶", "label": "Neutro"},
    {"value": 4, "emoji": "🫡", "label": "Gostei"},
    {"value": 5, "emoji": "🤗", "label": "Excelente"}
  ],
  "sections": [
    {"key": "perfil", "label": "Perfil", "order": 1},
    {"key": "servicos", "label": "Estrutura e Serviços", "order": 2},
    {"key": "avaliacao", "label": "Avaliação Geral", "order": 3},
    {"key": "final", "label": "Finalização", "order": 4}
  ],
  "questions": [
    {"key": "idade", "section": "perfil", "order": 1, "type": "single_choice", "label": "Idade", "required": true,
     "options": [{"value":"ate_12","label":"Até 12 anos"},{"value":"13_14","label":"13 a 14 anos"},{"value":"15_17","label":"15 a 17 anos"},{"value":"18_mais","label":"18 anos ou mais"}]},
    {"key": "sexo", "section": "perfil", "order": 2, "type": "single_choice", "label": "Sexo", "required": true,
     "options": [{"value":"feminino","label":"Feminino"},{"value":"masculino","label":"Masculino"},{"value":"nao_informado","label":"Prefiro não informar"}]},
    {"key": "municipio", "section": "perfil", "order": 3, "type": "single_choice", "label": "Município de origem", "required": true,
     "options": [
       {"value":"alto_alegre","label":"Alto Alegre"},{"value":"amajari","label":"Amajari"},{"value":"boa_vista","label":"Boa Vista"},
       {"value":"bonfim","label":"Bonfim"},{"value":"canta","label":"Cantá"},{"value":"caracarai","label":"Caracaraí"},
       {"value":"caroebe","label":"Caroebe"},{"value":"iracema","label":"Iracema"},{"value":"mucajai","label":"Mucajaí"},
       {"value":"normandia","label":"Normandia"},{"value":"pacaraima","label":"Pacaraima"},{"value":"rorainopolis","label":"Rorainópolis"},
       {"value":"sao_joao_baliza","label":"São João da Baliza"},{"value":"sao_luiz","label":"São Luiz"},{"value":"uiramuta","label":"Uiramutã"}]},
    {"key": "tipo", "section": "perfil", "order": 4, "type": "single_choice", "label": "Você é", "required": true,
     "options": [{"value":"estudante_atleta","label":"Estudante/Atleta"},{"value":"professor","label":"Professor(a)"},{"value":"tecnico","label":"Técnico(a)/Treinador(a)"},{"value":"arbitro","label":"Árbitro(a)"},{"value":"outro","label":"Outro"}]},
    {"key": "tipo_outro", "section": "perfil", "order": 5, "type": "text", "label": "Qual? (especifique)", "required": true,
     "visibleIf": {"key": "tipo", "values": ["outro"]}},
    {"key": "alojamento", "section": "servicos", "order": 6, "type": "scale", "scaleMax": 5, "required": true,
     "label": "Como você avalia o alojamento? (limpeza, organização e equipe de apoio)"},
    {"key": "lavanderia", "section": "servicos", "order": 7, "type": "scale", "scaleMax": 5, "required": true,
     "label": "Gostou da lavanderia de roupas nos alojamentos?"},
    {"key": "alimentacao", "section": "servicos", "order": 8, "type": "scale", "scaleMax": 5, "required": true,
     "label": "Como você avalia a alimentação oferecida? (quantidade e cardápio)"},
    {"key": "kit_higiene", "section": "servicos", "order": 9, "type": "boolean", "required": true,
     "label": "Você recebeu o kit de higiene?"},
    {"key": "kit_higiene_nota", "section": "servicos", "order": 10, "type": "scale", "scaleMax": 5, "required": true,
     "label": "Como você avalia o kit de higiene recebido?", "visibleIf": {"key": "kit_higiene", "values": [true]}},
    {"key": "organizacao", "section": "avaliacao", "order": 11, "type": "scale", "scaleMax": 5, "required": true,
     "label": "Como você avalia a organização dos Jogos Escolares?"},
    {"key": "estrutura", "section": "avaliacao", "order": 12, "type": "scale", "scaleMax": 5, "required": true,
     "label": "Como você avalia a estrutura do evento? (local, equipamentos e espaços)"},
    {"key": "gostando", "section": "avaliacao", "order": 13, "type": "scale", "scaleMax": 5, "required": true,
     "label": "De 0 a 5, quanto você está gostando dos Jogos Escolares?"},
    {"key": "participaria", "section": "final", "order": 14, "type": "boolean", "required": true,
     "label": "Você participaria novamente dos Jogos Escolares?"},
    {"key": "feedback", "section": "final", "order": 15, "type": "text", "required": false,
     "label": "Espaço livre para feedback sobre o evento (até 50 palavras)"}
  ]
}
$json$::jsonb
WHERE questions_config IS NULL OR jsonb_typeof(questions_config) <> 'object' OR NOT (questions_config ? 'questions');

-- ------------------------------------------------------------
-- 4. submit RPC: grava answers jsonb; avalia visibleIf; valida contra o config v2
--    (obrigatória visível ausente / faixa de escala / opção válida / tipo);
--    descarta chaves desconhecidas e escondidas; NUNCA lança em payload inválido
--    (retorna status 'invalid' p/ o fluxo offline descartar). Shim legado mantido.
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
  v_vis jsonb;
  v_ctrl jsonb;
  v_num numeric;
  v_scale_max int;
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

  IF jsonb_typeof(v_answers) <> 'object' THEN
    RETURN json_build_object('status', 'invalid', 'reason', 'answers_not_object');
  END IF;

  IF v_config IS NOT NULL AND jsonb_typeof(v_config) = 'object' AND (v_config ? 'questions') THEN
    FOR v_q IN SELECT jsonb_array_elements(v_config->'questions') LOOP
      v_key := v_q->>'key';
      v_type := v_q->>'type';

      -- Exibição condicional: pergunta escondida é ignorada (não exige, não persiste).
      v_vis := v_q->'visibleIf';
      IF v_vis IS NOT NULL AND jsonb_typeof(v_vis) = 'object' THEN
        v_ctrl := v_answers -> (v_vis->>'key');
        IF v_ctrl IS NULL OR NOT (COALESCE(v_vis->'values','[]'::jsonb) @> jsonb_build_array(v_ctrl)) THEN
          CONTINUE;
        END IF;
      END IF;

      v_val := v_answers -> v_key;

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
    v_answers := v_clean;  -- descarta chaves fora do config / escondidas
  END IF;

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
-- 5. get_home / list_recent: não referenciam mais colunas demográficas removidas.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pesquisa_pwa_get_home(p_session_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session record;
  v_researcher_name text;
  v_event record;
  v_today_count int;
  v_recent json;
BEGIN
  SELECT s.researcher_id, s.event_id, s.device_id
  INTO v_session
  FROM pesquisa_sessions s
  WHERE s.id = p_session_id AND s.revoked_at IS NULL AND s.expires_at > now();

  IF v_session IS NULL THEN
    RETURN json_build_object('error', 'SESSION_INVALID');
  END IF;

  UPDATE pesquisa_sessions SET last_seen_at = now() WHERE id = p_session_id;

  SELECT r.name INTO v_researcher_name FROM pesquisa_researchers r WHERE r.id = v_session.researcher_id;
  SELECT e.id, e.name, e.location, e.event_date INTO v_event FROM pesquisa_events e WHERE e.id = v_session.event_id;

  SELECT count(*) INTO v_today_count
  FROM pesquisa_surveys
  WHERE researcher_id = v_session.researcher_id AND collected_at::date = current_date;

  SELECT json_agg(t) INTO v_recent FROM (
    SELECT collected_at, answers
    FROM pesquisa_surveys
    WHERE researcher_id = v_session.researcher_id
    ORDER BY collected_at DESC LIMIT 10
  ) t;

  RETURN json_build_object(
    'researcher_name', v_researcher_name,
    'event', json_build_object('id', v_event.id, 'name', v_event.name, 'location', v_event.location, 'event_date', v_event.event_date),
    'today_count', v_today_count,
    'recent', COALESCE(v_recent, '[]'::json)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pesquisa_pwa_list_recent(p_session_id uuid, p_limit integer DEFAULT 20)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_researcher_id uuid;
  v_result json;
BEGIN
  SELECT s.researcher_id INTO v_researcher_id
  FROM pesquisa_sessions s
  WHERE s.id = p_session_id AND s.revoked_at IS NULL AND s.expires_at > now();

  IF v_researcher_id IS NULL THEN
    RETURN json_build_object('error', 'SESSION_INVALID');
  END IF;

  SELECT json_agg(t) INTO v_result FROM (
    SELECT collected_at, answers
    FROM pesquisa_surveys
    WHERE researcher_id = v_researcher_id
    ORDER BY collected_at DESC
    LIMIT LEAST(p_limit, 50)
  ) t;

  RETURN json_build_object('items', COALESCE(v_result, '[]'::json));
END;
$$;
