-- Update rpc_launch_match_result to add knockout validation
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
  v_is_wo boolean := COALESCE((p_payload->>'is_wo')::boolean, false);
  v_wo_winner_id uuid := (p_payload->>'wo_winner_id')::uuid;
  v_rules jsonb;
  v_sport_id uuid;
  v_phase_type text;
BEGIN
  -- 1) Fetch match info
  SELECT cm.*, cp.phase_type, se.sport_id, s.match_config
  INTO v_match
  FROM competition_matches cm
  JOIN competition_phases cp ON cp.id = cm.phase_id
  JOIN sport_events se ON se.id = cp.sport_event_id
  JOIN sports s ON s.id = se.sport_id
  WHERE cm.id = p_match_id AND cm.event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada' USING ERRCODE = 'P0001';
  END IF;

  v_rules := v_match.match_config;

  -- 1.1) Validation for knockout phases
  IF v_match.phase_type = 'knockout' THEN
    -- Check if there is any 'draw' outcome or if there's no winner
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_payload->'entries') AS ent
      WHERE ent->>'outcome' = 'draw'
    ) OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_payload->'entries') AS ent
      WHERE ent->>'outcome' IN ('win', 'wo_win')
    ) THEN
      RAISE EXCEPTION 'Esta partida é de fase eliminatória e exige um vencedor. Verifique as parciais dos sets e garanta que uma equipe tenha vencido o número de sets necessário para a partida.' USING ERRCODE = 'P0002';
    END IF;
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
      match_id, match_entry_id, outcome, score, 
      result_status, recorded_by, recorded_at, combat_detail,
      updated_by, updated_at
    ) VALUES (
      p_match_id,
      v_entry.id,
      v_entry_data->>'outcome',
      v_entry_data->>'score',
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
      result_status = 'resultado_lancado',
      recorded_by = EXCLUDED.recorded_by,
      combat_detail = COALESCE(EXCLUDED.combat_detail, competition_match_results.combat_detail),
      updated_by = auth.uid(),
      updated_at = now();

    v_results_count := v_results_count + 1;
  END LOOP;

  -- 4) Update match status
  UPDATE competition_matches SET status = 'finished', updated_at = now()
  WHERE id = p_match_id;

  -- 5) Handle Penalty Shots if provided
  IF p_payload ? 'penalty_shots' THEN
    DELETE FROM match_penalty_shots WHERE match_id = p_match_id;
    INSERT INTO match_penalty_shots (
      match_id, match_entry_id, team_side, ordem, participant_id, convertido, created_by
    )
    SELECT 
      p_match_id,
      (ps->>'match_entry_id')::uuid,
      ps->>'team_side',
      (ps->>'ordem')::int,
      (ps->>'participant_id')::uuid,
      (ps->>'convertido')::boolean,
      auth.uid()
    FROM jsonb_array_elements(p_payload->'penalty_shots') AS ps;
  END IF;

  RETURN json_build_object(
    'ok', true,
    'match_id', p_match_id,
    'results_saved', v_results_count
  );
END;
$function$;
