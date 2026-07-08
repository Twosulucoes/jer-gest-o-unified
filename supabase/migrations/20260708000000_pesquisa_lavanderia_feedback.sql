-- ============================================================
-- Pesquisa de Satisfação: pergunta condicional de melhoria na Lavanderia
--
-- Insere a pergunta de texto opcional `lavanderia_feedback` que abre
-- automaticamente quando a nota de `lavanderia` (scale 1-5) for 1, 2 ou 3
-- (visibleIf: { key: 'lavanderia', values: [1,2,3] }). Espelha exatamente a
-- entrada adicionada ao preset default em src/lib/pesquisa/config.ts.
--
-- Os eventos já possuem questions_config v2 (backfill da migration
-- 20260704010000): mudar o DEFAULT_CONFIG só afeta eventos SEM config v2, por
-- isso este patch injeta a pergunta nos configs existentes. Idempotente: só
-- toca eventos que têm `lavanderia` e ainda não têm `lavanderia_feedback`.
-- A pergunta é posicionada logo após `lavanderia` e a `order` de todas as
-- perguntas é reindexada sequencialmente.
-- ============================================================

DO $$
DECLARE
  v_event RECORD;
  v_lav_order numeric;
  v_new jsonb;
  v_feedback CONSTANT jsonb := $q$
    {
      "key": "lavanderia_feedback",
      "section": "servicos",
      "type": "text",
      "required": false,
      "maxLength": 500,
      "label": "Fale um pouco mais sobre sua nota, como podemos melhorar?",
      "visibleIf": {"key": "lavanderia", "values": [1, 2, 3]}
    }
  $q$::jsonb;
BEGIN
  FOR v_event IN
    SELECT id, questions_config
    FROM pesquisa_events
    WHERE questions_config ? 'questions'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(questions_config->'questions') e
        WHERE e->>'key' = 'lavanderia')
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(questions_config->'questions') e
        WHERE e->>'key' = 'lavanderia_feedback')
  LOOP
    -- Ordem atual da pergunta lavanderia (para posicionar o feedback logo após).
    SELECT COALESCE((e->>'order')::numeric, 0)
    INTO v_lav_order
    FROM jsonb_array_elements(v_event.questions_config->'questions') e
    WHERE e->>'key' = 'lavanderia'
    LIMIT 1;

    -- Combina perguntas existentes + feedback (ordem lavanderia + 0.5), ordena e
    -- reindexa a `order` para inteiros sequenciais preservando a sequência.
    SELECT jsonb_agg(jsonb_set(q, '{order}', to_jsonb(rn)) ORDER BY rn)
    INTO v_new
    FROM (
      SELECT q, row_number() OVER (ORDER BY (q->>'order')::numeric NULLS LAST) AS rn
      FROM (
        SELECT e AS q
        FROM jsonb_array_elements(v_event.questions_config->'questions') e
        UNION ALL
        SELECT jsonb_set(v_feedback, '{order}', to_jsonb(v_lav_order + 0.5))
      ) all_q
    ) ranked;

    UPDATE pesquisa_events
    SET questions_config = jsonb_set(questions_config, '{questions}', v_new)
    WHERE id = v_event.id;
  END LOOP;
END $$;
