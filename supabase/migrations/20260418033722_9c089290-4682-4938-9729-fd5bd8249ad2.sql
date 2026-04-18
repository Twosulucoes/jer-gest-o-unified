CREATE OR REPLACE FUNCTION public.rpc_reset_import_data(p_event_id uuid, p_stage_id uuid DEFAULT NULL::uuid, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
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
  IF NOT (has_role(v_uid, 'admin') OR has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'Permissão negada: apenas admin pode resetar importação';
  END IF;
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'event_id obrigatório';
  END IF;

  -- Bloqueios (escopo evento; etapa filtra inscrições mas não bloqueia)
  SELECT COUNT(*) INTO v_credentials_count FROM participant_credentials pc WHERE pc.event_id = p_event_id;
  SELECT COUNT(*) INTO v_matches_count FROM competition_matches cm WHERE cm.event_id = p_event_id;
  SELECT COUNT(*) INTO v_scans_count FROM credential_scans cs WHERE cs.event_id = p_event_id;
  SELECT COUNT(*) INTO v_meals_count FROM meal_consumptions mc JOIN participants p ON p.id = mc.participant_id WHERE p.event_id = p_event_id;
  SELECT COUNT(*) INTO v_lodging_count FROM lodging_occupancies lo JOIN participants p ON p.id = lo.participant_id WHERE p.event_id = p_event_id;

  IF v_credentials_count > 0 THEN v_blocks := v_blocks || jsonb_build_object('type','credentials','count',v_credentials_count); END IF;
  IF v_matches_count > 0 THEN v_blocks := v_blocks || jsonb_build_object('type','matches','count',v_matches_count); END IF;
  IF v_scans_count > 0 OR v_meals_count > 0 OR v_lodging_count > 0 THEN
    v_blocks := v_blocks || jsonb_build_object('type','logistics','scans',v_scans_count,'meals',v_meals_count,'lodging',v_lodging_count);
  END IF;
  IF jsonb_array_length(v_blocks) > 0 AND NOT p_force THEN
    RETURN jsonb_build_object('ok', false, 'blocked', true, 'blocks', v_blocks,
      'message', 'Existem dados operacionais. Use p_force=true para apagar mesmo assim (CASCADE).');
  END IF;

  -- ============== COLETA DE IDS ==============
  IF p_stage_id IS NULL THEN
    SELECT array_agg(pse.id) INTO v_pse_ids FROM participant_sport_events pse JOIN participants p ON p.id = pse.participant_id WHERE p.event_id = p_event_id;
    SELECT array_agg(id) INTO v_part_ids FROM participants WHERE event_id = p_event_id;
    SELECT array_agg(id) INTO v_deleg_ids FROM delegations WHERE event_id = p_event_id;
    SELECT array_agg(id) INTO v_se_ids FROM sport_events WHERE event_id = p_event_id;
    SELECT array_agg(id) INTO v_cat_ids FROM categories WHERE event_id = p_event_id;
  ELSE
    -- Filtrar por etapa via event_stage_id
    SELECT array_agg(pse.id) INTO v_pse_ids
      FROM participant_sport_events pse
      JOIN participants p ON p.id = pse.participant_id
      WHERE p.event_id = p_event_id AND pse.event_stage_id = p_stage_id;

    -- Participantes vinculados à etapa (via participant_event_stages OU via PSE da etapa)
    SELECT array_agg(DISTINCT pid) INTO v_part_ids FROM (
      SELECT participant_id AS pid FROM participant_event_stages WHERE event_stage_id = p_stage_id
      UNION
      SELECT p.id FROM participants p
        JOIN participant_sport_events pse ON pse.participant_id = p.id
        WHERE p.event_id = p_event_id AND pse.event_stage_id = p_stage_id
    ) sub;

    -- Delegações: somente as cujos TODOS participantes estão na etapa serão apagadas (segurança)
    SELECT array_agg(d.id) INTO v_deleg_ids FROM delegations d
      WHERE d.event_id = p_event_id
        AND NOT EXISTS (
          SELECT 1 FROM participants p
          WHERE p.delegation_id = d.id
            AND NOT (p.id = ANY(COALESCE(v_part_ids, ARRAY[]::uuid[])))
        )
        AND EXISTS (
          SELECT 1 FROM participants p
          WHERE p.delegation_id = d.id AND p.id = ANY(COALESCE(v_part_ids, ARRAY[]::uuid[]))
        );

    -- Sport events / categories: não tocar (compartilhados entre etapas)
    v_se_ids := NULL; v_cat_ids := NULL;
  END IF;

  -- ===== CASCATA OPERACIONAL (force) =====
  IF p_force THEN
    DELETE FROM credential_scans WHERE event_id = p_event_id;
    DELETE FROM participant_credentials WHERE event_id = p_event_id;
    DELETE FROM external_credentials WHERE event_id = p_event_id;

    DELETE FROM disciplinary_sanctions WHERE case_id IN (SELECT id FROM disciplinary_cases WHERE event_id = p_event_id);
    DELETE FROM disciplinary_cases WHERE event_id = p_event_id;

    DELETE FROM match_attachments WHERE match_id IN (SELECT id FROM competition_matches WHERE event_id = p_event_id);
    DELETE FROM match_attempts WHERE match_id IN (SELECT id FROM competition_matches WHERE event_id = p_event_id);
    DELETE FROM match_discipline WHERE match_id IN (SELECT id FROM competition_matches WHERE event_id = p_event_id);
    DELETE FROM match_events WHERE match_id IN (SELECT id FROM competition_matches WHERE event_id = p_event_id);
    DELETE FROM match_lineups WHERE match_id IN (SELECT id FROM competition_matches WHERE event_id = p_event_id);
    DELETE FROM match_officials WHERE match_id IN (SELECT id FROM competition_matches WHERE event_id = p_event_id);
    DELETE FROM match_penalties WHERE match_id IN (SELECT id FROM competition_matches WHERE event_id = p_event_id);
    DELETE FROM match_player_stats WHERE match_id IN (SELECT id FROM competition_matches WHERE event_id = p_event_id);
    DELETE FROM match_scores WHERE match_id IN (SELECT id FROM competition_matches WHERE event_id = p_event_id);
    DELETE FROM match_user_assignments WHERE match_id IN (SELECT id FROM competition_matches WHERE event_id = p_event_id);
    DELETE FROM competition_match_results WHERE match_id IN (SELECT id FROM competition_matches WHERE event_id = p_event_id);
    DELETE FROM competition_match_entries WHERE match_id IN (SELECT id FROM competition_matches WHERE event_id = p_event_id);
    DELETE FROM competition_matches WHERE event_id = p_event_id;
    DELETE FROM group_draw_lots WHERE group_id IN (SELECT id FROM competition_groups WHERE event_id = p_event_id);
    DELETE FROM competition_groups WHERE event_id = p_event_id;
    DELETE FROM phase_qualification_rules WHERE phase_id IN (SELECT id FROM competition_phases WHERE event_id = p_event_id);
    DELETE FROM competition_phases WHERE event_id = p_event_id;
    DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE event_id = p_event_id);
    DELETE FROM teams WHERE event_id = p_event_id;

    DELETE FROM meal_consumptions WHERE participant_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
    DELETE FROM lodging_occupancies WHERE participant_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
    DELETE FROM transport_passengers WHERE participant_id IN (SELECT id FROM participants WHERE event_id = p_event_id);

    DELETE FROM participation_irregularities WHERE participant_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
    DELETE FROM participant_documents WHERE participant_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
    DELETE FROM participant_event_roles WHERE participant_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
    DELETE FROM participant_national_eligibility WHERE participant_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
    DELETE FROM jerpa_functional_classifications WHERE participant_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
    DELETE FROM jerpa_support_needs WHERE participant_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
    DELETE FROM state_selection_callups WHERE participant_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
    DELETE FROM lodging_supervisions WHERE responsible_participant_id IN (SELECT id FROM participants WHERE event_id = p_event_id)
                                       OR delegation_id IN (SELECT id FROM delegations WHERE event_id = p_event_id);
    DELETE FROM delegation_requests WHERE event_id = p_event_id;

    DELETE FROM alojamento.assignments WHERE delegation_id IN (SELECT id FROM delegations WHERE event_id = p_event_id)
                                          OR person_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
    DELETE FROM alojamento.stays WHERE person_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
    DELETE FROM alojamento.incidents WHERE person_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
  END IF;

  -- Inscrições
  IF v_pse_ids IS NOT NULL THEN
    DELETE FROM participant_sport_events WHERE id = ANY(v_pse_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('participant_sport_events', v_n);
  END IF;

  -- participant_event_stages (vínculo etapa)
  IF p_stage_id IS NOT NULL THEN
    DELETE FROM participant_event_stages WHERE event_stage_id = p_stage_id
      AND (v_part_ids IS NULL OR participant_id = ANY(v_part_ids));
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('participant_event_stages', v_n);
  ELSE
    DELETE FROM participant_event_stages
      WHERE participant_id IN (SELECT id FROM participants WHERE event_id = p_event_id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('participant_event_stages', v_n);
  END IF;

  -- Participantes
  IF v_part_ids IS NOT NULL THEN
    SELECT array_agg(DISTINCT person_id) INTO v_person_ids FROM participants WHERE id = ANY(v_part_ids);
    -- Quando há filtro por etapa, só apaga participantes que ficaram sem nenhum PSE restante
    IF p_stage_id IS NOT NULL THEN
      DELETE FROM participants
        WHERE id = ANY(v_part_ids)
          AND NOT EXISTS (SELECT 1 FROM participant_sport_events pse WHERE pse.participant_id = participants.id)
          AND NOT EXISTS (SELECT 1 FROM participant_event_stages pes WHERE pes.participant_id = participants.id);
    ELSE
      DELETE FROM participants WHERE id = ANY(v_part_ids);
    END IF;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('participants', v_n);
  END IF;

  -- Delegações
  IF v_deleg_ids IS NOT NULL AND array_length(v_deleg_ids,1) > 0 THEN
    SELECT array_agg(DISTINCT institution_id) INTO v_inst_ids FROM delegations WHERE id = ANY(v_deleg_ids);
    DELETE FROM user_delegations WHERE delegation_id = ANY(v_deleg_ids);
    DELETE FROM delegations WHERE id = ANY(v_deleg_ids)
      AND NOT EXISTS (SELECT 1 FROM participants p WHERE p.delegation_id = delegations.id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('delegations', v_n);
  END IF;

  -- Sport events
  IF v_se_ids IS NOT NULL THEN
    DELETE FROM sport_event_rules WHERE sport_event_id = ANY(v_se_ids);
    DELETE FROM sport_event_prova_map WHERE sport_event_id = ANY(v_se_ids);
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

  -- Sports órfãos
  IF p_stage_id IS NULL THEN
    DELETE FROM sports WHERE event_id = p_event_id
      AND NOT EXISTS (SELECT 1 FROM sport_events se WHERE se.sport_id = sports.id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('sports', v_n);
  END IF;

  -- Institutions órfãs
  IF v_inst_ids IS NOT NULL THEN
    DELETE FROM institutions WHERE id = ANY(v_inst_ids)
      AND NOT EXISTS (SELECT 1 FROM delegations d WHERE d.institution_id = institutions.id)
      AND NOT EXISTS (SELECT 1 FROM people pe WHERE pe.institution_id = institutions.id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('institutions_orphan', v_n);
  END IF;

  -- People órfãs
  IF v_person_ids IS NOT NULL THEN
    DELETE FROM people WHERE id = ANY(v_person_ids)
      AND NOT EXISTS (SELECT 1 FROM participants p WHERE p.person_id = people.id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('people_orphan', v_n);
  END IF;

  -- Logs (apenas escopo total)
  IF p_stage_id IS NULL THEN
    DELETE FROM import_row_errors WHERE import_log_id IN (SELECT id FROM import_logs WHERE event_id = p_event_id);
    DELETE FROM import_logs WHERE event_id = p_event_id;
    DELETE FROM import_pendencias WHERE event_id = p_event_id;
  ELSE
    -- Logs/pendências da etapa
    DELETE FROM import_pendencias WHERE event_id = p_event_id AND event_stage_id = p_stage_id;
  END IF;

  INSERT INTO audit_events (action, table_name, record_id, created_by, payload)
  VALUES ('RESET_IMPORT', 'events', p_event_id, v_uid,
    jsonb_build_object('event_id', p_event_id, 'stage_id', p_stage_id, 'force', p_force,
      'blocks_overridden', v_blocks, 'deleted', v_deleted));

  RETURN jsonb_build_object('ok', true, 'event_id', p_event_id, 'stage_id', p_stage_id,
    'force', p_force, 'deleted', v_deleted);
END;
$function$;