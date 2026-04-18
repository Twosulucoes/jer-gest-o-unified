-- ============================================================================
-- Cadastro de 3 modalidades PARALÍMPICAS (JERPA 2026)
-- 1) Natação Paralímpica  2) Parabadminton  3) Tênis de Mesa Paralímpico
-- ============================================================================

DO $$
DECLARE
  v_event_id uuid := 'de0cd62b-05b9-4147-9257-9543d61d5739';
  v_natacao_id uuid;
  v_parabadminton_id uuid;
  v_tmesa_id uuid;
  -- Categorias paralímpicas (faixas etárias específicas)
  v_cat_a_11_13_m uuid; v_cat_a_11_13_f uuid; -- Parabadminton
  v_cat_b_14_17_m uuid; v_cat_b_14_17_f uuid;
  v_cat_a_11_14_m uuid; v_cat_a_11_14_f uuid; -- Natação / TM
  v_cat_b_15_17_m uuid; v_cat_b_15_17_f uuid;
  v_cat_a_12_14_m uuid; v_cat_a_12_14_f uuid; -- TM (12-14)
BEGIN
  -- ── 1. SPORTS ──
  SELECT id INTO v_natacao_id FROM sports WHERE event_id=v_event_id AND slug='natacao-paralimpica';
  IF v_natacao_id IS NULL THEN
    INSERT INTO sports (event_id, name, slug, is_collective, is_paralympic)
    VALUES (v_event_id, 'Natação Paralímpica', 'natacao-paralimpica', false, true)
    RETURNING id INTO v_natacao_id;
  END IF;

  SELECT id INTO v_parabadminton_id FROM sports WHERE event_id=v_event_id AND slug='parabadminton';
  IF v_parabadminton_id IS NULL THEN
    INSERT INTO sports (event_id, name, slug, is_collective, is_paralympic)
    VALUES (v_event_id, 'Parabadminton', 'parabadminton', false, true)
    RETURNING id INTO v_parabadminton_id;
  END IF;

  SELECT id INTO v_tmesa_id FROM sports WHERE event_id=v_event_id AND slug='tenis-de-mesa-paralimpico';
  IF v_tmesa_id IS NULL THEN
    INSERT INTO sports (event_id, name, slug, is_collective, is_paralympic)
    VALUES (v_event_id, 'Tênis de Mesa Paralímpico', 'tenis-de-mesa-paralimpico', false, true)
    RETURNING id INTO v_tmesa_id;
  END IF;

  -- ── 2. CATEGORIAS (cria se não existir) ──
  -- 11-13 (Parabadminton: nascidos 2013-2015) - usando max=2015,min=2013
  SELECT id INTO v_cat_a_11_13_m FROM categories WHERE event_id=v_event_id AND slug='paralimpico-11-13-masc';
  IF v_cat_a_11_13_m IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, '11 a 13 anos Masculino (Paralímpico)', 'paralimpico-11-13-masc', 'male', 2013, 2015)
    RETURNING id INTO v_cat_a_11_13_m;
  END IF;
  SELECT id INTO v_cat_a_11_13_f FROM categories WHERE event_id=v_event_id AND slug='paralimpico-11-13-fem';
  IF v_cat_a_11_13_f IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, '11 a 13 anos Feminino (Paralímpico)', 'paralimpico-11-13-fem', 'female', 2013, 2015)
    RETURNING id INTO v_cat_a_11_13_f;
  END IF;

  -- 14-17 (Parabadminton: nascidos 2009-2012)
  SELECT id INTO v_cat_b_14_17_m FROM categories WHERE event_id=v_event_id AND slug='paralimpico-14-17-masc';
  IF v_cat_b_14_17_m IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, '14 a 17 anos Masculino (Paralímpico)', 'paralimpico-14-17-masc', 'male', 2009, 2012)
    RETURNING id INTO v_cat_b_14_17_m;
  END IF;
  SELECT id INTO v_cat_b_14_17_f FROM categories WHERE event_id=v_event_id AND slug='paralimpico-14-17-fem';
  IF v_cat_b_14_17_f IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, '14 a 17 anos Feminino (Paralímpico)', 'paralimpico-14-17-fem', 'female', 2009, 2012)
    RETURNING id INTO v_cat_b_14_17_f;
  END IF;

  -- 11-14 (Natação: cat A) e 12-14 (TM: cat A)
  SELECT id INTO v_cat_a_11_14_m FROM categories WHERE event_id=v_event_id AND slug='paralimpico-11-14-masc';
  IF v_cat_a_11_14_m IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, '11 a 14 anos Masculino (Paralímpico)', 'paralimpico-11-14-masc', 'male', 2012, 2015)
    RETURNING id INTO v_cat_a_11_14_m;
  END IF;
  SELECT id INTO v_cat_a_11_14_f FROM categories WHERE event_id=v_event_id AND slug='paralimpico-11-14-fem';
  IF v_cat_a_11_14_f IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, '11 a 14 anos Feminino (Paralímpico)', 'paralimpico-11-14-fem', 'female', 2012, 2015)
    RETURNING id INTO v_cat_a_11_14_f;
  END IF;

  -- 15-17 (Natação cat B + TM cat B)
  SELECT id INTO v_cat_b_15_17_m FROM categories WHERE event_id=v_event_id AND slug='paralimpico-15-17-masc';
  IF v_cat_b_15_17_m IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, '15 a 17 anos Masculino (Paralímpico)', 'paralimpico-15-17-masc', 'male', 2009, 2011)
    RETURNING id INTO v_cat_b_15_17_m;
  END IF;
  SELECT id INTO v_cat_b_15_17_f FROM categories WHERE event_id=v_event_id AND slug='paralimpico-15-17-fem';
  IF v_cat_b_15_17_f IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, '15 a 17 anos Feminino (Paralímpico)', 'paralimpico-15-17-fem', 'female', 2009, 2011)
    RETURNING id INTO v_cat_b_15_17_f;
  END IF;

  -- 12-14 (TM cat A: 2012-2015 conforme regulamento)
  v_cat_a_12_14_m := v_cat_a_11_14_m; -- reaproveita (mesma faixa funcional)
  v_cat_a_12_14_f := v_cat_a_11_14_f;

  -- ============================================================
  -- 3. SPORT_EVENTS (provas)
  -- ============================================================

  -- ── NATAÇÃO PARALÍMPICA ── 8 provas x 4 categorias = 32 provas (M+F, A+B)
  INSERT INTO sport_events (event_id, sport_id, category_id, name, slug, is_active)
  SELECT v_event_id, v_natacao_id, cat.id, prova.name, prova.slug || '-' || cat.suffix, true
  FROM (VALUES
    ('50m Livre', '50m-livre'),
    ('100m Livre', '100m-livre'),
    ('200m Livre', '200m-livre'),
    ('50m Costas', '50m-costas'),
    ('100m Costas', '100m-costas'),
    ('50m Peito', '50m-peito'),
    ('100m Peito', '100m-peito'),
    ('50m Borboleta', '50m-borboleta')
  ) AS prova(name, slug)
  CROSS JOIN (VALUES
    (v_cat_a_11_14_m, '11-14-m'),
    (v_cat_a_11_14_f, '11-14-f'),
    (v_cat_b_15_17_m, '15-17-m'),
    (v_cat_b_15_17_f, '15-17-f')
  ) AS cat(id, suffix)
  ON CONFLICT DO NOTHING;

  -- ── PARABADMINTON ── 1 prova (Simples) x 4 categorias
  INSERT INTO sport_events (event_id, sport_id, category_id, name, slug, is_active)
  VALUES
    (v_event_id, v_parabadminton_id, v_cat_a_11_13_m, 'Simples Masculino', 'simples-masc-11-13', true),
    (v_event_id, v_parabadminton_id, v_cat_a_11_13_f, 'Simples Feminino',  'simples-fem-11-13',  true),
    (v_event_id, v_parabadminton_id, v_cat_b_14_17_m, 'Simples Masculino', 'simples-masc-14-17', true),
    (v_event_id, v_parabadminton_id, v_cat_b_14_17_f, 'Simples Feminino',  'simples-fem-14-17',  true)
  ON CONFLICT DO NOTHING;

  -- ── TÊNIS DE MESA PARALÍMPICO ── 1 prova (Individual) x 4 categorias
  INSERT INTO sport_events (event_id, sport_id, category_id, name, slug, is_active)
  VALUES
    (v_event_id, v_tmesa_id, v_cat_a_11_14_m, 'Individual Masculino', 'individual-masc-11-14', true),
    (v_event_id, v_tmesa_id, v_cat_a_11_14_f, 'Individual Feminino',  'individual-fem-11-14',  true),
    (v_event_id, v_tmesa_id, v_cat_b_15_17_m, 'Individual Masculino', 'individual-masc-15-17', true),
    (v_event_id, v_tmesa_id, v_cat_b_15_17_f, 'Individual Feminino',  'individual-fem-15-17',  true)
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 4. SPORT_EVENT_RULES
  -- ============================================================

  -- NATAÇÃO PARALÍMPICA: family=time, format=heats (timed finals)
  INSERT INTO sport_event_rules (event_id, sport_event_id, is_active, rules_version, rules)
  SELECT
    v_event_id,
    se.id,
    true,
    1,
    jsonb_build_object(
      'family', 'time',
      'format', 'heats',
      'participant_mode', 'individual',
      'scoring', jsonb_build_object('score_type', 'time_ms'),
      'scheduling', jsonb_build_object('lanes_min', 6, 'lanes_max', 8),
      'tie_breakers', jsonb_build_array('time_ms_asc'),
      'enrollment_limits', jsonb_build_object(
        'max_individual_events_per_athlete', 4,
        'relays_excluded_from_limit', true
      ),
      'minimo_participantes', 1,
      'preset_key', 'time',
      'paralympic', jsonb_build_object(
        'classification_required', true,
        'functional_classes_physical', jsonb_build_array('S1','S2','S3','S4','S5','S6','S7','S8','S9','S10'),
        'functional_classes_visual', jsonb_build_array('S11','S12','S13'),
        'functional_classes_intellectual', jsonb_build_array('S14'),
        'requires_classification', true,
        'cid_required_for_S14', 'F70-F79'
      ),
      'pool', jsonb_build_object('length_options_m', jsonb_build_array(25, 50)),
      'notes', 'World Para Swimming/CPB. Sem índice. 4 provas individuais máx. Revezamento não conta no limite. Adaptações: largada adaptada, tapper para DV.'
    )
  FROM sport_events se
  WHERE se.sport_id = v_natacao_id AND se.event_id = v_event_id
  ON CONFLICT (sport_event_id) WHERE is_active DO UPDATE
    SET rules = EXCLUDED.rules, rules_version = sport_event_rules.rules_version + 1, updated_at = now();

  -- PARABADMINTON: family=sets, knockout precedido de grupos
  INSERT INTO sport_event_rules (event_id, sport_event_id, is_active, rules_version, rules)
  SELECT
    v_event_id,
    se.id,
    true,
    1,
    jsonb_build_object(
      'family', 'sets',
      'format', 'group_stage',
      'participant_mode', 'individual',
      'scoring', jsonb_build_object(
        'score_type', 'rally_points',
        'best_of', 3,
        'set_points', 21,
        'min_difference', 2
      ),
      'scheduling', jsonb_build_object(
        'warmup_minutes', 2,
        'min_rest_minutes', 30
      ),
      'tie_breakers', jsonb_build_array('head_to_head','sets_diff','points_diff'),
      'enrollment_limits', jsonb_build_object(
        'max_athletes_per_institution', 20,
        'max_per_class_and_category', 1
      ),
      'minimo_participantes', 2,
      'preset_key', 'sets',
      'paralympic', jsonb_build_object(
        'classification_required', true,
        'functional_classes', jsonb_build_array('WH','SL','SU','SH','SI'),
        'classes_combinable', true,
        'class_SH_not_combinable', true,
        'gender_combination_allowed_with_approval', true
      ),
      'group_config', jsonb_build_object(
        'min_per_group', 3,
        'max_per_group', 4,
        'followed_by_knockout', true
      ),
      'notes', 'BWF/CBBd. Apenas Simples (sem duplas). Petecas nylon BWF. Combinação de classes permitida exceto SH.'
    )
  FROM sport_events se
  WHERE se.sport_id = v_parabadminton_id AND se.event_id = v_event_id
  ON CONFLICT (sport_event_id) WHERE is_active DO UPDATE
    SET rules = EXCLUDED.rules, rules_version = sport_event_rules.rules_version + 1, updated_at = now();

  -- TÊNIS DE MESA PARALÍMPICO: family=sets, group_stage + knockout (3 sets / 5 sets)
  INSERT INTO sport_event_rules (event_id, sport_event_id, is_active, rules_version, rules)
  SELECT
    v_event_id,
    se.id,
    true,
    1,
    jsonb_build_object(
      'family', 'sets',
      'format', 'group_stage',
      'participant_mode', 'individual',
      'scoring', jsonb_build_object(
        'score_type', 'rally_points',
        'best_of_group_phase', 3,
        'best_of_knockout_phase', 5,
        'set_points', 11,
        'min_difference', 2
      ),
      'scheduling', jsonb_build_object('min_rest_minutes', 0),
      'tie_breakers', jsonb_build_array('head_to_head','sets_diff','points_diff'),
      'enrollment_limits', jsonb_build_object(
        'per_institution_male', jsonb_build_object('walking', 2, 'wheelchair', 2, 'intellectual', 2),
        'per_institution_female', jsonb_build_object('walking', 2, 'wheelchair', 2, 'intellectual', 2),
        'per_category_distribution', jsonb_build_object('cat_A_11_14', 1, 'cat_B_15_17', 1)
      ),
      'minimo_participantes', 2,
      'preset_key', 'sets',
      'paralympic', jsonb_build_object(
        'classification_required', true,
        'functional_classes_wheelchair', jsonb_build_array('1','2','3','4','5'),
        'functional_classes_walking', jsonb_build_array('6','7','8','9','10'),
        'functional_classes_intellectual', jsonb_build_array('11'),
        'eligible_disabilities', jsonb_build_array('física','intelectual'),
        'cid_required_for_intellectual', 'F70-F79'
      ),
      'equipment', jsonb_build_object(
        'ball_type', '40mm 3 estrelas ITTF',
        'racket_rubber_red_black_required', true,
        'uniform_white_forbidden', true
      ),
      'notes', 'ITTF/CBTM/IPC. Fase classificatória bo3, eliminatória bo5. Sets até 11 pts (dif. 2). Bola 40mm 3*. Uniforme branco proibido.'
    )
  FROM sport_events se
  WHERE se.sport_id = v_tmesa_id AND se.event_id = v_event_id
  ON CONFLICT (sport_event_id) WHERE is_active DO UPDATE
    SET rules = EXCLUDED.rules, rules_version = sport_event_rules.rules_version + 1, updated_at = now();

END $$;