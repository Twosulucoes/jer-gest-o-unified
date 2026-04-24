DO $$
DECLARE
  v_event_id uuid := 'de0cd62b-05b9-4147-9257-9543d61d5739';
  v_atletismo_id uuid;
  v_bocha_id uuid;
  -- Atletismo: Infantil 12-14, Juvenil 15-17
  v_at_inf_m uuid; v_at_inf_f uuid;
  v_at_juv_m uuid; v_at_juv_f uuid;
  -- Bocha: Cat A 2012-2015 (10-14), Cat B 2008-2012 (13-18)
  v_bo_a_m uuid; v_bo_a_f uuid;
  v_bo_b_m uuid; v_bo_b_f uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.events
    WHERE id = v_event_id
  ) THEN
    RAISE NOTICE 'Skipping seed because event % not found', v_event_id;
    RETURN;
  END IF;
-- â”€â”€ 1. SPORTS â”€â”€
  SELECT id INTO v_atletismo_id FROM sports WHERE event_id=v_event_id AND slug='atletismo-paralimpico';
  IF v_atletismo_id IS NULL THEN
    INSERT INTO sports (event_id, name, slug, is_collective, is_paralympic)
    VALUES (v_event_id, 'Atletismo ParalÃ­mpico', 'atletismo-paralimpico', false, true)
    RETURNING id INTO v_atletismo_id;
  END IF;

  SELECT id INTO v_bocha_id FROM sports WHERE event_id=v_event_id AND slug='bocha-paralimpica';
  IF v_bocha_id IS NULL THEN
    INSERT INTO sports (event_id, name, slug, is_collective, is_paralympic)
    VALUES (v_event_id, 'Bocha ParalÃ­mpica', 'bocha-paralimpica', false, true)
    RETURNING id INTO v_bocha_id;
  END IF;

  -- â”€â”€ 2. CATEGORIAS PARALÃMPICAS â”€â”€
  -- Atletismo Infantil 12-14 (nascidos 2012-2014)
  SELECT id INTO v_at_inf_m FROM categories WHERE event_id=v_event_id AND slug='paralimpico-12-14-masc';
  IF v_at_inf_m IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, '12 a 14 anos Masculino (ParalÃ­mpico)', 'paralimpico-12-14-masc', 'male', 2012, 2014)
    RETURNING id INTO v_at_inf_m;
  END IF;
  SELECT id INTO v_at_inf_f FROM categories WHERE event_id=v_event_id AND slug='paralimpico-12-14-fem';
  IF v_at_inf_f IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, '12 a 14 anos Feminino (ParalÃ­mpico)', 'paralimpico-12-14-fem', 'female', 2012, 2014)
    RETURNING id INTO v_at_inf_f;
  END IF;

  -- Atletismo Juvenil 15-17 (reaproveita categorias 15-17 jÃ¡ criadas no lote anterior)
  SELECT id INTO v_at_juv_m FROM categories WHERE event_id=v_event_id AND slug='paralimpico-15-17-masc';
  IF v_at_juv_m IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, '15 a 17 anos Masculino (ParalÃ­mpico)', 'paralimpico-15-17-masc', 'male', 2009, 2011)
    RETURNING id INTO v_at_juv_m;
  END IF;
  SELECT id INTO v_at_juv_f FROM categories WHERE event_id=v_event_id AND slug='paralimpico-15-17-fem';
  IF v_at_juv_f IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, '15 a 17 anos Feminino (ParalÃ­mpico)', 'paralimpico-15-17-fem', 'female', 2009, 2011)
    RETURNING id INTO v_at_juv_f;
  END IF;

  -- Bocha Cat A: 2012-2015 (10-14 anos)
  SELECT id INTO v_bo_a_m FROM categories WHERE event_id=v_event_id AND slug='paralimpico-bocha-a-masc';
  IF v_bo_a_m IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, 'Bocha Cat A (2012-2015) Masculino', 'paralimpico-bocha-a-masc', 'male', 2012, 2015)
    RETURNING id INTO v_bo_a_m;
  END IF;
  SELECT id INTO v_bo_a_f FROM categories WHERE event_id=v_event_id AND slug='paralimpico-bocha-a-fem';
  IF v_bo_a_f IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, 'Bocha Cat A (2012-2015) Feminino', 'paralimpico-bocha-a-fem', 'female', 2012, 2015)
    RETURNING id INTO v_bo_a_f;
  END IF;

  -- Bocha Cat B: 2008-2012 (13-18 anos)
  SELECT id INTO v_bo_b_m FROM categories WHERE event_id=v_event_id AND slug='paralimpico-bocha-b-masc';
  IF v_bo_b_m IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, 'Bocha Cat B (2008-2012) Masculino', 'paralimpico-bocha-b-masc', 'male', 2008, 2012)
    RETURNING id INTO v_bo_b_m;
  END IF;
  SELECT id INTO v_bo_b_f FROM categories WHERE event_id=v_event_id AND slug='paralimpico-bocha-b-fem';
  IF v_bo_b_f IS NULL THEN
    INSERT INTO categories (event_id, name, slug, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, 'Bocha Cat B (2008-2012) Feminino', 'paralimpico-bocha-b-fem', 'female', 2008, 2012)
    RETURNING id INTO v_bo_b_f;
  END IF;

  -- ============================================================
  -- 3. SPORT_EVENTS â€” ATLETISMO PARALÃMPICO
  -- ============================================================

  -- Categoria INFANTIL (12-14) â€” pista: 75m, 150m, 800m, 2000m + salto em distÃ¢ncia
  INSERT INTO sport_events (event_id, sport_id, category_id, name, slug, is_active)
  SELECT v_event_id, v_atletismo_id, cat.id, prova.name, prova.slug || '-' || cat.suffix, true
  FROM (VALUES
    ('75m rasos',        '75m'),
    ('150m rasos',       '150m'),
    ('800m rasos',       '800m'),
    ('2000m rasos',      '2000m'),
    ('Salto em DistÃ¢ncia','salto-distancia'),
    ('Arremesso de Peso','arremesso-peso'),
    ('LanÃ§amento de Dardo','lancamento-dardo'),
    ('LanÃ§amento de Disco','lancamento-disco'),
    ('LanÃ§amento de Club','lancamento-club')
  ) AS prova(name, slug)
  CROSS JOIN (VALUES
    (v_at_inf_m, '12-14-m'),
    (v_at_inf_f, '12-14-f')
  ) AS cat(id, suffix)
  ON CONFLICT DO NOTHING;

  -- Categoria JUVENIL (15-17) â€” pista: 100m, 200m, 400m, 800m, 3000m + salto + campo
  INSERT INTO sport_events (event_id, sport_id, category_id, name, slug, is_active)
  SELECT v_event_id, v_atletismo_id, cat.id, prova.name, prova.slug || '-' || cat.suffix, true
  FROM (VALUES
    ('100m rasos',       '100m'),
    ('200m rasos',       '200m'),
    ('400m rasos',       '400m'),
    ('800m rasos',       '800m'),
    ('3000m rasos',      '3000m'),
    ('Salto em DistÃ¢ncia','salto-distancia'),
    ('Arremesso de Peso','arremesso-peso'),
    ('LanÃ§amento de Dardo','lancamento-dardo'),
    ('LanÃ§amento de Disco','lancamento-disco'),
    ('LanÃ§amento de Club','lancamento-club')
  ) AS prova(name, slug)
  CROSS JOIN (VALUES
    (v_at_juv_m, '15-17-m'),
    (v_at_juv_f, '15-17-f')
  ) AS cat(id, suffix)
  ON CONFLICT DO NOTHING;

  -- â”€â”€ BOCHA PARALÃMPICA â”€â”€ 1 prova (Individual) x 4 categorias
  INSERT INTO sport_events (event_id, sport_id, category_id, name, slug, is_active)
  VALUES
    (v_event_id, v_bocha_id, v_bo_a_m, 'Individual Masculino', 'individual-masc-cat-a', true),
    (v_event_id, v_bocha_id, v_bo_a_f, 'Individual Feminino',  'individual-fem-cat-a',  true),
    (v_event_id, v_bocha_id, v_bo_b_m, 'Individual Masculino', 'individual-masc-cat-b', true),
    (v_event_id, v_bocha_id, v_bo_b_f, 'Individual Feminino',  'individual-fem-cat-b',  true)
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 4. SPORT_EVENT_RULES
  -- ============================================================

  -- â”€â”€ ATLETISMO: provas de PISTA (corridas) â†’ family=time, format=heats
  INSERT INTO sport_event_rules (event_id, sport_event_id, is_active, rules_version, rules)
  SELECT
    v_event_id, se.id, true, 1,
    jsonb_build_object(
      'family', 'time',
      'format', 'heats',
      'participant_mode', 'individual',
      'scoring', jsonb_build_object('score_type', 'time_ms'),
      'scheduling', jsonb_build_object('lanes_min', 4, 'lanes_max', 8),
      'tie_breakers', jsonb_build_array('time_ms_asc'),
      'enrollment_limits', jsonb_build_object(),
      'minimo_participantes', 1,
      'preset_key', 'time',
      'venue', 'Pista de Atletismo do Parque AnauÃ¡',
      'paralympic', jsonb_build_object(
        'classification_required', true,
        'track_classes_visual', jsonb_build_array('T11','T12','T13'),
        'track_classes_intellectual', jsonb_build_array('T20'),
        'track_classes_cp_wheelchair', jsonb_build_array('T31','T32','T33','T34'),
        'track_classes_cp_walking', jsonb_build_array('T35','T36','T37','T38'),
        'track_classes_short_stature', jsonb_build_array('T40','T41'),
        'track_classes_lower_limb_no_prosthesis', jsonb_build_array('T42','T43','T44'),
        'track_classes_upper_limb', jsonb_build_array('T45','T46','T47'),
        'track_classes_wheelchair', jsonb_build_array('T51','T52','T53','T54'),
        'track_classes_amputee_prosthesis', jsonb_build_array('T61','T62','T63','T64'),
        'track_classes_severe_motor', jsonb_build_array('RR1','RR2','RR3')
      ),
      'notes', 'World Para Athletics/CPB. Pista no Parque AnauÃ¡. SÃ©ries classificatÃ³rias e/ou finais por tempo conforme inscriÃ§Ã£o.'
    )
  FROM sport_events se
  WHERE se.sport_id = v_atletismo_id AND se.event_id = v_event_id
    AND (se.slug LIKE '75m-%' OR se.slug LIKE '100m-%' OR se.slug LIKE '150m-%'
         OR se.slug LIKE '200m-%' OR se.slug LIKE '400m-%' OR se.slug LIKE '800m-%'
         OR se.slug LIKE '2000m-%' OR se.slug LIKE '3000m-%')
  ON CONFLICT (sport_event_id) WHERE is_active DO UPDATE
    SET rules = EXCLUDED.rules, rules_version = sport_event_rules.rules_version + 1, updated_at = now();

  -- â”€â”€ ATLETISMO: SALTO EM DISTÃ‚NCIA â†’ family=mark (cm)
  INSERT INTO sport_event_rules (event_id, sport_event_id, is_active, rules_version, rules)
  SELECT
    v_event_id, se.id, true, 1,
    jsonb_build_object(
      'family', 'mark',
      'format', 'heats_final',
      'participant_mode', 'individual',
      'scoring', jsonb_build_object('score_type', 'distance_cm', 'attempts_per_athlete', 3, 'best_attempt_counts', true),
      'scheduling', jsonb_build_object(),
      'tie_breakers', jsonb_build_array('best_mark_desc','second_best_mark_desc'),
      'enrollment_limits', jsonb_build_object(),
      'minimo_participantes', 1,
      'preset_key', 'mark',
      'paralympic', jsonb_build_object('classification_required', true),
      'notes', 'Salto em distÃ¢ncia paralÃ­mpico â€” final por marca. World Para Athletics/CPB.'
    )
  FROM sport_events se
  WHERE se.sport_id = v_atletismo_id AND se.event_id = v_event_id
    AND se.slug LIKE 'salto-distancia-%'
  ON CONFLICT (sport_event_id) WHERE is_active DO UPDATE
    SET rules = EXCLUDED.rules, rules_version = sport_event_rules.rules_version + 1, updated_at = now();

  -- â”€â”€ ATLETISMO: ARREMESSO/LANÃ‡AMENTOS â†’ family=mark
  INSERT INTO sport_event_rules (event_id, sport_event_id, is_active, rules_version, rules)
  SELECT
    v_event_id, se.id, true, 1,
    jsonb_build_object(
      'family', 'mark',
      'format', 'heats_final',
      'participant_mode', 'individual',
      'scoring', jsonb_build_object('score_type', 'distance_cm', 'attempts_per_athlete', 3, 'best_attempt_counts', true),
      'scheduling', jsonb_build_object(),
      'tie_breakers', jsonb_build_array('best_mark_desc','second_best_mark_desc'),
      'enrollment_limits', jsonb_build_object(),
      'minimo_participantes', 1,
      'preset_key', 'mark',
      'paralympic', jsonb_build_object(
        'classification_required', true,
        'field_classes_visual', jsonb_build_array('F11','F12','F13'),
        'field_classes_intellectual', jsonb_build_array('F20'),
        'field_classes_cp_wheelchair', jsonb_build_array('F31','F32','F33','F34'),
        'field_classes_cp_walking', jsonb_build_array('F35','F36','F37','F38'),
        'field_classes_short_stature', jsonb_build_array('F40','F41'),
        'field_classes_lower_limb_no_prosthesis', jsonb_build_array('F42','F43','F44'),
        'field_classes_upper_limb', jsonb_build_array('F45','F46','F47'),
        'field_classes_wheelchair', jsonb_build_array('F51','F52','F53','F54')
      ),
      'implements', jsonb_build_object(
        'shot_put_kg', jsonb_build_object(
          'infantil_male', 4.0, 'infantil_female', 3.0,
          'juvenil_male', 5.0, 'juvenil_female', 3.0,
          'F11_F13_F20_male', 7.26, 'F11_F13_F20_female', 4.00,
          'F32_F34_male', 4.00, 'F32_F34_female', 3.00,
          'note', 'Pesos variam conforme classe funcional, gÃªnero e tipo de deficiÃªncia (CPB/WPA)'
        ),
        'discus_kg', jsonb_build_object(
          'infantil_male', 1.0, 'infantil_female', 0.75,
          'juvenil_male', 1.5, 'juvenil_female', 1.0
        ),
        'javelin_g', jsonb_build_object(
          'infantil_male', 600, 'infantil_female', 500,
          'juvenil_male', 700, 'juvenil_female', 500,
          'F11_F13_F20_F38_F44_F46_male', 800, 'F11_F13_F20_F38_F44_F46_female', 600
        ),
        'club_g', jsonb_build_object(
          'all_categories', '397-450',
          'note', 'Club usado por atletas com comprometimento motor severo (cadeirantes)'
        )
      ),
      'notes', 'Arremessos/lanÃ§amentos paralÃ­mpicos â€” final por marca. Implementos ajustados por classe funcional, gÃªnero e categoria conforme CPB/WPA.'
    )
  FROM sport_events se
  WHERE se.sport_id = v_atletismo_id AND se.event_id = v_event_id
    AND (se.slug LIKE 'arremesso-peso-%' OR se.slug LIKE 'lancamento-dardo-%'
         OR se.slug LIKE 'lancamento-disco-%' OR se.slug LIKE 'lancamento-club-%')
  ON CONFLICT (sport_event_id) WHERE is_active DO UPDATE
    SET rules = EXCLUDED.rules, rules_version = sport_event_rules.rules_version + 1, updated_at = now();

  -- â”€â”€ BOCHA PARALÃMPICA â†’ family=score (combat-like individual), format=knockout
  INSERT INTO sport_event_rules (event_id, sport_event_id, is_active, rules_version, rules)
  SELECT
    v_event_id, se.id, true, 1,
    jsonb_build_object(
      'family', 'score',
      'format', 'knockout',
      'participant_mode', 'individual',
      'scoring', jsonb_build_object('score_type', 'points'),
      'scheduling', jsonb_build_object(),
      'tie_breakers', jsonb_build_array('extra_end','closest_ball'),
      'enrollment_limits', jsonb_build_object(
        'max_athletes_per_institution_per_category_and_gender', 4
      ),
      'minimo_participantes', 2,
      'preset_key', 'score',
      'paralympic', jsonb_build_object(
        'classification_required', true,
        'eligible_classes_bisfed', jsonb_build_array('BC1','BC2','BC3','BC4'),
        'governing_body', 'BISFed (Boccia International Sports Federation)',
        'reference_rules', 'BISFed Boccia Rules vigentes (versÃ£o em inglÃªs)'
      ),
      'equipment', jsonb_build_object(
        'wheelchair_max_height_cm', 66,
        'wheelchair_height_includes_cushion', true,
        'BC3_exception_height', true,
        'box_dimensions_m', '2.5 x 1.0',
        'ramp_must_fit_in_box', true,
        'aiming_devices_forbidden', true,
        'mechanical_propulsion_forbidden', true,
        'brakes_forbidden', true
      ),
      'discipline', jsonb_build_object(
        'sound_devices_forbidden', true,
        'expelled_coach_replacement_required', true,
        'replacement_min_age', 18
      ),
      'tournament_rules', jsonb_build_object(
        'same_school_separated_in_brackets', true,
        'draw_at_technical_meeting', true,
        'absence_at_meeting_eliminates_school', true
      ),
      'notes', 'BISFed (Boccia Rules). Individual com chaves por sorteio na reuniÃ£o tÃ©cnica. Cadeira â‰¤66cm (exceto BC3). Box 2,5x1m. Proibido buzinas/sinalizadores.'
    )
  FROM sport_events se
  WHERE se.sport_id = v_bocha_id AND se.event_id = v_event_id
  ON CONFLICT (sport_event_id) WHERE is_active DO UPDATE
    SET rules = EXCLUDED.rules, rules_version = sport_event_rules.rules_version + 1, updated_at = now();

END $$;
