-- Wrestling (Luta OlÃ­mpica) â€” JER's 2026
-- Regulamento FWER: combat_bracket adaptativo, com regras especÃ­ficas por categoria/estilo/peso
DO $$
DECLARE
  v_event_id uuid := 'de0cd62b-05b9-4147-9257-9543d61d5739';
  v_sport_id uuid;
  v_cat_sub14 uuid;
  v_cat_sub16 uuid;
  v_se_id uuid;
  v_rules jsonb;
  v_combinacoes record;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.events
    WHERE id = v_event_id
  ) THEN
    RAISE NOTICE 'Skipping seed because event % not found', v_event_id;
    RETURN;
  END IF;
-- 1) Sport: Wrestling (Luta OlÃ­mpica)
  SELECT id INTO v_sport_id FROM public.sports WHERE event_id = v_event_id AND slug = 'wrestling';
  IF v_sport_id IS NULL THEN
    INSERT INTO public.sports (event_id, slug, name, is_collective, is_paralympic)
    VALUES (v_event_id, 'wrestling', 'Wrestling (Luta OlÃ­mpica)', false, false)
    RETURNING id INTO v_sport_id;
  END IF;

  -- 2) Categorias: Sub-14 (Infantil 12-14) e Sub-16 (Juvenil 14-16)
  SELECT id INTO v_cat_sub14 FROM public.categories WHERE event_id = v_event_id AND slug = 'sub-14';
  IF v_cat_sub14 IS NULL THEN
    INSERT INTO public.categories (event_id, slug, name, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, 'sub-14', 'Sub-14 (Infantil 12-14)', 'mixed', 2012, 2014)
    RETURNING id INTO v_cat_sub14;
  END IF;

  SELECT id INTO v_cat_sub16 FROM public.categories WHERE event_id = v_event_id AND slug = 'sub-16';
  IF v_cat_sub16 IS NULL THEN
    INSERT INTO public.categories (event_id, slug, name, gender_scope, min_birth_year, max_birth_year)
    VALUES (v_event_id, 'sub-16', 'Sub-16 (Juvenil 14-16)', 'mixed', 2010, 2012)
    RETURNING id INTO v_cat_sub16;
  END IF;

  -- 3) Sport Events + Rules â€” loop pelas combinaÃ§Ãµes
  FOR v_combinacoes IN
    SELECT * FROM (VALUES
      -- ===== SUB-14 INFANTIL (CBDE) =====
      -- Estilo Livre Masculino
      ('sub-14','wrestling-sub14-livre-masc-52',     'Wrestling Sub-14 Livre Masc atÃ© 52kg',      'M', 'livre',        44.001, 52.000, 120),
      ('sub-14','wrestling-sub14-livre-masc-68',     'Wrestling Sub-14 Livre Masc 62-68kg',       'M', 'livre',        62.001, 68.000, 120),
      ('sub-14','wrestling-sub14-livre-masc-75',     'Wrestling Sub-14 Livre Masc 68-75kg',       'M', 'livre',        68.001, 75.000, 120),
      -- Estilo Greco-Romano Masculino
      ('sub-14','wrestling-sub14-greco-masc-44',     'Wrestling Sub-14 Greco Masc 41-44kg',       'M', 'greco-romano', 41.000, 44.000, 120),
      ('sub-14','wrestling-sub14-greco-masc-62',     'Wrestling Sub-14 Greco Masc 52-62kg',       'M', 'greco-romano', 52.001, 62.000, 120),
      ('sub-14','wrestling-sub14-greco-masc-85',     'Wrestling Sub-14 Greco Masc 75-85kg',       'M', 'greco-romano', 75.001, 85.000, 120),
      -- Estilo Livre Feminino
      ('sub-14','wrestling-sub14-livre-fem-39',      'Wrestling Sub-14 Livre Fem 36-39kg',        'F', 'livre',        36.000, 39.000, 120),
      ('sub-14','wrestling-sub14-livre-fem-46',      'Wrestling Sub-14 Livre Fem 39-46kg',        'F', 'livre',        39.001, 46.000, 120),
      ('sub-14','wrestling-sub14-livre-fem-50',      'Wrestling Sub-14 Livre Fem 46-50kg',        'F', 'livre',        46.001, 50.000, 120),
      ('sub-14','wrestling-sub14-livre-fem-58',      'Wrestling Sub-14 Livre Fem 50-58kg',        'F', 'livre',        50.001, 58.000, 120),
      ('sub-14','wrestling-sub14-livre-fem-62',      'Wrestling Sub-14 Livre Fem 58-62kg',        'F', 'livre',        58.001, 62.000, 120),
      ('sub-14','wrestling-sub14-livre-fem-66',      'Wrestling Sub-14 Livre Fem 62-66kg',        'F', 'livre',        62.001, 66.000, 120),
      -- ===== SUB-16 JUVENIL (COB) =====
      -- Estilo Livre Masculino
      ('sub-16','wrestling-sub16-livre-masc-51',     'Wrestling Sub-16 Livre Masc atÃ© 51kg',      'M', 'livre',        0.000,  51.000, 180),
      ('sub-16','wrestling-sub16-livre-masc-60',     'Wrestling Sub-16 Livre Masc atÃ© 60kg',      'M', 'livre',        51.001, 60.000, 180),
      ('sub-16','wrestling-sub16-livre-masc-71',     'Wrestling Sub-16 Livre Masc atÃ© 71kg',      'M', 'livre',        60.001, 71.000, 180),
      ('sub-16','wrestling-sub16-livre-masc-92',     'Wrestling Sub-16 Livre Masc atÃ© 92kg',      'M', 'livre',        71.001, 92.000, 180),
      -- Estilo Greco-Romano Masculino
      ('sub-16','wrestling-sub16-greco-masc-55',     'Wrestling Sub-16 Greco Masc atÃ© 55kg',      'M', 'greco-romano', 0.000,  55.000, 180),
      ('sub-16','wrestling-sub16-greco-masc-65',     'Wrestling Sub-16 Greco Masc atÃ© 65kg',      'M', 'greco-romano', 55.001, 65.000, 180),
      ('sub-16','wrestling-sub16-greco-masc-80',     'Wrestling Sub-16 Greco Masc atÃ© 80kg',      'M', 'greco-romano', 65.001, 80.000, 180),
      ('sub-16','wrestling-sub16-greco-masc-110',    'Wrestling Sub-16 Greco Masc atÃ© 110kg',     'M', 'greco-romano', 80.001, 110.000, 180),
      -- Estilo Livre Feminino
      ('sub-16','wrestling-sub16-livre-fem-43',      'Wrestling Sub-16 Livre Fem atÃ© 43kg',       'F', 'livre',        0.000,  43.000, 180),
      ('sub-16','wrestling-sub16-livre-fem-49',      'Wrestling Sub-16 Livre Fem atÃ© 49kg',       'F', 'livre',        43.001, 49.000, 180),
      ('sub-16','wrestling-sub16-livre-fem-57',      'Wrestling Sub-16 Livre Fem atÃ© 57kg',       'F', 'livre',        49.001, 57.000, 180),
      ('sub-16','wrestling-sub16-livre-fem-65',      'Wrestling Sub-16 Livre Fem atÃ© 65kg',       'F', 'livre',        57.001, 65.000, 180),
      ('sub-16','wrestling-sub16-livre-fem-73',      'Wrestling Sub-16 Livre Fem atÃ© 73kg',       'F', 'livre',        65.001, 73.000, 180)
    ) AS t(cat_slug, se_slug, se_name, gender, estilo, peso_min, peso_max, periodo_seg)
  LOOP
    -- Cria sport_event se nÃ£o existir
    SELECT id INTO v_se_id 
      FROM public.sport_events 
     WHERE event_id = v_event_id AND slug = v_combinacoes.se_slug;
    
    IF v_se_id IS NULL THEN
      INSERT INTO public.sport_events (event_id, sport_id, category_id, slug, name, is_active)
      VALUES (
        v_event_id, v_sport_id,
        CASE WHEN v_combinacoes.cat_slug = 'sub-14' THEN v_cat_sub14 ELSE v_cat_sub16 END,
        v_combinacoes.se_slug, v_combinacoes.se_name, true
      )
      RETURNING id INTO v_se_id;
    END IF;

    -- Monta JSON de regras (famÃ­lia combat, formato adaptativo via min participantes)
    v_rules := jsonb_build_object(
      'family', 'combat',
      'format', 'combat_bracket',
      'participant_mode', 'individual',
      'scoring', jsonb_build_object(
        'score_type', 'combat_points',
        'walkover_policy', jsonb_build_object('wo_minutes', 0, 'no_show_eliminates', true)
      ),
      'scheduling', jsonb_build_object('min_rest_minutes', 10),
      'tie_breakers', jsonb_build_array('greatest_technique_value','fewer_penalties','last_point_scored'),
      'enrollment_limits', jsonb_build_object('weight_kg_min', v_combinacoes.peso_min, 'weight_kg_max', v_combinacoes.peso_max, 'tolerance_kg', 0.5),
      'minimo_participantes', 2,
      'preset_key', 'combat',
      'notes', 'Wrestling FWER 2026: 2 perÃ­odos de ' || (v_combinacoes.periodo_seg/60) || ' min (intervalo 30s). VitÃ³ria por encostamento, superioridade tÃ©cnica (10pt livre / 8pt greco) ou pontos. Pesagem Ãºnica 2 dias antes (tolerÃ¢ncia 500g). Sistema adaptativo: 2=melhor de 3; 3-5=todos contra todos; 6-7=2 grupos+SF/F; 8+=eliminatÃ³ria direta com repescagem simples (UWW).',
      'wrestling', jsonb_build_object(
        'style', v_combinacoes.estilo,
        'gender', v_combinacoes.gender,
        'period_seconds', v_combinacoes.periodo_seg,
        'period_count', 2,
        'period_break_seconds', 30,
        'technical_superiority_diff', CASE WHEN v_combinacoes.estilo = 'greco-romano' THEN 8 ELSE 10 END,
        'weight_kg_min', v_combinacoes.peso_min,
        'weight_kg_max', v_combinacoes.peso_max,
        'weighing_tolerance_kg', 0.5,
        'classification_points', jsonb_build_object('fall_or_dq_or_wo', 5, 'technical_superiority', 4, 'win_by_points', 3, 'loss_with_points', 1, 'loss_no_points', 0),
        'adaptive_format', jsonb_build_array(
          jsonb_build_object('participants', 2, 'format', 'best_of_3'),
          jsonb_build_object('participants_min', 3, 'participants_max', 5, 'format', 'round_robin'),
          jsonb_build_object('participants', 6, 'format', 'two_groups_of_3_with_sf_final'),
          jsonb_build_object('participants', 7, 'format', 'two_groups_3_and_4_with_sf_final'),
          jsonb_build_object('participants_min', 8, 'format', 'single_elim_with_repechage')
        ),
        'rules_authority', 'United World Wrestling (UWW)',
        'national_reference', CASE WHEN v_combinacoes.cat_slug = 'sub-14' THEN 'CBDE' ELSE 'COB' END
      )
    );

    -- Upsert da regra
    INSERT INTO public.sport_event_rules (sport_event_id, event_id, rules, is_active, rules_version)
    VALUES (v_se_id, v_event_id, v_rules, true, 1)
    ON CONFLICT (sport_event_id) DO UPDATE 
      SET rules = EXCLUDED.rules,
          is_active = true,
          rules_version = public.sport_event_rules.rules_version + 1,
          updated_at = now();
  END LOOP;

  RAISE NOTICE 'Wrestling cadastrado: 25 provas (Sub-14: 12 + Sub-16: 13) em 3 estilos.';
END $$;
