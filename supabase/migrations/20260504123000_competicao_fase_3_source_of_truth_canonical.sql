-- ============================================================
-- Auditoria de Competição Fase 3 — source-of-truth canônica
-- ============================================================
-- Auditoria: docs/auditoria-competicao.md (Fase 3)
--
-- A auditoria original apontou "source-of-truth ambíguo" entre 3
-- tabelas. A reinvestigação revelou cenário diferente — e UM bug
-- real, esse sim com impacto:
--
--   1. public.competition_match_results
--        Source-of-truth de resultado oficial. Escrita por
--        rpc_launch_match_result (LaunchResultDialog +
--        LancamentoSimplificadoDialog). Lida em boletins e
--        standings.
--
--   2. public.match_scores
--        Staging de seed/demo. Escrita pelas funções
--        seed_event_demo (migrações 20260412034718 e
--        20260412035025). Promovível para results via
--        rpc_sync_match_scores_to_results (migração 20260413191015).
--        NÃO É source-of-truth.
--
--   3. arbitragem.results
--        Workflow de rascunho → enviado → publicado da arbitragem.
--        Tem RLS, índices, triggers, e foi denormalizada com
--        event_stage_id na Etapa 3.2 (migração 20260504011126).
--        Sem writer em produção atualmente; aguarda decisão
--        arquitetural sobre integração com public.match_evidences
--        (introduzida na Fase 1 — PR #61). Fora do escopo desta
--        migração.
--
-- BUG real corrigido aqui: rpc_extract_match_outcome usa COALESCE
-- com match_scores ANTES de competition_match_results. Se um evento
-- real tiver demo seed, o seed sobrescreve o resultado oficial nas
-- standings. A ordem precisa ser invertida — competition_match_results
-- deve ser lida primeiro; match_scores fica como fallback explícito
-- para cenários em que o seed_event_demo é o único que escreveu.
--
-- Esta migração:
--   A. Recria rpc_extract_match_outcome com COALESCE invertido.
--   B. Adiciona COMMENT ON TABLE em cada uma das 3 tabelas com seu
--      papel canônico, para que o próximo agente/dev não repita a
--      confusão.
-- ============================================================

-- A) rpc_extract_match_outcome — competition_match_results PRIMEIRO
CREATE OR REPLACE FUNCTION public.rpc_extract_match_outcome(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match record;
  v_entries jsonb;
  v_home_entry_id uuid;
  v_away_entry_id uuid;
  v_home_score int;
  v_away_score int;
  v_home_sets int;
  v_away_sets int;
  v_set_scores jsonb;
  v_wo boolean := false;
  v_finalized boolean := false;
  v_is_draw boolean := false;
  v_winner_entry_id uuid;
  v_home_outcome text;
  v_away_outcome text;
BEGIN
  SELECT * INTO v_match FROM competition_matches WHERE id = p_match_id;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('error', 'match_not_found');
  END IF;

  SELECT jsonb_agg(row_to_json(e)::jsonb ORDER BY e.side)
  INTO v_entries
  FROM (
    SELECT id, side, team_id, participant_sport_event_id
    FROM competition_match_entries
    WHERE match_id = p_match_id
    ORDER BY side
    LIMIT 2
  ) e;

  IF v_entries IS NULL OR jsonb_array_length(v_entries) < 2 THEN
    RETURN jsonb_build_object(
      'match_id', p_match_id,
      'finalized', false,
      'entries_count', COALESCE(jsonb_array_length(v_entries), 0)
    );
  END IF;

  v_home_entry_id := (v_entries->0->>'id')::uuid;
  v_away_entry_id := (v_entries->1->>'id')::uuid;

  -- Score: competition_match_results PRIMEIRO (source-of-truth oficial),
  -- match_scores como fallback (staging do seed_event_demo).
  SELECT
    COALESCE(
      (SELECT (cmr.score)::int FROM competition_match_results cmr WHERE cmr.match_id = p_match_id AND cmr.match_entry_id = v_home_entry_id LIMIT 1),
      (SELECT ms.score_final::int FROM match_scores ms WHERE ms.match_id = p_match_id AND ms.match_entry_id = v_home_entry_id LIMIT 1)
    ),
    COALESCE(
      (SELECT (cmr.score)::int FROM competition_match_results cmr WHERE cmr.match_id = p_match_id AND cmr.match_entry_id = v_away_entry_id LIMIT 1),
      (SELECT ms.score_final::int FROM match_scores ms WHERE ms.match_id = p_match_id AND ms.match_entry_id = v_away_entry_id LIMIT 1)
    )
  INTO v_home_score, v_away_score;

  -- Sets: só existem em score_detail (match_scores). Mantido como hoje.
  SELECT
    (SELECT ms.score_detail FROM match_scores ms WHERE ms.match_id = p_match_id AND ms.match_entry_id = v_home_entry_id LIMIT 1)
  INTO v_set_scores;

  -- Outcome: também competition_match_results PRIMEIRO.
  SELECT
    COALESCE(
      (SELECT cmr.outcome FROM competition_match_results cmr WHERE cmr.match_id = p_match_id AND cmr.match_entry_id = v_home_entry_id LIMIT 1),
      (SELECT ms.outcome FROM match_scores ms WHERE ms.match_id = p_match_id AND ms.match_entry_id = v_home_entry_id LIMIT 1)
    ),
    COALESCE(
      (SELECT cmr.outcome FROM competition_match_results cmr WHERE cmr.match_id = p_match_id AND cmr.match_entry_id = v_away_entry_id LIMIT 1),
      (SELECT ms.outcome FROM match_scores ms WHERE ms.match_id = p_match_id AND ms.match_entry_id = v_away_entry_id LIMIT 1)
    )
  INTO v_home_outcome, v_away_outcome;

  v_finalized := (v_match.status = 'finished') OR (v_home_score IS NOT NULL AND v_away_score IS NOT NULL) OR (v_home_outcome IS NOT NULL);

  IF NOT v_finalized THEN
    RETURN jsonb_build_object(
      'match_id', p_match_id,
      'finalized', false,
      'home_entry_id', v_home_entry_id,
      'away_entry_id', v_away_entry_id
    );
  END IF;

  v_wo := (v_home_outcome IN ('wo','wo_win','wo_loss') OR v_away_outcome IN ('wo','wo_win','wo_loss'));

  IF v_home_outcome = 'win' OR v_away_outcome = 'loss' OR v_away_outcome = 'wo_loss' THEN
    v_winner_entry_id := v_home_entry_id;
  ELSIF v_away_outcome = 'win' OR v_home_outcome = 'loss' OR v_home_outcome = 'wo_loss' THEN
    v_winner_entry_id := v_away_entry_id;
  ELSIF v_home_outcome = 'draw' OR v_away_outcome = 'draw' THEN
    v_is_draw := true;
  ELSIF v_home_score IS NOT NULL AND v_away_score IS NOT NULL THEN
    IF v_home_score > v_away_score THEN
      v_winner_entry_id := v_home_entry_id;
    ELSIF v_away_score > v_home_score THEN
      v_winner_entry_id := v_away_entry_id;
    ELSE
      v_is_draw := true;
    END IF;
  END IF;

  IF v_set_scores IS NOT NULL AND jsonb_typeof(v_set_scores) = 'array' THEN
    v_home_sets := 0;
    v_away_sets := 0;
    FOR i IN 0..jsonb_array_length(v_set_scores)-1 LOOP
      IF (v_set_scores->i->>'home')::int > (v_set_scores->i->>'away')::int THEN
        v_home_sets := v_home_sets + 1;
      ELSIF (v_set_scores->i->>'away')::int > (v_set_scores->i->>'home')::int THEN
        v_away_sets := v_away_sets + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'match_id', p_match_id,
    'finalized', true,
    'home_entry_id', v_home_entry_id,
    'away_entry_id', v_away_entry_id,
    'winner_entry_id', v_winner_entry_id,
    'is_draw', v_is_draw,
    'wo', v_wo,
    'score', jsonb_build_object('home', v_home_score, 'away', v_away_score),
    'sets', CASE WHEN v_home_sets IS NOT NULL THEN
      jsonb_build_object('home', v_home_sets, 'away', v_away_sets, 'set_scores', COALESCE(v_set_scores, '[]'::jsonb))
    ELSE NULL END,
    'home_outcome', v_home_outcome,
    'away_outcome', v_away_outcome
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_extract_match_outcome(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_extract_match_outcome(uuid) TO authenticated;

-- B) COMMENT ON TABLE — papel canônico de cada tabela.

COMMENT ON TABLE public.competition_match_results IS
  'Source-of-truth de resultado OFICIAL de partida. Escrita por rpc_launch_match_result (LaunchResultDialog + LancamentoSimplificadoDialog). Lida por boletins, standings (via rpc_extract_match_outcome) e UI. Toda decisão de competição (vencedor, classificação, progressão de bracket) deve ler daqui.';

COMMENT ON TABLE public.match_scores IS
  'Staging de seed/demo (escrita por seed_event_demo). NÃO é source-of-truth — competition_match_results é. Lida como FALLBACK em rpc_extract_match_outcome quando o resultado oficial ainda não foi lançado. Promovível para results via rpc_sync_match_scores_to_results.';

COMMENT ON TABLE arbitragem.results IS
  'Workflow de arbitragem: rascunho → enviado → publicado. Tem RLS por papel (admin/secretaria/coord_tecnica/arbitragem) e auditoria (created/updated/submitted/published_*). Sem writer em produção atualmente — aguarda decisão arquitetural sobre integração com public.match_evidences (Fase 1, PR #61). Não confundir com competition_match_results, que é o resultado oficial.';
