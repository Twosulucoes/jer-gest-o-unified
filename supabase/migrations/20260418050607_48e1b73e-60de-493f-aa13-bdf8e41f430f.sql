DO $$
DECLARE
  v_event_id uuid := 'de0cd62b-05b9-4147-9257-9543d61d5739';
  v_sport_id uuid;
  v_cat_id uuid;
  v_se_id uuid;
  sport_rec RECORD;
  cat_rec RECORD;
  v_rules jsonb;
  v_disc_gender text;
BEGIN
  FOR sport_rec IN SELECT * FROM (VALUES
    ('Basquetebol', 'basquetebol'),
    ('Futebol de Campo', 'futebol-de-campo'),
    ('Futsal', 'futsal'),
    ('Handebol', 'handebol'),
    ('Voleibol', 'voleibol')
  ) AS t(name, slug)
  LOOP
    INSERT INTO public.sports (event_id, name, slug, is_collective, is_paralympic, match_config)
    VALUES (v_event_id, sport_rec.name, sport_rec.slug, true, false, '{}'::jsonb)
    ON CONFLICT (event_id, slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_sport_id;

    FOR cat_rec IN SELECT * FROM (VALUES
      ('12 a 14 anos Masculino', '12-14-masc', 2012, 2014, 'male'),
      ('12 a 14 anos Feminino',  '12-14-fem',  2012, 2014, 'female'),
      ('15 a 17 anos Masculino', '15-17-masc', 2009, 2011, 'male'),
      ('15 a 17 anos Feminino',  '15-17-fem',  2009, 2011, 'female')
    ) AS c(cname, cslug, miny, maxy, gscope)
    LOOP
      INSERT INTO public.categories (event_id, name, slug, min_birth_year, max_birth_year, gender_scope)
      VALUES (v_event_id, cat_rec.cname, sport_rec.slug || '-' || cat_rec.cslug, cat_rec.miny, cat_rec.maxy, cat_rec.gscope)
      ON CONFLICT DO NOTHING;

      SELECT id INTO v_cat_id FROM public.categories
        WHERE event_id = v_event_id AND slug = sport_rec.slug || '-' || cat_rec.cslug;

      v_se_id := NULL;
      INSERT INTO public.sport_events (event_id, sport_id, category_id, name, slug, is_active)
      VALUES (v_event_id, v_sport_id, v_cat_id,
              sport_rec.name || ' - ' || cat_rec.cname,
              sport_rec.slug || '-' || cat_rec.cslug,
              true)
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_se_id;

      IF v_se_id IS NULL THEN
        SELECT id INTO v_se_id FROM public.sport_events
          WHERE event_id = v_event_id AND slug = sport_rec.slug || '-' || cat_rec.cslug;
      END IF;

      v_rules := CASE sport_rec.slug
        WHEN 'basquetebol' THEN jsonb_build_object(
          'family','score','format','group_stage','participant_mode','team',
          'scoring', jsonb_build_object('score_type','points'),
          'scheduling', jsonb_build_object(),
          'tie_breakers', jsonb_build_array('confronto_direto','saldo_pontos','pontos_pro','sorteio'),
          'enrollment_limits', jsonb_build_object('elenco_min',8,'elenco_max',12,'em_quadra',5),
          'minimo_participantes', 8,
          'match', jsonb_build_object('periodos',4,'duracao_periodo_min',8,'prorrogacao_min',3),
          'preset_key','score')
        WHEN 'futebol-de-campo' THEN jsonb_build_object(
          'family','score','format','group_stage','participant_mode','team',
          'scoring', jsonb_build_object('score_type','goals'),
          'scheduling', jsonb_build_object(),
          'tie_breakers', jsonb_build_array('confronto_direto','saldo_gols','gols_pro','cartoes','sorteio'),
          'enrollment_limits', jsonb_build_object('elenco_min',11,'elenco_max',18,'em_quadra',11),
          'minimo_participantes', 11,
          'match', jsonb_build_object('periodos',2,'duracao_periodo_min',25,'intervalo_min',10),
          'preset_key','score')
        WHEN 'futsal' THEN jsonb_build_object(
          'family','score','format','group_stage','participant_mode','team',
          'scoring', jsonb_build_object('score_type','goals'),
          'scheduling', jsonb_build_object(),
          'tie_breakers', jsonb_build_array('confronto_direto','saldo_gols','gols_pro','cartoes','sorteio'),
          'enrollment_limits', jsonb_build_object('elenco_min',5,'elenco_max',12,'em_quadra',5),
          'minimo_participantes', 5,
          'match', jsonb_build_object('periodos',2,'duracao_periodo_min',15,'tipo_tempo','corrido','intervalo_min',5),
          'preset_key','score')
        WHEN 'handebol' THEN jsonb_build_object(
          'family','score','format','group_stage','participant_mode','team',
          'scoring', jsonb_build_object('score_type','goals'),
          'scheduling', jsonb_build_object(),
          'tie_breakers', jsonb_build_array('confronto_direto','saldo_gols','gols_pro','sorteio'),
          'enrollment_limits', jsonb_build_object('elenco_min',7,'elenco_max',14,'em_quadra',7),
          'minimo_participantes', 7,
          'match', jsonb_build_object('periodos',2,'duracao_periodo_min',20,'intervalo_min',10),
          'preset_key','score')
        WHEN 'voleibol' THEN jsonb_build_object(
          'family','sets','format','group_stage','participant_mode','team',
          'scoring', jsonb_build_object('score_type','rally_points','best_of',3,'set_points',25,'tie_break_points',15),
          'scheduling', jsonb_build_object(),
          'tie_breakers', jsonb_build_array('numero_vitorias','sets_average','pontos_average','confronto_direto','sorteio'),
          'enrollment_limits', jsonb_build_object('elenco_min',6,'elenco_max',12,'em_quadra',6),
          'minimo_participantes', 6,
          'preset_key','sets')
      END;

      v_disc_gender := CASE cat_rec.gscope WHEN 'male' THEN 'M' WHEN 'female' THEN 'F' ELSE 'X' END;

      INSERT INTO public.sport_event_rules (event_id, sport_event_id, is_active, rules_version, rules, discipline_type, allowed_genders)
      VALUES (v_event_id, v_se_id, true, 1, v_rules, 'collective', v_disc_gender)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;