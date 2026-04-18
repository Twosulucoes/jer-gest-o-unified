CREATE OR REPLACE FUNCTION public.rpc_sync_rules_from_truth(p_event_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
BEGIN
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

  DELETE FROM sport_event_rules WHERE event_id = p_event_id;
  DELETE FROM sport_events WHERE event_id = p_event_id;
  DELETE FROM sports WHERE event_id = p_event_id;
  DELETE FROM categories WHERE event_id = p_event_id;
  DELETE FROM import_aliases WHERE event_id = p_event_id;
  DELETE FROM event_participation_rules WHERE event_id = p_event_id;

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
      ON CONFLICT DO NOTHING;
      v_categories_count := v_categories_count + 1;
    END LOOP;
  END LOOP;

  FOR v_modalidade IN SELECT * FROM jsonb_array_elements(p_payload->'modalidades')
  LOOP
    INSERT INTO sports (event_id, slug, name, is_collective, is_paralympic)
    VALUES (
      p_event_id,
      v_modalidade->>'slug',
      v_modalidade->>'nome',
      (v_modalidade->>'tipo') = 'coletiva',
      (v_modalidade->>'tipo') = 'individual_paralimpica'
    )
    ON CONFLICT (event_id, slug) DO UPDATE
      SET name = EXCLUDED.name,
          is_collective = EXCLUDED.is_collective,
          is_paralympic = EXCLUDED.is_paralympic
    RETURNING id INTO v_sport_id;
    v_sports_count := v_sports_count + 1;

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

          v_sport_event_id := NULL;
          INSERT INTO sport_events (
            event_id, sport_id, category_id,
            slug, name
          )
          VALUES (
            p_event_id, v_sport_id, v_category_id,
            (v_modalidade->>'slug') || '-' || (v_prova->>'slug') || '-' || v_cat_slug || '-' || v_naipe_db,
            (v_modalidade->>'nome') || ' — ' || (v_prova->>'nome') || ' — ' || v_naipe
          )
          ON CONFLICT DO NOTHING
          RETURNING id INTO v_sport_event_id;

          IF v_sport_event_id IS NULL THEN
            SELECT id INTO v_sport_event_id FROM sport_events
            WHERE event_id = p_event_id
              AND slug = (v_modalidade->>'slug') || '-' || (v_prova->>'slug') || '-' || v_cat_slug || '-' || v_naipe_db;
          END IF;

          v_sport_events_count := v_sport_events_count + 1;

          v_limite := v_modalidade->'limites_por_escola'->v_cat_slug;

          INSERT INTO sport_event_rules (
            event_id, sport_event_id, is_active, rules_version,
            discipline_type, allowed_genders,
            institution_max_male, institution_max_female,
            team_min_size, team_max_size,
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
            NULLIF(v_limite->>'masculino','null')::int,
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
              'fonte', 'jer2026-truth-v1'
            )
          );
          v_rules_count := v_rules_count + 1;
        END LOOP;
      END LOOP;
    END LOOP;

    FOR v_alias IN SELECT jsonb_array_elements_text(v_modalidade->'aliases')
    LOOP
      INSERT INTO import_aliases (event_id, kind, alias_norm, canonical_slug, notes)
      VALUES (p_event_id, 'sport', upper(trim(v_alias)), v_modalidade->>'slug', 'Fonte de Verdade JER 2026')
      ON CONFLICT DO NOTHING;
      v_aliases_count := v_aliases_count + 1;
    END LOOP;
  END LOOP;

  FOR v_alias IN SELECT jsonb_object_keys(p_payload->'aliases_categorias')
  LOOP
    INSERT INTO import_aliases (event_id, kind, alias_norm, canonical_slug, notes)
    VALUES (
      p_event_id, 'category', upper(trim(v_alias)),
      p_payload->'aliases_categorias'->>v_alias,
      'Fonte de Verdade JER 2026'
    )
    ON CONFLICT DO NOTHING;
    v_aliases_count := v_aliases_count + 1;
  END LOOP;

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
  );

  INSERT INTO audit_events (table_name, record_id, action, payload, created_by)
  VALUES (
    'sport_event_rules', p_event_id, 'sync_from_truth',
    jsonb_build_object(
      'versao', p_payload->>'versao',
      'categorias', v_categories_count,
      'sports', v_sports_count,
      'sport_events', v_sport_events_count,
      'rules', v_rules_count,
      'aliases', v_aliases_count
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
$function$;