DO $$
DECLARE
  v_event_id uuid := 'de0cd62b-05b9-4147-9257-9543d61d5739';
  v_sport_id uuid;
  v_cat_id uuid;
  v_se_id uuid;
  v_disc_gender text;
  sport_rec RECORD;
  cat_rec RECORD;
  v_rules jsonb;

  -- arrays auxiliares
  ciclismo_cats CONSTANT jsonb := '[
    {"cname":"12 a 14 anos Masculino","cslug":"12-14-masc","miny":2012,"maxy":2014,"gscope":"male"},
    {"cname":"12 a 14 anos Feminino","cslug":"12-14-fem","miny":2012,"maxy":2014,"gscope":"female"},
    {"cname":"15 a 17 anos Masculino","cslug":"15-17-masc","miny":2009,"maxy":2011,"gscope":"male"},
    {"cname":"15 a 17 anos Feminino","cslug":"15-17-fem","miny":2009,"maxy":2011,"gscope":"female"}
  ]'::jsonb;

  gr_cats CONSTANT jsonb := '[
    {"cname":"12 a 13 anos Feminino","cslug":"12-13-fem","miny":2013,"maxy":2014,"gscope":"female"},
    {"cname":"14 a 15 anos Feminino","cslug":"14-15-fem","miny":2011,"maxy":2012,"gscope":"female"}
  ]'::jsonb;

  judo_cats CONSTANT jsonb := '[
    {"cname":"12 a 14 anos Masculino","cslug":"12-14-masc","miny":2012,"maxy":2014,"gscope":"male"},
    {"cname":"12 a 14 anos Feminino","cslug":"12-14-fem","miny":2012,"maxy":2014,"gscope":"female"},
    {"cname":"15 a 17 anos Masculino","cslug":"15-17-masc","miny":2009,"maxy":2011,"gscope":"male"},
    {"cname":"15 a 17 anos Feminino","cslug":"15-17-fem","miny":2009,"maxy":2011,"gscope":"female"}
  ]'::jsonb;

  -- Pesos do Judô
  judo_pesos_12_14_unisex CONSTANT jsonb := '[
    {"nome":"Super Ligeiro","ate_kg":36},
    {"nome":"Ligeiro","ate_kg":40},
    {"nome":"Meio-leve","ate_kg":44},
    {"nome":"Leve","ate_kg":48},
    {"nome":"Meio-Médio","ate_kg":53},
    {"nome":"Médio","ate_kg":58},
    {"nome":"Meio-pesado","ate_kg":64},
    {"nome":"Pesado","acima_kg":64}
  ]'::jsonb;

  judo_pesos_15_17_masc CONSTANT jsonb := '[
    {"nome":"Super Ligeiro","ate_kg":50},
    {"nome":"Ligeiro","ate_kg":55},
    {"nome":"Meio-Leve","ate_kg":60},
    {"nome":"Leve","ate_kg":66},
    {"nome":"Meio-Médio","ate_kg":73},
    {"nome":"Médio","ate_kg":81},
    {"nome":"Meio-Pesado","ate_kg":90},
    {"nome":"Pesado","acima_kg":90}
  ]'::jsonb;

  judo_pesos_15_17_fem CONSTANT jsonb := '[
    {"nome":"Super Ligeiro","ate_kg":40},
    {"nome":"Ligeiro","ate_kg":44},
    {"nome":"Meio-Leve","ate_kg":48},
    {"nome":"Leve","ate_kg":52},
    {"nome":"Meio-Médio","ate_kg":57},
    {"nome":"Médio","ate_kg":63},
    {"nome":"Meio-Pesado","ate_kg":70},
    {"nome":"Pesado","acima_kg":70}
  ]'::jsonb;

  v_cats jsonb;
  v_pesos jsonb;
  v_age_min int;
BEGIN
  ----------------------------------------------------------------
  -- 1) CICLISMO
  ----------------------------------------------------------------
  INSERT INTO public.sports (event_id, name, slug, is_collective, is_paralympic, match_config)
  VALUES (v_event_id, 'Ciclismo', 'ciclismo', false, false, '{}'::jsonb)
  ON CONFLICT (event_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_sport_id;

  FOR cat_rec IN SELECT * FROM jsonb_to_recordset(ciclismo_cats)
    AS x(cname text, cslug text, miny int, maxy int, gscope text)
  LOOP
    INSERT INTO public.categories (event_id, name, slug, min_birth_year, max_birth_year, gender_scope)
    VALUES (v_event_id, cat_rec.cname, 'ciclismo-' || cat_rec.cslug, cat_rec.miny, cat_rec.maxy, cat_rec.gscope)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_cat_id FROM public.categories
      WHERE event_id = v_event_id AND slug = 'ciclismo-' || cat_rec.cslug;

    v_se_id := NULL;
    INSERT INTO public.sport_events (event_id, sport_id, category_id, name, slug, is_active)
    VALUES (v_event_id, v_sport_id, v_cat_id, 'Ciclismo - ' || cat_rec.cname, 'ciclismo-' || cat_rec.cslug, true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_se_id;
    IF v_se_id IS NULL THEN
      SELECT id INTO v_se_id FROM public.sport_events
        WHERE event_id = v_event_id AND slug = 'ciclismo-' || cat_rec.cslug;
    END IF;

    v_rules := jsonb_build_object(
      'family','ranking','format','ranking','participant_mode','individual',
      'scoring', jsonb_build_object('score_type','placement_points'),
      'scheduling', jsonb_build_object('concentracao_min_antes',60,'fechamento_sumula_min_antes',15),
      'tie_breakers', jsonb_build_array('total_pontos','melhor_colocacao_final','sorteio'),
      'enrollment_limits', jsonb_build_object(),
      'minimo_participantes', 2,
      'provas', jsonb_build_array(
        jsonb_build_object('nome','Prova por Pontos','distancia_min_km',7.5,'distancia_max_km',10,'sprints_max',10,
          'pontos_por_sprint', jsonb_build_array(5,3,2,1),
          'bonus_dobrar_pelotao', 10),
        jsonb_build_object('nome','Prova de Estrada em Circuito','formato','circuito_fechado',
          'pontos_colocacao', jsonb_build_array(10,9,8,7))
      ),
      'penalidades', jsonb_build_object(
        'apoio_irregular','advertencia_ou_desqualificacao',
        'capacete_obrigatorio', true,
        'sem_acompanhamento_veiculos', true
      ),
      'recurso_minutos', 30,
      'preset_key','ranking'
    );

    v_disc_gender := CASE cat_rec.gscope WHEN 'male' THEN 'M' WHEN 'female' THEN 'F' ELSE 'X' END;

    INSERT INTO public.sport_event_rules (event_id, sport_event_id, is_active, rules_version, rules, discipline_type, allowed_genders)
    VALUES (v_event_id, v_se_id, true, 1, v_rules, 'individual', v_disc_gender)
    ON CONFLICT DO NOTHING;
  END LOOP;

  ----------------------------------------------------------------
  -- 2) GINÁSTICA RÍTMICA
  ----------------------------------------------------------------
  INSERT INTO public.sports (event_id, name, slug, is_collective, is_paralympic, match_config)
  VALUES (v_event_id, 'Ginástica Rítmica', 'ginastica-ritmica', false, false, '{}'::jsonb)
  ON CONFLICT (event_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_sport_id;

  FOR cat_rec IN SELECT * FROM jsonb_to_recordset(gr_cats)
    AS x(cname text, cslug text, miny int, maxy int, gscope text)
  LOOP
    INSERT INTO public.categories (event_id, name, slug, min_birth_year, max_birth_year, gender_scope)
    VALUES (v_event_id, cat_rec.cname, 'ginastica-ritmica-' || cat_rec.cslug, cat_rec.miny, cat_rec.maxy, cat_rec.gscope)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_cat_id FROM public.categories
      WHERE event_id = v_event_id AND slug = 'ginastica-ritmica-' || cat_rec.cslug;

    v_se_id := NULL;
    INSERT INTO public.sport_events (event_id, sport_id, category_id, name, slug, is_active)
    VALUES (v_event_id, v_sport_id, v_cat_id, 'Ginástica Rítmica - ' || cat_rec.cname, 'ginastica-ritmica-' || cat_rec.cslug, true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_se_id;
    IF v_se_id IS NULL THEN
      SELECT id INTO v_se_id FROM public.sport_events
        WHERE event_id = v_event_id AND slug = 'ginastica-ritmica-' || cat_rec.cslug;
    END IF;

    v_rules := jsonb_build_object(
      'family','mark','format','ranking','participant_mode','individual',
      'scoring', jsonb_build_object('score_type','points','agregacao','soma_aparelhos'),
      'scheduling', jsonb_build_object('ordem_apresentacao','sorteio'),
      'tie_breakers', jsonb_build_array('maior_nota_individual_aparelho','sorteio'),
      'enrollment_limits', jsonb_build_object(
        'ginastas_por_equipe', CASE cat_rec.cslug WHEN '12-13-fem' THEN 4 ELSE 3 END
      ),
      'minimo_participantes', 1,
      'aparelhos', jsonb_build_array('Arco','Maças'),
      'premiacao', jsonb_build_object('por_aparelho', true, 'classificacao_geral', true, 'medalhas','1-2-3'),
      'classificacao_nacional', jsonb_build_object(
        'top_n', CASE cat_rec.cslug WHEN '12-13-fem' THEN 4 ELSE 2 END
      ),
      'regulamento_base','FIG/CBG - Código de Pontuação ciclo 2025/2028 - Segunda Divisão',
      'preset_key','mark'
    );

    INSERT INTO public.sport_event_rules (event_id, sport_event_id, is_active, rules_version, rules, discipline_type, allowed_genders)
    VALUES (v_event_id, v_se_id, true, 1, v_rules, 'individual', 'F')
    ON CONFLICT DO NOTHING;
  END LOOP;

  ----------------------------------------------------------------
  -- 3) JUDÔ
  ----------------------------------------------------------------
  INSERT INTO public.sports (event_id, name, slug, is_collective, is_paralympic, match_config)
  VALUES (v_event_id, 'Judô', 'judo', false, false, '{}'::jsonb)
  ON CONFLICT (event_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_sport_id;

  FOR cat_rec IN SELECT * FROM jsonb_to_recordset(judo_cats)
    AS x(cname text, cslug text, miny int, maxy int, gscope text)
  LOOP
    INSERT INTO public.categories (event_id, name, slug, min_birth_year, max_birth_year, gender_scope)
    VALUES (v_event_id, cat_rec.cname, 'judo-' || cat_rec.cslug, cat_rec.miny, cat_rec.maxy, cat_rec.gscope)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_cat_id FROM public.categories
      WHERE event_id = v_event_id AND slug = 'judo-' || cat_rec.cslug;

    v_se_id := NULL;
    INSERT INTO public.sport_events (event_id, sport_id, category_id, name, slug, is_active)
    VALUES (v_event_id, v_sport_id, v_cat_id, 'Judô - ' || cat_rec.cname, 'judo-' || cat_rec.cslug, true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_se_id;
    IF v_se_id IS NULL THEN
      SELECT id INTO v_se_id FROM public.sport_events
        WHERE event_id = v_event_id AND slug = 'judo-' || cat_rec.cslug;
    END IF;

    -- selecionar faixas de peso conforme categoria/gênero
    IF cat_rec.cslug LIKE '12-14%' THEN
      v_pesos := judo_pesos_12_14_unisex;
    ELSIF cat_rec.cslug = '15-17-masc' THEN
      v_pesos := judo_pesos_15_17_masc;
    ELSE
      v_pesos := judo_pesos_15_17_fem;
    END IF;

    v_rules := jsonb_build_object(
      'family','combat','format','combat_bracket','participant_mode','individual',
      'scoring', jsonb_build_object('score_type','combat_points','golden_score', true),
      'scheduling', jsonb_build_object('intervalo_min_entre_combates_min',10,'pesagem','dia_anterior_unica'),
      'tie_breakers', jsonb_build_array('ippon','wazari','shido_adversario'),
      'enrollment_limits', jsonb_build_object('uma_categoria_de_peso_por_atleta', true, 'sem_limite_por_instituicao', true),
      'minimo_participantes', 2,
      'tempo_combate_min', CASE WHEN cat_rec.cslug LIKE '12-14%' THEN 3 ELSE 4 END,
      'graduacao_minima', CASE WHEN cat_rec.cslug LIKE '12-14%' THEN 'azul' ELSE 'laranja' END,
      'tecnicas_proibidas', CASE WHEN cat_rec.cslug LIKE '12-14%'
        THEN jsonb_build_array('shime-waza','kansetsu-waza')
        ELSE jsonb_build_array() END,
      'weight_classes', v_pesos,
      'sistema_disputa', jsonb_build_array(
        jsonb_build_object('ate_atletas',2,'formato','melhor_de_2_vitorias'),
        jsonb_build_object('ate_atletas',5,'formato','round_robin'),
        jsonb_build_object('a_partir_de_atletas',6,'formato','eliminatoria_simples_3_lugar_por_perdedores_finalistas')
      ),
      'penalidade_ausencia','fusen_gachi',
      'regulamento_base','IJF/CBJ',
      'preset_key','combat'
    );

    v_disc_gender := CASE cat_rec.gscope WHEN 'male' THEN 'M' WHEN 'female' THEN 'F' ELSE 'X' END;

    INSERT INTO public.sport_event_rules (event_id, sport_event_id, is_active, rules_version, rules, discipline_type, allowed_genders)
    VALUES (v_event_id, v_se_id, true, 1, v_rules, 'individual', v_disc_gender)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;