DO $$
DECLARE
  v_event_id uuid := 'de0cd62b-05b9-4147-9257-9543d61d5739';
  v_sport_id uuid;
  v_cat_id uuid;
  v_se_id uuid;
  v_existing uuid;
  cats jsonb := jsonb_build_array(
    jsonb_build_object('slug','12-14-masc','name','12 a 14 anos Masculino','gender','male','min',2012,'max',2014),
    jsonb_build_object('slug','12-14-fem','name','12 a 14 anos Feminino','gender','female','min',2012,'max',2014),
    jsonb_build_object('slug','15-17-masc','name','15 a 17 anos Masculino','gender','male','min',2009,'max',2011),
    jsonb_build_object('slug','15-17-fem','name','15 a 17 anos Feminino','gender','female','min',2009,'max',2011)
  );
  cat jsonb;
  tkd_weights jsonb := jsonb_build_object(
    '12-14-masc', jsonb_build_array('ate-37kg','ate-45kg','ate-53kg','ate-61kg','acima-61kg'),
    '12-14-fem',  jsonb_build_array('ate-37kg','ate-44kg','ate-51kg','ate-59kg','acima-59kg'),
    '15-17-masc', jsonb_build_array('ate-48kg','ate-55kg','ate-63kg','ate-73kg','acima-73kg'),
    '15-17-fem',  jsonb_build_array('ate-44kg','ate-49kg','ate-55kg','ate-63kg','acima-63kg')
  );
  tkd_labels jsonb := jsonb_build_object(
    'ate-37kg','Até 37kg','ate-44kg','Até 44kg','ate-45kg','Até 45kg','ate-48kg','Até 48kg',
    'ate-49kg','Até 49kg','ate-51kg','Até 51kg','ate-53kg','Até 53kg','ate-55kg','Até 55kg',
    'ate-59kg','Até 59kg','ate-61kg','Até 61kg','ate-63kg','Até 63kg','ate-73kg','Até 73kg',
    'acima-59kg','Acima de 59kg','acima-61kg','Acima de 61kg','acima-63kg','Acima de 63kg','acima-73kg','Acima de 73kg'
  );
  weight_slug text;
  weight_label text;
  chess_modes jsonb := jsonb_build_array(
    jsonb_build_object('slug','pensado','name','Pensado','tolerance_min',30),
    jsonb_build_object('slug','blitz','name','Blitz','tolerance_min',3)
  );
  chess_mode jsonb;
  v_se_slug text;
  v_se_name text;
  v_rules jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.events
    WHERE id = v_event_id
  ) THEN
    RAISE NOTICE 'Skipping extra sports seed: event % not found', v_event_id;
    RETURN;
  END IF;
-- 1) SPORTS (event-scoped)
SELECT id INTO v_sport_id FROM sports WHERE event_id=v_event_id AND slug='volei-de-praia';
IF v_sport_id IS NULL THEN
  INSERT INTO sports(event_id,slug,name,is_collective,is_paralympic) VALUES (v_event_id,'volei-de-praia','Vôlei de Praia',false,false);
END IF;

SELECT id INTO v_sport_id FROM sports WHERE event_id=v_event_id AND slug='xadrez';
IF v_sport_id IS NULL THEN
  INSERT INTO sports(event_id,slug,name,is_collective,is_paralympic) VALUES (v_event_id,'xadrez','Xadrez',false,false);
END IF;

SELECT id INTO v_sport_id FROM sports WHERE event_id=v_event_id AND slug='taekwondo';
IF v_sport_id IS NULL THEN
  INSERT INTO sports(event_id,slug,name,is_collective,is_paralympic) VALUES (v_event_id,'taekwondo','Taekwondo',false,false);
END IF;

-- 2) CATEGORIES
FOR cat IN SELECT * FROM jsonb_array_elements(cats) LOOP
  SELECT id INTO v_cat_id FROM categories WHERE event_id=v_event_id AND slug=(cat->>'slug');
  IF v_cat_id IS NULL THEN
    INSERT INTO categories(event_id,slug,name,gender_scope,min_birth_year,max_birth_year)
    VALUES (v_event_id, cat->>'slug', cat->>'name', cat->>'gender', (cat->>'min')::int, (cat->>'max')::int);
  END IF;
END LOOP;

-- 3) VÔLEI DE PRAIA
SELECT id INTO v_sport_id FROM sports WHERE event_id=v_event_id AND slug='volei-de-praia';
FOR cat IN SELECT * FROM jsonb_array_elements(cats) LOOP
  SELECT id INTO v_cat_id FROM categories WHERE event_id=v_event_id AND slug=(cat->>'slug');
  v_se_slug := 'volei-de-praia-' || (cat->>'slug');
  v_se_name := 'Vôlei de Praia ' || (cat->>'name');
  
  SELECT id INTO v_se_id FROM sport_events WHERE event_id=v_event_id AND sport_id=v_sport_id AND category_id=v_cat_id;
  IF v_se_id IS NULL THEN
    INSERT INTO sport_events(event_id,sport_id,category_id,slug,name,is_active)
    VALUES (v_event_id,v_sport_id,v_cat_id,v_se_slug,v_se_name,true) RETURNING id INTO v_se_id;
  END IF;
  
  v_rules := jsonb_build_object(
    'family','sets','format','group_stage','participant_mode','pair',
    'scoring', jsonb_build_object('score_type','rally_points','best_of',3,'set_points',21,'tie_break_points',15),
    'scheduling', jsonb_build_object(),
    'tie_breakers', jsonb_build_array('confronto_direto','points_average','sorteio'),
    'enrollment_limits', jsonb_build_object('max_pares_por_escola',2,'max_tecnicos_por_dupla',1),
    'minimo_participantes',2, 'preset_key','sets',
    'notes','Best-of 3 sets (21 pts, tie-break 15). Limite 2 duplas por escola/categoria.'
  );
  
  SELECT id INTO v_existing FROM sport_event_rules WHERE sport_event_id=v_se_id AND event_id=v_event_id;
  IF v_existing IS NULL THEN
    INSERT INTO sport_event_rules(sport_event_id,event_id,rules,is_active,rules_version,allowed_genders,discipline_type)
    VALUES (v_se_id,v_event_id,v_rules,true,1,CASE WHEN (cat->>'gender')='male' THEN 'M' ELSE 'F' END,'individual');
  ELSE
    UPDATE sport_event_rules SET rules=v_rules, rules_version=COALESCE(rules_version,0)+1, updated_at=now() WHERE id=v_existing;
  END IF;
END LOOP;

-- 4) XADREZ
SELECT id INTO v_sport_id FROM sports WHERE event_id=v_event_id AND slug='xadrez';
FOR cat IN SELECT * FROM jsonb_array_elements(cats) LOOP
  SELECT id INTO v_cat_id FROM categories WHERE event_id=v_event_id AND slug=(cat->>'slug');
  FOR chess_mode IN SELECT * FROM jsonb_array_elements(chess_modes) LOOP
    v_se_slug := 'xadrez-' || (chess_mode->>'slug') || '-' || (cat->>'slug');
    v_se_name := 'Xadrez ' || (chess_mode->>'name') || ' ' || (cat->>'name');
    
    SELECT id INTO v_se_id FROM sport_events WHERE event_id=v_event_id AND sport_id=v_sport_id AND category_id=v_cat_id AND slug=v_se_slug;
    IF v_se_id IS NULL THEN
      INSERT INTO sport_events(event_id,sport_id,category_id,slug,name,is_active)
      VALUES (v_event_id,v_sport_id,v_cat_id,v_se_slug,v_se_name,true) RETURNING id INTO v_se_id;
    END IF;
    
    v_rules := jsonb_build_object(
      'family','ranking','format','swiss','participant_mode','individual',
      'scoring', jsonb_build_object('score_type','placement_points','win',1,'draw',0.5,'loss',0),
      'scheduling', jsonb_build_object(
        'tolerance_minutes',(chess_mode->>'tolerance_min')::int,
        'rounds_max',7,
        'time_per_player_minutes', CASE WHEN (chess_mode->>'slug')='blitz' THEN 3 ELSE NULL END,
        'increment_seconds_per_move', CASE WHEN (chess_mode->>'slug')='blitz' THEN 2 ELSE NULL END
      ),
      'tie_breakers', jsonb_build_array('resultado_individual','buchholz_corte_pior','buchholz_sem_corte','sonneborn_berger','maior_vitorias','sorteio'),
      'enrollment_limits', jsonb_build_object('max_atletas_por_escola_por_naipe',4,'max_tecnicos_por_naipe',1),
      'minimo_participantes',2, 'preset_key','ranking',
      'mode', chess_mode->>'slug', 'fallback_format_when_lt_8','round_robin',
      'notes', CASE WHEN (chess_mode->>'slug')='blitz'
        THEN 'Blitz: 3 min + 2s/lance. Tolerância 3 min. Suíço até 7 rodadas (Round-Robin se <8).'
        ELSE 'Pensado: tolerância 30 min. Suíço até 7 rodadas (Round-Robin se <8).' END
    );
    
    SELECT id INTO v_existing FROM sport_event_rules WHERE sport_event_id=v_se_id AND event_id=v_event_id;
    IF v_existing IS NULL THEN
      INSERT INTO sport_event_rules(sport_event_id,event_id,rules,is_active,rules_version,allowed_genders,discipline_type)
      VALUES (v_se_id,v_event_id,v_rules,true,1,CASE WHEN (cat->>'gender')='male' THEN 'M' ELSE 'F' END,'individual');
    ELSE
      UPDATE sport_event_rules SET rules=v_rules, rules_version=COALESCE(rules_version,0)+1, updated_at=now() WHERE id=v_existing;
    END IF;
  END LOOP;
END LOOP;

-- 5) TAEKWONDO
SELECT id INTO v_sport_id FROM sports WHERE event_id=v_event_id AND slug='taekwondo';
FOR cat IN SELECT * FROM jsonb_array_elements(cats) LOOP
  SELECT id INTO v_cat_id FROM categories WHERE event_id=v_event_id AND slug=(cat->>'slug');
  FOR weight_slug IN SELECT jsonb_array_elements_text(tkd_weights->(cat->>'slug')) LOOP
    weight_label := tkd_labels->>weight_slug;
    v_se_slug := 'taekwondo-' || (cat->>'slug') || '-' || weight_slug;
    v_se_name := 'Taekwondo ' || (cat->>'name') || ' - ' || weight_label;
    
    SELECT id INTO v_se_id FROM sport_events WHERE event_id=v_event_id AND sport_id=v_sport_id AND category_id=v_cat_id AND slug=v_se_slug;
    IF v_se_id IS NULL THEN
      INSERT INTO sport_events(event_id,sport_id,category_id,slug,name,is_active)
      VALUES (v_event_id,v_sport_id,v_cat_id,v_se_slug,v_se_name,true) RETURNING id INTO v_se_id;
    END IF;
    
    v_rules := jsonb_build_object(
      'family','combat','format','combat_bracket','participant_mode','individual',
      'scoring', jsonb_build_object('score_type','combat_points','rounds',2,'round_minutes',2,'rest_seconds',60),
      'scheduling', jsonb_build_object('min_rest_minutes',10),
      'tie_breakers', jsonb_build_array('vitorias','soma_pontos_pro','menor_pontos_contra','novo_confronto'),
      'enrollment_limits', jsonb_build_object('max_atletas_por_escola',4),
      'minimo_participantes',2, 'preset_key','combat',
      'weight_class', jsonb_build_object('slug',weight_slug,'label',weight_label),
      'graduation_constraint', CASE
        WHEN (cat->>'slug') LIKE '12-14%' THEN jsonb_build_object('max','3_GUB','head_kick_allowed',false)
        ELSE jsonb_build_object('min','4_GUB','head_kick_allowed',true) END,
      'system_rules', jsonb_build_object('2_atletas','melhor_de_2_vitorias','3_atletas','round_robin','4_ou_mais','eliminatoria_simples'),
      'notes', CASE WHEN (cat->>'slug') LIKE '12-14%'
        THEN 'Categoria 12-14: máx 3º GUB, sem chute na cabeça. 2 rounds de 2 min.'
        ELSE 'Categoria 15-17: mín 4º GUB, com chute na cabeça. 2 rounds de 2 min.' END
    );
    
    SELECT id INTO v_existing FROM sport_event_rules WHERE sport_event_id=v_se_id AND event_id=v_event_id;
    IF v_existing IS NULL THEN
      INSERT INTO sport_event_rules(sport_event_id,event_id,rules,is_active,rules_version,allowed_genders,discipline_type)
      VALUES (v_se_id,v_event_id,v_rules,true,1,CASE WHEN (cat->>'gender')='male' THEN 'M' ELSE 'F' END,'individual');
    ELSE
      UPDATE sport_event_rules SET rules=v_rules, rules_version=COALESCE(rules_version,0)+1, updated_at=now() WHERE id=v_existing;
    END IF;
  END LOOP;
END LOOP;

END $$;
