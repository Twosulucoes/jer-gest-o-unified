-- RPC para resetar dados importados de um evento (e opcionalmente de uma etapa)
-- Permite reimportar a planilha do zero com segurança

CREATE OR REPLACE FUNCTION public.rpc_reset_import_data(
  p_event_id uuid,
  p_stage_id uuid DEFAULT NULL,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_seed_tag_filter text;
  v_credentials_count int := 0;
  v_matches_count int := 0;
  v_scans_count int := 0;
  v_meals_count int := 0;
  v_lodging_count int := 0;
  v_blocks jsonb := '[]'::jsonb;
  v_deleted jsonb := '{}'::jsonb;
  v_n int;
  v_pse_ids uuid[];
  v_part_ids uuid[];
  v_deleg_ids uuid[];
  v_se_ids uuid[];
  v_cat_ids uuid[];
  v_inst_ids uuid[];
  v_person_ids uuid[];
BEGIN
  -- Permissão
  IF NOT (has_role(v_uid, 'admin') OR has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'Permissão negada: apenas admin pode resetar importação';
  END IF;

  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'event_id obrigatório';
  END IF;

  -- Filtro de etapa via seed_tag (padrão usado pelo importador)
  IF p_stage_id IS NOT NULL THEN
    v_seed_tag_filter := 'import:' || p_event_id::text || ':' || p_stage_id::text;
  END IF;

  -- ============ CHECAGENS DE BLOQUEIO ============
  -- Credenciais emitidas no evento
  SELECT COUNT(*) INTO v_credentials_count
  FROM participant_credentials pc
  WHERE pc.event_id = p_event_id;

  -- Partidas/competição
  SELECT COUNT(*) INTO v_matches_count
  FROM competition_matches cm
  WHERE cm.event_id = p_event_id;

  -- Logística: scans, consumos, ocupações
  SELECT COUNT(*) INTO v_scans_count
  FROM credential_scans cs WHERE cs.event_id = p_event_id;

  SELECT COUNT(*) INTO v_meals_count
  FROM meal_consumptions mc
  JOIN participants p ON p.id = mc.participant_id
  WHERE p.event_id = p_event_id;

  SELECT COUNT(*) INTO v_lodging_count
  FROM lodging_occupancies lo
  JOIN participants p ON p.id = lo.participant_id
  WHERE p.event_id = p_event_id;

  IF v_credentials_count > 0 THEN
    v_blocks := v_blocks || jsonb_build_object('type','credentials','count',v_credentials_count);
  END IF;
  IF v_matches_count > 0 THEN
    v_blocks := v_blocks || jsonb_build_object('type','matches','count',v_matches_count);
  END IF;
  IF v_scans_count > 0 OR v_meals_count > 0 OR v_lodging_count > 0 THEN
    v_blocks := v_blocks || jsonb_build_object(
      'type','logistics',
      'scans',v_scans_count,'meals',v_meals_count,'lodging',v_lodging_count
    );
  END IF;

  IF jsonb_array_length(v_blocks) > 0 AND NOT p_force THEN
    RETURN jsonb_build_object(
      'ok', false,
      'blocked', true,
      'blocks', v_blocks,
      'message', 'Existem dados operacionais. Use p_force=true para apagar mesmo assim (CASCADE).'
    );
  END IF;

  -- ============ COLETA DE IDs ============
  -- participant_sport_events do evento (filtro opcional por seed_tag via match_entries não se aplica; PSE não tem seed_tag direto)
  -- Quando p_stage_id é informado, filtramos por seed_tag das próprias entidades.
  IF p_stage_id IS NULL THEN
    SELECT array_agg(pse.id) INTO v_pse_ids
    FROM participant_sport_events pse
    JOIN participants p ON p.id = pse.participant_id
    WHERE p.event_id = p_event_id;

    SELECT array_agg(id) INTO v_part_ids FROM participants WHERE event_id = p_event_id;
    SELECT array_agg(id) INTO v_deleg_ids FROM delegations WHERE event_id = p_event_id;
    SELECT array_agg(id) INTO v_se_ids FROM sport_events WHERE event_id = p_event_id;
    SELECT array_agg(id) INTO v_cat_ids FROM categories WHERE event_id = p_event_id;
  ELSE
    -- Filtro por etapa: apaga apenas o que tem seed_tag desta etapa
    SELECT array_agg(pse.id) INTO v_pse_ids
    FROM participant_sport_events pse
    JOIN participants p ON p.id = pse.participant_id
    WHERE p.event_id = p_event_id AND p.seed_tag = v_seed_tag_filter;

    SELECT array_agg(id) INTO v_part_ids
    FROM participants WHERE event_id = p_event_id AND seed_tag = v_seed_tag_filter;

    SELECT array_agg(id) INTO v_deleg_ids
    FROM delegations WHERE event_id = p_event_id AND seed_tag = v_seed_tag_filter;

    -- sport_events e categories: só apaga se foram criados nesta etapa (seed_tag)
    SELECT array_agg(id) INTO v_se_ids
    FROM sport_events WHERE event_id = p_event_id AND seed_tag = v_seed_tag_filter;
    SELECT array_agg(id) INTO v_cat_ids
    FROM categories WHERE event_id = p_event_id AND seed_tag = v_seed_tag_filter;
  END IF;

  -- ============ DELEÇÕES (ordem importa por FKs) ============

  -- Se force=true, limpar dependências operacionais primeiro
  IF p_force THEN
    DELETE FROM credential_scans WHERE event_id = p_event_id;
    DELETE FROM participant_credentials WHERE event_id = p_event_id;
    DELETE FROM external_credentials WHERE event_id = p_event_id;

    -- Competição (cascata top-down)
    DELETE FROM competition_match_results WHERE match_id IN (
      SELECT id FROM competition_matches WHERE event_id = p_event_id
    );
    DELETE FROM competition_match_entries WHERE match_id IN (
      SELECT id FROM competition_matches WHERE event_id = p_event_id
    );
    DELETE FROM competition_matches WHERE event_id = p_event_id;
    DELETE FROM competition_groups WHERE event_id = p_event_id;
    DELETE FROM competition_phases WHERE event_id = p_event_id;
    DELETE FROM team_members WHERE team_id IN (
      SELECT id FROM teams WHERE event_id = p_event_id
    );
    DELETE FROM teams WHERE event_id = p_event_id;

    -- Logística vinculada a participantes do evento
    DELETE FROM meal_consumptions
    WHERE participant_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
    DELETE FROM lodging_occupancies
    WHERE participant_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
    DELETE FROM transport_passengers
    WHERE participant_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
  END IF;

  -- Inscrições
  IF v_pse_ids IS NOT NULL THEN
    DELETE FROM participant_sport_events WHERE id = ANY(v_pse_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('participant_sport_events', v_n);
  END IF;

  -- Participantes
  IF v_part_ids IS NOT NULL THEN
    -- Coletar person_ids antes de apagar
    SELECT array_agg(DISTINCT person_id) INTO v_person_ids
    FROM participants WHERE id = ANY(v_part_ids);

    DELETE FROM participants WHERE id = ANY(v_part_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('participants', v_n);
  END IF;

  -- Delegações
  IF v_deleg_ids IS NOT NULL THEN
    -- Coletar institutions antes
    SELECT array_agg(DISTINCT institution_id) INTO v_inst_ids
    FROM delegations WHERE id = ANY(v_deleg_ids);

    DELETE FROM delegations WHERE id = ANY(v_deleg_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('delegations', v_n);
  END IF;

  -- Sport events
  IF v_se_ids IS NOT NULL THEN
    DELETE FROM sport_event_rules WHERE sport_event_id = ANY(v_se_ids);
    DELETE FROM sport_events WHERE id = ANY(v_se_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('sport_events', v_n);
  END IF;

  -- Categories
  IF v_cat_ids IS NOT NULL THEN
    DELETE FROM categories WHERE id = ANY(v_cat_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('categories', v_n);
  END IF;

  -- Sports do evento (somente se reset total)
  IF p_stage_id IS NULL THEN
    DELETE FROM sports WHERE event_id = p_event_id
      AND NOT EXISTS (SELECT 1 FROM sport_events se WHERE se.sport_id = sports.id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('sports', v_n);
  END IF;

  -- Institutions órfãs (sem nenhuma delegação restante)
  IF v_inst_ids IS NOT NULL THEN
    DELETE FROM institutions
    WHERE id = ANY(v_inst_ids)
      AND NOT EXISTS (SELECT 1 FROM delegations d WHERE d.institution_id = institutions.id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('institutions_orphan', v_n);
  END IF;

  -- People órfãs (sem nenhum participante em nenhum evento)
  IF v_person_ids IS NOT NULL THEN
    DELETE FROM people
    WHERE id = ANY(v_person_ids)
      AND NOT EXISTS (SELECT 1 FROM participants p WHERE p.person_id = people.id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('people_orphan', v_n);
  END IF;

  -- Logs e pendências de importação
  IF p_stage_id IS NULL THEN
    DELETE FROM import_row_errors WHERE import_log_id IN (
      SELECT id FROM import_logs WHERE event_id = p_event_id
    );
    DELETE FROM import_logs WHERE event_id = p_event_id;
    DELETE FROM import_pendencias WHERE event_id = p_event_id;
  ELSE
    DELETE FROM import_row_errors WHERE import_log_id IN (
      SELECT id FROM import_logs WHERE event_id = p_event_id AND stage_id = p_stage_id
    );
    DELETE FROM import_logs WHERE event_id = p_event_id AND stage_id = p_stage_id;
    DELETE FROM import_pendencias WHERE event_id = p_event_id AND stage_id = p_stage_id;
  END IF;

  -- Auditoria
  INSERT INTO audit_events (action, table_name, record_id, created_by, payload)
  VALUES (
    'RESET_IMPORT',
    'events',
    p_event_id,
    v_uid,
    jsonb_build_object(
      'event_id', p_event_id,
      'stage_id', p_stage_id,
      'force', p_force,
      'blocks_overridden', v_blocks,
      'deleted', v_deleted
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'event_id', p_event_id,
    'stage_id', p_stage_id,
    'force', p_force,
    'deleted', v_deleted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_reset_import_data(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_reset_import_data(uuid, uuid, boolean) TO authenticated;