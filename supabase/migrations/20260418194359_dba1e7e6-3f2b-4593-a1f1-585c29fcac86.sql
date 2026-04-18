-- ============================================================================
-- 1) rpc_get_group_points_rules: ler chaves PT-BR da fonte JER 2026
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_group_points_rules(p_sport_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules jsonb;
  v_family text;
  v_format text;
  v_gp jsonb;
  v_tb jsonb;
  v_wo jsonb;
  v_pt jsonb;
  v_des jsonb;
  v_partida jsonb;
  v_item jsonb;
  v_crit text;
  v_slug text;
  v_tb_arr jsonb := '[]'::jsonb;
BEGIN
  SELECT ser.rules INTO v_rules
  FROM sport_event_rules ser
  WHERE ser.sport_event_id = p_sport_event_id AND ser.is_active = true
  LIMIT 1;

  IF v_rules IS NULL THEN
    RETURN jsonb_build_object(
      'family', 'score',
      'format', 'group_stage',
      'group_points', jsonb_build_object('win',3,'draw',1,'loss',0,'wo_win',3,'wo_loss',0),
      'tie_breakers', '["points_table","head_to_head","goal_difference","goals_for","draw"]'::jsonb,
      'walkover_policy', NULL::jsonb,
      'source', 'default'
    );
  END IF;

  v_family := COALESCE(v_rules->>'family', 'score');
  v_format := COALESCE(v_rules->>'format', 'group_stage');

  -- ── PRIORIDADE 1: chaves PT-BR da fonte JER 2026 ──
  -- pontuacao_grupos: { vitoria, empate, derrota, wo_vitoria, wo_derrota }
  v_pt := v_rules->'pontuacao_grupos';
  IF v_pt IS NOT NULL AND jsonb_typeof(v_pt) = 'object' THEN
    v_gp := jsonb_build_object(
      'win',  COALESCE((v_pt->>'vitoria')::int, (v_pt->>'win')::int, 3),
      'draw', COALESCE((v_pt->>'empate')::int, (v_pt->>'draw')::int, 1),
      'loss', COALESCE((v_pt->>'derrota')::int, (v_pt->>'loss')::int, 0),
      'wo_win',  COALESCE((v_pt->>'wo_vitoria')::int, (v_pt->>'wo_win')::int, 3),
      'wo_loss', COALESCE((v_pt->>'wo_derrota')::int, (v_pt->>'wo_loss')::int, 0)
    );
  ELSE
    v_gp := v_rules->'group_points';
  END IF;

  -- desempates: array [{ordem, criterio}, ...] PT → tie_breakers slugs do motor
  v_des := v_rules->'desempates';
  IF v_des IS NOT NULL AND jsonb_typeof(v_des) = 'array' AND jsonb_array_length(v_des) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_des)
    LOOP
      v_crit := lower(unaccent(COALESCE(v_item->>'criterio', '')));
      v_slug := CASE
        WHEN v_crit LIKE '%confronto direto%' OR v_crit LIKE '%confronto%' THEN 'head_to_head'
        WHEN v_crit LIKE '%saldo de gols%' OR v_crit LIKE '%saldo de gol%' THEN 'goal_difference'
        WHEN v_crit LIKE '%saldo de pontos%' THEN 'points_difference'
        WHEN v_crit LIKE '%saldo%' THEN 'goal_difference'
        WHEN v_crit LIKE '%media de gols%' OR v_crit LIKE '%average de gols%' THEN 'goal_average'
        WHEN v_crit LIKE '%media de pontos%' THEN 'points_average'
        WHEN v_crit LIKE '%media de sets%' THEN 'sets_quotient'
        WHEN v_crit LIKE '%gols pro%' OR v_crit LIKE '%gols marcados%' OR v_crit LIKE '%gols a favor%' THEN 'goals_for'
        WHEN v_crit LIKE '%pontos pro%' OR v_crit LIKE '%pontos marcados%' OR v_crit LIKE '%pontos a favor%' THEN 'points_for'
        WHEN v_crit LIKE '%gols contra%' OR v_crit LIKE '%gols sofridos%' THEN 'goals_against'
        WHEN v_crit LIKE '%pontos contra%' OR v_crit LIKE '%pontos sofridos%' THEN 'points_against'
        WHEN v_crit LIKE '%vitoria%' OR v_crit LIKE '%maior numero de vitorias%' THEN 'wins'
        WHEN v_crit LIKE '%cartao amarelo%' OR v_crit LIKE '%cartoes amarelos%' THEN 'yellow_cards'
        WHEN v_crit LIKE '%cartao vermelho%' OR v_crit LIKE '%cartoes vermelhos%' THEN 'red_cards'
        WHEN v_crit LIKE '%fair play%' OR v_crit LIKE '%disciplina%' THEN 'fair_play'
        WHEN v_crit LIKE '%sorteio%' THEN 'draw'
        ELSE NULL
      END;
      IF v_slug IS NOT NULL THEN
        v_tb_arr := v_tb_arr || to_jsonb(v_slug);
      END IF;
    END LOOP;
    -- garantir 'draw' como último critério
    IF NOT (v_tb_arr @> '["draw"]'::jsonb) THEN
      v_tb_arr := v_tb_arr || '["draw"]'::jsonb;
    END IF;
    v_tb := v_tb_arr;
  ELSE
    v_tb := v_rules->'tie_breakers';
  END IF;

  -- walkover_policy: PT (partida.placar_wo) → motor
  v_partida := v_rules->'partida';
  v_wo := v_rules->'scoring'->'walkover_policy';
  IF v_wo IS NULL AND v_partida IS NOT NULL AND v_partida ? 'placar_wo' THEN
    v_wo := v_partida->'placar_wo';
    -- normaliza chaves PT → EN se necessário
    IF v_wo ? 'mocinho_gols' OR v_wo ? 'visitante_gols' THEN
      v_wo := jsonb_build_object(
        'home_goals', COALESCE((v_wo->>'mocinho_gols')::int, (v_wo->>'home_goals')::int, 0),
        'away_goals', COALESCE((v_wo->>'visitante_gols')::int, (v_wo->>'away_goals')::int, 0)
      );
    ELSIF v_wo ? 'mocinho_pontos' OR v_wo ? 'visitante_pontos' THEN
      v_wo := jsonb_build_object(
        'home_points', COALESCE((v_wo->>'mocinho_pontos')::int, (v_wo->>'home_points')::int, 0),
        'away_points', COALESCE((v_wo->>'visitante_pontos')::int, (v_wo->>'away_points')::int, 0)
      );
    END IF;
  END IF;

  -- defaults se ainda nulos
  IF v_gp IS NULL THEN
    IF v_family = 'sets' THEN
      v_gp := jsonb_build_object('win',2,'loss',1,'wo_win',2,'wo_loss',0);
    ELSE
      v_gp := jsonb_build_object('win',3,'draw',1,'loss',0,'wo_win',3,'wo_loss',0);
    END IF;
  END IF;

  IF v_tb IS NULL OR (jsonb_typeof(v_tb)='array' AND jsonb_array_length(v_tb) = 0) THEN
    IF v_family = 'sets' THEN
      v_tb := '["points_table","head_to_head","sets_quotient","points_quotient","draw"]'::jsonb;
    ELSE
      v_tb := '["points_table","head_to_head","goal_difference","goals_for","draw"]'::jsonb;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'family', v_family,
    'format', v_format,
    'group_points', v_gp,
    'tie_breakers', v_tb,
    'walkover_policy', v_wo,
    'source', CASE WHEN v_pt IS NOT NULL OR v_des IS NOT NULL THEN 'jer2026-truth' ELSE 'db' END
  );
END;
$$;

-- ============================================================================
-- 2) rpc_validate_sport_event_quorum
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_validate_sport_event_quorum(
  p_event_id uuid,
  p_sport_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules jsonb;
  v_is_collective boolean;
  v_min_individual int;
  v_min_categoria int;
  v_required int;
  v_current int;
  v_team_min int;
BEGIN
  SELECT ser.rules, s.is_collective, ser.team_min_size
    INTO v_rules, v_is_collective, v_team_min
  FROM sport_event_rules ser
  JOIN sport_events se ON se.id = ser.sport_event_id
  JOIN sports s ON s.id = se.sport_id
  WHERE ser.sport_event_id = p_sport_event_id AND ser.event_id = p_event_id
    AND ser.is_active = true
  LIMIT 1;

  IF v_rules IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'current', 0, 'required', 0,
      'reason', 'NO_RULES_DEFINED', 'is_collective', v_is_collective);
  END IF;

  v_min_individual := COALESCE(
    (v_rules->>'minimo_participantes')::int,
    NULL
  );
  v_min_categoria := COALESCE(
    (v_rules->>'minimo_para_categoria')::int,
    NULL
  );

  IF v_is_collective THEN
    v_required := COALESCE(v_team_min, 2);
    SELECT COUNT(*) INTO v_current
    FROM teams t
    WHERE t.event_id = p_event_id
      AND t.sport_event_id = p_sport_event_id
      AND COALESCE(t.is_active, true) = true;
  ELSE
    v_required := COALESCE(v_min_categoria, v_min_individual, 1);
    SELECT COUNT(*) INTO v_current
    FROM participant_sport_events pse
    WHERE pse.sport_event_id = p_sport_event_id
      AND pse.status = 'apto';
  END IF;

  RETURN jsonb_build_object(
    'ok', v_current >= v_required,
    'current', v_current,
    'required', v_required,
    'is_collective', v_is_collective,
    'reason', CASE WHEN v_current < v_required THEN 'QUORUM_NOT_MET' ELSE 'OK' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_validate_sport_event_quorum(uuid, uuid) TO authenticated;

-- ============================================================================
-- 3) Trigger: validar limite de equipes por instituição
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_validate_team_institution_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules_row sport_event_rules%ROWTYPE;
  v_gender_scope text;
  v_max_teams int;
  v_current int;
BEGIN
  -- só validar coletivas com sport_event definido
  IF NEW.sport_event_id IS NULL OR NEW.delegation_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_rules_row
  FROM sport_event_rules
  WHERE sport_event_id = NEW.sport_event_id AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT se.gender_scope INTO v_gender_scope
  FROM sport_events se WHERE se.id = NEW.sport_event_id;

  v_max_teams := CASE
    WHEN v_gender_scope = 'female' THEN v_rules_row.institution_max_female
    WHEN v_gender_scope = 'male'   THEN v_rules_row.institution_max_male
    ELSE COALESCE(v_rules_row.institution_max_male, v_rules_row.institution_max_female)
  END;

  IF v_max_teams IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_current
  FROM teams t
  WHERE t.sport_event_id = NEW.sport_event_id
    AND t.delegation_id = NEW.delegation_id
    AND (TG_OP = 'INSERT' OR t.id <> NEW.id)
    AND COALESCE(t.is_active, true) = true;

  IF v_current >= v_max_teams THEN
    RAISE EXCEPTION 'INSTITUTION_LIMIT_EXCEEDED: instituicao ja possui % equipe(s) (limite=%) nesta prova', v_current, v_max_teams
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_team_institution_limit ON public.teams;
CREATE TRIGGER trg_validate_team_institution_limit
BEFORE INSERT OR UPDATE OF sport_event_id, delegation_id ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.tg_validate_team_institution_limit();

-- ============================================================================
-- 4) Pré-check de quórum em rpc_generate_groups
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_generate_groups(
  p_event_id uuid,
  p_sport_event_id uuid,
  p_phase_id uuid,
  p_group_count int,
  p_seed_mode text DEFAULT 'random'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quorum jsonb;
BEGIN
  v_quorum := rpc_validate_sport_event_quorum(p_event_id, p_sport_event_id);
  IF NOT (v_quorum->>'ok')::boolean THEN
    RAISE EXCEPTION 'QUORUM_NOT_MET: % de % participantes/equipes',
      v_quorum->>'current', v_quorum->>'required'
      USING ERRCODE = 'check_violation';
  END IF;

  FOR i IN 1..p_group_count LOOP
    INSERT INTO competition_groups (event_id, phase_id, name, sort_order)
    VALUES (p_event_id, p_phase_id, 'Grupo ' || chr(64 + i), i);
  END LOOP;

  RETURN json_build_object('groups_created', p_group_count, 'quorum', v_quorum);
END;
$$;