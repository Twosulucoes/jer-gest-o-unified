-- ===============================================================
-- 1. MELHORIA DA RPC DE SINCRONIZAÇÃO (NÃO DESTRUTIVA)
-- ===============================================================

CREATE OR REPLACE FUNCTION public.rpc_sync_rules_from_truth(
  p_event_id uuid,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
  v_modalidade jsonb;
  v_categoria jsonb;
  v_prova jsonb;
  v_limite jsonb;
  v_regras_gerais jsonb;
  v_sport_id uuid;
  v_category_id uuid;
  v_sport_event_id uuid;
  v_categories_count int := 0;
  v_sports_count int := 0;
  v_sport_events_count int := 0;
  v_rules_count int := 0;
  v_aliases_count int := 0;
  v_naipe text;
  v_naipe_db text;
  v_cat_slug text;
  v_alias text;
  v_payload_se_slugs text[] := '{}';
BEGIN
  -- Permissão: apenas admin/super_admin
  SELECT EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = v_user_id AND role IN ('admin','super_admin')
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem sincronizar regras';
  END IF;

  IF p_payload IS NULL OR p_payload->'modalidades' IS NULL THEN
    RAISE EXCEPTION 'Payload inválido: faltam modalidades';
  END IF;

  -- ───── 1. CATEGORIAS (UPSERT) ─────
  FOR v_categoria IN SELECT * FROM jsonb_array_elements(p_payload->'categorias')
  LOOP
    FOR v_naipe IN SELECT jsonb_array_elements_text(v_categoria->'naipes')
    LOOP
      v_naipe_db := CASE v_naipe
        WHEN 'Masculino' THEN 'male'
        WHEN 'Feminino' THEN 'female'
        WHEN 'Misto' THEN 'mixed'
        ELSE 'mixed'
      END;
      
      INSERT INTO categories (event_id, slug, name, min_birth_year, max_birth_year, gender_scope)
      VALUES (
        p_event_id,
        (v_categoria->>'slug') || '-' || v_naipe_db,
        (v_categoria->>'nome') || ' (' || v_naipe || ')',
        (v_categoria->>'min_ano_nascimento')::int,
        (v_categoria->>'max_ano_nascimento')::int,
        v_naipe_db
      )
      ON CONFLICT (event_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        min_birth_year = EXCLUDED.min_birth_year,
        max_birth_year = EXCLUDED.max_birth_year,
        gender_scope = EXCLUDED.gender_scope,
        updated_at = now();
        
      v_categories_count := v_categories_count + 1;
    END LOOP;
  END LOOP;

  -- ───── 2. MODALIDADES (sports) ─────
  FOR v_modalidade IN SELECT * FROM jsonb_array_elements(p_payload->'modalidades')
  LOOP
    INSERT INTO sports (slug, name, is_collective, is_paralympic)
    VALUES (
      v_modalidade->>'slug',
      v_modalidade->>'nome',
      (v_modalidade->>'tipo') = 'coletiva',
      (v_modalidade->>'tipo') = 'individual_paralimpica'
    )
    ON CONFLICT (slug) DO UPDATE SET 
      name = EXCLUDED.name,
      is_collective = EXCLUDED.is_collective,
      is_paralympic = EXCLUDED.is_paralympic,
      updated_at = now()
    RETURNING id INTO v_sport_id;
    v_sports_count := v_sports_count + 1;

    -- ───── 3. SPORT_EVENTS ─────
    FOR v_prova IN SELECT * FROM jsonb_array_elements(v_modalidade->'provas')
    LOOP
      FOR v_cat_slug IN SELECT jsonb_array_elements_text(v_modalidade->'categorias')
      LOOP
        FOR v_naipe IN SELECT jsonb_array_elements_text(v_modalidade->'naipes')
        LOOP
          v_naipe_db := CASE v_naipe
            WHEN 'Masculino' THEN 'male'
            WHEN 'Feminino' THEN 'female'
            WHEN 'Misto' THEN 'mixed'
            ELSE 'mixed'
          END;

          SELECT id INTO v_category_id
          FROM categories
          WHERE event_id = p_event_id
            AND slug = v_cat_slug || '-' || v_naipe_db
          LIMIT 1;

          IF v_category_id IS NULL THEN CONTINUE; END IF;

          v_alias := (v_modalidade->>'slug') || '-' || (v_prova->>'slug') || '-' || v_cat_slug || '-' || v_naipe_db;
          v_payload_se_slugs := array_append(v_payload_se_slugs, v_alias);

          INSERT INTO sport_events (
            event_id, sport_id, category_id,
            slug, name, gender_scope, is_active
          )
          VALUES (
            p_event_id, v_sport_id, v_category_id,
            v_alias,
            (v_modalidade->>'nome') || ' — ' || (v_prova->>'nome') || ' — ' || v_naipe,
            v_naipe_db,
            true
          )
          ON CONFLICT (sport_id, category_id, event_id, slug) DO UPDATE SET
            name = EXCLUDED.name,
            gender_scope = EXCLUDED.gender_scope,
            is_active = true,
            updated_at = now()
          RETURNING id INTO v_sport_event_id;

          IF v_sport_event_id IS NULL THEN
            SELECT id INTO v_sport_event_id FROM sport_events
            WHERE event_id = p_event_id AND slug = v_alias;
          END IF;

          v_sport_events_count := v_sport_events_count + 1;

          -- ───── 4. SPORT_EVENT_RULES (UPSERT) ─────
          v_limite := v_modalidade->'limites_por_escola'->v_cat_slug;

          INSERT INTO sport_event_rules (
            event_id, sport_event_id, is_active, rules_version,
            discipline_type, allowed_genders,
            institution_max_male, institution_max_female,
            team_min_size, team_max_size,
            substitution_cap,
            rules
          )
          VALUES (
            p_event_id, v_sport_event_id, true, 1,
            CASE v_modalidade->>'tipo'
              WHEN 'coletiva' THEN 'collective'
              WHEN 'individual_paralimpica' THEN 'individual_paralympic'
              ELSE 'individual'
            END,
            v_naipe,
            NULLIF(v_limite->>'masculino','null')::int,
            NULLIF(v_limite->>'feminino','null')::int,
            NULLIF(v_limite->>'minimo','null')::int,
            NULLIF(v_limite->>'masculino','null')::int, -- default max team size as male limit if collective
            (p_payload->'regras_gerais'->'substituicoes'->>'max_substituicoes_coletivas_por_modalidade_por_genero')::int,
            jsonb_build_object(
              'family', v_modalidade->>'familia',
              'format', v_modalidade->>'formato',
              'participant_mode', CASE WHEN (v_modalidade->>'tipo')='coletiva' THEN 'team' ELSE 'individual' END,
              'partida', v_modalidade->'partida',
              'pontuacao_grupos', v_modalidade->'pontuacao_grupos',
              'desempates', v_modalidade->'desempates',
              'minimo_participantes', NULLIF(v_limite->>'minimo','null')::int,
              'minimo_para_categoria', v_modalidade->'minimo_para_categoria',
              'observacao_limite', v_limite->>'observacao',
              'observacoes', v_modalidade->'observacoes',
              'confederacao', v_modalidade->>'confederacao',
              'fonte', 'jer2026-truth-v' || (p_payload->>'versao')
            )
          )
          ON CONFLICT (sport_event_id) DO UPDATE SET
            discipline_type = EXCLUDED.discipline_type,
            allowed_genders = EXCLUDED.allowed_genders,
            institution_max_male = EXCLUDED.institution_max_male,
            institution_max_female = EXCLUDED.institution_max_female,
            team_min_size = EXCLUDED.team_min_size,
            team_max_size = EXCLUDED.team_max_size,
            substitution_cap = EXCLUDED.substitution_cap,
            rules = EXCLUDED.rules,
            updated_at = now();
            
          v_rules_count := v_rules_count + 1;
        END LOOP;
      END LOOP;
    END LOOP;

    -- ───── 5. ALIASES (modalidade) ─────
    FOR v_alias IN SELECT jsonb_array_elements_text(v_modalidade->'aliases')
    LOOP
      INSERT INTO import_aliases (event_id, kind, alias_norm, canonical_slug, notes)
      VALUES (p_event_id, 'sport', upper(trim(v_alias)), v_modalidade->>'slug', 'Fonte de Verdade JER 2026')
      ON CONFLICT (event_id, kind, alias_norm) DO NOTHING;
      v_aliases_count := v_aliases_count + 1;
    END LOOP;
  END LOOP;

  -- ───── 6. DEATIVAR provas que não estão no regulamento ─────
  UPDATE sport_events 
  SET is_active = false, updated_at = now()
  WHERE event_id = p_event_id 
    AND is_active = true
    AND slug NOT IN (SELECT unnest(v_payload_slugs));

  -- ───── 7. ALIASES de categorias ─────
  FOR v_alias IN SELECT jsonb_object_keys(p_payload->'aliases_categorias')
  LOOP
    INSERT INTO import_aliases (event_id, kind, alias_norm, canonical_slug, notes)
    VALUES (
      p_event_id, 'category', upper(trim(v_alias)),
      p_payload->'aliases_categorias'->>v_alias,
      'Fonte de Verdade JER 2026'
    )
    ON CONFLICT (event_id, kind, alias_norm) DO NOTHING;
    v_aliases_count := v_aliases_count + 1;
  END LOOP;

  -- ───── 8. EVENT_PARTICIPATION_RULES ─────
  v_regras_gerais := p_payload->'regras_gerais';
  INSERT INTO event_participation_rules (
    event_id,
    max_collective_teams_per_athlete,
    max_individual_sports_per_athlete,
    max_events_per_individual_sport,
    max_jers_individual_modalities_per_athlete,
    max_jers_collective_modalities_per_athlete,
    max_jerpa_modalities_per_athlete,
    jers_registration_start, jers_registration_end,
    jerpa_registration_start, jerpa_registration_end,
    wxo_minutes, wo_minutes,
    protest_deadline_minutes,
    credential_second_copy_max_hours,
    food_donation_kg
  )
  VALUES (
    p_event_id,
    (v_regras_gerais->'inscricoes'->>'max_modalidade_coletiva_por_atleta')::int,
    (v_regras_gerais->'inscricoes'->>'max_modalidades_individuais_por_atleta')::int,
    (v_regras_gerais->'inscricoes'->>'max_modalidades_individuais_por_atleta')::int,
    (v_regras_gerais->'inscricoes'->>'max_modalidades_individuais_por_atleta')::int,
    (v_regras_gerais->'inscricoes'->>'max_modalidade_coletiva_por_atleta')::int,
    (v_regras_gerais->'inscricoes'->>'max_modalidade_jerpa_por_atleta')::int,
    (v_regras_gerais->'inscricoes'->>'jers_inicio')::date,
    (v_regras_gerais->'inscricoes'->>'jers_fim')::date,
    (v_regras_gerais->'inscricoes'->>'jerpa_inicio')::date,
    (v_regras_gerais->'inscricoes'->>'jerpa_fim')::date,
    (v_regras_gerais->'wo'->>'minutos_tolerancia_inicio')::int,
    (v_regras_gerais->'wo'->>'minutos_recusa_reinicio')::int,
    (v_regras_gerais->'protestos'->>'prazo_minutos_apos_termino')::int,
    (v_regras_gerais->'credenciamento'->>'segunda_via_horas_emissao')::int,
    (v_regras_gerais->'credenciamento'->>'segunda_via_kg_alimento')::int
  )
  ON CONFLICT (event_id) DO UPDATE SET
    max_collective_teams_per_athlete = EXCLUDED.max_collective_teams_per_athlete,
    max_individual_sports_per_athlete = EXCLUDED.max_individual_sports_per_athlete,
    max_events_per_individual_sport = EXCLUDED.max_events_per_individual_sport,
    max_jers_individual_modalities_per_athlete = EXCLUDED.max_jers_individual_modalities_per_athlete,
    max_jers_collective_modalities_per_athlete = EXCLUDED.max_jers_collective_modalities_per_athlete,
    max_jerpa_modalities_per_athlete = EXCLUDED.max_jerpa_modalities_per_athlete,
    jers_registration_start = EXCLUDED.jers_registration_start,
    jers_registration_end = EXCLUDED.jers_registration_end,
    jerpa_registration_start = EXCLUDED.jerpa_registration_start,
    jerpa_registration_end = EXCLUDED.jerpa_registration_end,
    wxo_minutes = EXCLUDED.wxo_minutes,
    wo_minutes = EXCLUDED.wo_minutes,
    protest_deadline_minutes = EXCLUDED.protest_deadline_minutes,
    credential_second_copy_max_hours = EXCLUDED.credential_second_copy_max_hours,
    food_donation_kg = EXCLUDED.food_donation_kg,
    updated_at = now();

  -- ───── 9. AUDIT ─────
  INSERT INTO audit_events (table_name, record_id, action, payload, created_by)
  VALUES (
    'sport_event_rules', p_event_id, 'sync_from_truth',
    jsonb_build_object(
      'versao', p_payload->>'versao',
      'categorias', v_categories_count,
      'sports', v_sports_count,
      'sport_events', v_sport_events_count,
      'rules', v_rules_count,
      'aliases', v_aliases_count,
      'destructive', false
    ),
    v_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'versao', p_payload->>'versao',
    'categorias', v_categories_count,
    'sports', v_sports_count,
    'sport_events', v_sport_events_count,
    'rules', v_rules_count,
    'aliases', v_aliases_count
  );
END;
$$;

-- ===============================================================
-- 2. MELHORIA DA RPC DE DIFF (MAIS PROFUNDA)
-- ===============================================================

CREATE OR REPLACE FUNCTION public.rpc_diff_rules_vs_truth(
  p_event_id uuid,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_truth_modalidades text[];
  v_db_modalidades text[];
  v_only_in_truth text[];
  v_only_in_db text[];
  v_db_sport_events_count int;
  v_db_categories_count int;
  v_db_rules_count int;
  v_parameter_diffs jsonb := '[]'::jsonb;
BEGIN
  -- modalidades na fonte de verdade
  SELECT array_agg(m->>'slug') INTO v_truth_modalidades
  FROM jsonb_array_elements(p_payload->'modalidades') m;

  -- modalidades atualmente no banco para o evento
  SELECT array_agg(DISTINCT s.slug) INTO v_db_modalidades
  FROM sport_events se
  JOIN sports s ON s.id = se.sport_id
  WHERE se.event_id = p_event_id AND se.is_active = true;

  v_only_in_truth := COALESCE(
    ARRAY(SELECT unnest(v_truth_modalidades) EXCEPT SELECT unnest(COALESCE(v_db_modalidades,'{}'::text[]))),
    '{}'::text[]
  );
  v_only_in_db := COALESCE(
    ARRAY(SELECT unnest(COALESCE(v_db_modalidades,'{}'::text[])) EXCEPT SELECT unnest(v_truth_modalidades)),
    '{}'::text[]
  );

  SELECT count(*) INTO v_db_sport_events_count FROM sport_events WHERE event_id = p_event_id AND is_active = true;
  SELECT count(*) INTO v_db_categories_count FROM categories WHERE event_id = p_event_id;
  SELECT count(*) INTO v_db_rules_count FROM sport_event_rules WHERE event_id = p_event_id AND is_active = true;

  -- Comparação de categorias (exemplo: anos de nascimento)
  WITH cat_diff AS (
    SELECT 
      c.slug,
      c.min_birth_year as db_min,
      (t.val->>'min_ano_nascimento')::int as truth_min,
      c.max_birth_year as db_max,
      (t.val->>'max_ano_nascimento')::int as truth_max
    FROM categories c
    JOIN (SELECT jsonb_array_elements(p_payload->'categorias') as val) t 
      ON (t.val->>'slug') || '-male' = c.slug OR (t.val->>'slug') || '-female' = c.slug OR (t.val->>'slug') || '-mixed' = c.slug
    WHERE c.event_id = p_event_id
  )
  SELECT jsonb_agg(row_to_json(cat_diff)) INTO v_parameter_diffs
  FROM cat_diff
  WHERE db_min != truth_min OR db_max != truth_max;

  RETURN jsonb_build_object(
    'truth', jsonb_build_object(
      'modalidades', jsonb_array_length(p_payload->'modalidades'),
      'categorias', jsonb_array_length(p_payload->'categorias'),
      'versao', p_payload->>'versao'
    ),
    'db', jsonb_build_object(
      'modalidades', COALESCE(array_length(v_db_modalidades,1),0),
      'sport_events', v_db_sport_events_count,
      'categorias', v_db_categories_count,
      'rules', v_db_rules_count
    ),
    'modalidades_apenas_no_regulamento', to_jsonb(v_only_in_truth),
    'modalidades_apenas_no_banco', to_jsonb(v_only_in_db),
    'parameter_discrepancies', COALESCE(v_parameter_diffs, '[]'::jsonb),
    'sincronizado', (
      array_length(v_only_in_truth,1) IS NULL
      AND array_length(v_only_in_db,1) IS NULL
      AND v_db_rules_count > 0
      AND jsonb_array_length(COALESCE(v_parameter_diffs, '[]'::jsonb)) = 0
    )
  );
END;
$$;