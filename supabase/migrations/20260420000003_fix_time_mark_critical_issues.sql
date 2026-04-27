
-- Correction 1 & 6: Enhanced rpc_launch_match_result with validation and attempts persistence
CREATE OR REPLACE FUNCTION public.rpc_launch_match_result(
  p_event_id uuid,
  p_match_id uuid,
  p_payload jsonb
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match record;
  v_entry record;
  v_entry_data jsonb;
  v_results_count int := 0;
  v_rules jsonb;
  v_family text;
  v_format text;
BEGIN
  -- 1) Fetch match info and rules
  SELECT 
    cm.*, 
    cp.phase_type, 
    se.sport_id, 
    ser.rules as event_rules
  INTO v_match
  FROM competition_matches cm
  JOIN competition_phases cp ON cp.id = cm.phase_id
  JOIN sport_events se ON se.id = cp.sport_event_id
  LEFT JOIN sport_event_rules ser ON ser.sport_event_id = se.id
  WHERE cm.id = p_match_id AND cm.event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada' USING ERRCODE = 'P0001';
  END IF;

  v_rules := v_match.event_rules;
  v_family := v_rules->>'family';
  v_format := v_rules->>'format';

  -- Correction 6: Payload Validation
  IF NOT p_payload ? 'entries' THEN
    RAISE EXCEPTION 'Payload inválido: campo "entries" obrigatório' USING ERRCODE = 'P0003';
  END IF;

  -- Modo B Specific Validation
  IF v_family = 'mark' AND NOT p_payload ? 'attempts' THEN
     RAISE EXCEPTION 'Payload do Modo B está sem o campo attempts' USING ERRCODE = 'P0004';
  END IF;

  -- 2) Log history
  INSERT INTO match_results_history (match_id, changed_by, payload, action_type)
  VALUES (p_match_id, auth.uid(), p_payload, 'save');

  -- 3) Process each entry in payload
  FOR v_entry_data IN SELECT * FROM jsonb_array_elements(p_payload->'entries')
  LOOP
    SELECT * INTO v_entry FROM competition_match_entries
    WHERE id = (v_entry_data->>'match_entry_id')::uuid AND match_id = p_match_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    INSERT INTO competition_match_results (
      match_id, 
      match_entry_id, 
      outcome, 
      score, 
      time_ms,
      distance_cm,
      position,
      result_status, 
      recorded_by, 
      recorded_at, 
      combat_detail,
      updated_by, 
      updated_at
    ) VALUES (
      p_match_id,
      v_entry.id,
      v_entry_data->>'outcome',
      v_entry_data->>'score',
      (v_entry_data->>'time_ms')::bigint,
      (v_entry_data->>'distance_cm')::numeric,
      COALESCE((v_entry_data->>'position')::int, (v_entry_data->'score_detail'->>'rank')::int),
      'resultado_lancado',
      auth.uid(),
      now(),
      CASE WHEN v_entry_data ? 'score_detail' THEN (v_entry_data->'score_detail') ELSE NULL END,
      auth.uid(),
      now()
    )
    ON CONFLICT (match_entry_id) DO UPDATE SET
      outcome = EXCLUDED.outcome,
      score = EXCLUDED.score,
      time_ms = EXCLUDED.time_ms,
      distance_cm = EXCLUDED.distance_cm,
      position = EXCLUDED.position,
      result_status = 'resultado_lancado',
      recorded_by = EXCLUDED.recorded_by,
      combat_detail = COALESCE(EXCLUDED.combat_detail, competition_match_results.combat_detail),
      updated_by = auth.uid(),
      updated_at = now();

    v_results_count := v_results_count + 1;
  END LOOP;

  -- Correction 1: Persist attempts for Modo B
  IF v_family = 'mark' AND p_payload ? 'attempts' THEN
    DELETE FROM match_attempts WHERE match_id = p_match_id;
    
    INSERT INTO match_attempts (
      match_id, 
      match_entry_id, 
      participant_id, 
      attempt_number, 
      value_cm, 
      is_valid,
      notes
    )
    SELECT 
      p_match_id,
      (att->>'match_entry_id')::uuid,
      (att->>'participant_id')::uuid,
      (att->>'attempt_number')::int,
      (att->>'value_cm')::numeric,
      COALESCE((att->>'is_valid')::boolean, true),
      att->>'notes'
    FROM jsonb_array_elements(p_payload->'attempts') AS att;
  END IF;

  UPDATE competition_matches SET status = 'finished', updated_at = now()
  WHERE id = p_match_id;

  RETURN json_build_object(
    'ok', true,
    'match_id', p_match_id,
    'results_saved', v_results_count
  );
END;
$function$;

-- Correction 2: RPC for Propagation
CREATE OR REPLACE FUNCTION public.rpc_propagate_classification_time_mark(
  p_sport_event_id uuid,
  p_from_phase_id uuid,
  p_to_phase_id uuid,
  p_classified_entries jsonb
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_exists_previous boolean;
  v_action_type text := 'classification_propagated';
  v_group_ids uuid[];
  v_num_groups int;
  v_index int := 0;
  v_reverse boolean := false;
  v_entry_data jsonb;
  v_allocated_count int := 0;
  v_match_id uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM competition_match_entries cme
    JOIN competition_matches cm ON cm.id = cme.match_id
    WHERE cm.phase_id = p_to_phase_id
  ) INTO v_exists_previous;

  IF v_exists_previous THEN
    v_action_type := 'classification_repropagated';
    DELETE FROM competition_match_entries 
    WHERE match_id IN (SELECT id FROM competition_matches WHERE phase_id = p_to_phase_id);
  END IF;

  SELECT array_agg(id ORDER BY sort_order) INTO v_group_ids FROM competition_groups WHERE phase_id = p_to_phase_id;
  v_num_groups := array_length(v_group_ids, 1);
  IF v_num_groups IS NULL OR v_num_groups = 0 THEN RAISE EXCEPTION 'Fase de destino sem grupos.'; END IF;

  FOR v_entry_data IN SELECT * FROM jsonb_array_elements(p_classified_entries)
  LOOP
    SELECT id INTO v_match_id FROM competition_matches WHERE group_id = v_group_ids[v_index + 1] LIMIT 1;
    
    INSERT INTO competition_match_entries (match_id, participant_sport_event_id, side)
    VALUES (v_match_id, (v_entry_data->>'participant_sport_event_id')::uuid, (v_allocated_count / v_num_groups + 1)::text);

    v_allocated_count := v_allocated_count + 1;
    
    IF NOT v_reverse THEN
      IF v_index < v_num_groups - 1 THEN v_index := v_index + 1; ELSE v_reverse := true; END IF;
    ELSE
      IF v_index > 0 THEN v_index := v_index - 1; ELSE v_reverse := false; END IF;
    END IF;
  END LOOP;

  INSERT INTO match_results_history (changed_by, payload, action_type)
  VALUES (auth.uid(), p_classified_entries, v_action_type);

  RETURN json_build_object('ok', true, 'allocated_count', v_allocated_count, 'action', v_action_type);
END;
$function$;
