-- Extend rpc_launch_match_result for ranking family
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
  v_entry_data jsonb;
  v_results_count int := 0;
  v_family text := p_payload->>'family';
BEGIN
  SELECT cm.*, cp.phase_type, se.sport_id, s.match_config
  INTO v_match
  FROM competition_matches cm
  JOIN competition_phases cp ON cp.id = cm.phase_id
  JOIN sport_events se ON se.id = cp.sport_event_id
  JOIN sports s ON s.id = se.sport_id
  WHERE cm.id = p_match_id AND cm.event_id = p_event_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Partida não encontrada' USING ERRCODE = 'P0001'; END IF;

  -- KO Validation
  IF v_match.phase_type = 'knockout' THEN
     IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_payload->'entries') as e WHERE e->>'outcome' = 'draw') THEN
        IF v_family = 'sets' THEN
           RAISE EXCEPTION 'Esta partida é de fase eliminatória e exige um vencedor. Verifique as parciais dos sets e garanta que uma equipe tenha vencido o número de sets necessário para a partida.' USING ERRCODE = 'P0001';
        ELSIF v_family = 'score' THEN
           IF NOT (p_payload ? 'penalty_shots' OR (p_payload->'entries'->0->'score_detail' ? 'shootout')) THEN
              RAISE EXCEPTION 'Esta partida é de fase eliminatória e exige um vencedor. Registre a prorrogação ou a disputa de pênaltis para definir a equipe vencedora.' USING ERRCODE = 'P0001';
           END IF;
        ELSE
           RAISE EXCEPTION 'Esta partida é de fase eliminatória e exige um vencedor.' USING ERRCODE = 'P0001';
        END IF;
     END IF;
  END IF;

  INSERT INTO match_results_history (match_id, changed_by, payload, action_type)
  VALUES (p_match_id, auth.uid(), p_payload, 'save');

  FOR v_entry_data IN SELECT * FROM jsonb_array_elements(p_payload->'entries') LOOP
    INSERT INTO competition_match_results (
      match_id, 
      match_entry_id, 
      outcome, 
      score, 
      position,
      result_status, 
      recorded_by, 
      recorded_at, 
      combat_detail, 
      updated_by, 
      updated_at
    )
    VALUES (
      p_match_id, 
      (v_entry_data->>'match_entry_id')::uuid, 
      v_entry_data->>'outcome', 
      v_entry_data->>'score', 
      (v_entry_data->>'classification')::int,
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
      position = EXCLUDED.position,
      result_status = 'resultado_lancado', 
      recorded_by = EXCLUDED.recorded_by, 
      combat_detail = COALESCE(EXCLUDED.combat_detail, competition_match_results.combat_detail), 
      updated_by = auth.uid(), 
      updated_at = now();
    
    v_results_count := v_results_count + 1;
  END LOOP;

  UPDATE competition_matches SET status = 'finished', updated_at = now() WHERE id = p_match_id;

  IF p_payload ? 'penalty_shots' THEN
    DELETE FROM match_penalty_shots WHERE match_id = p_match_id;
    INSERT INTO match_penalty_shots (match_id, match_entry_id, team_side, ordem, participant_id, convertido, created_by)
    SELECT p_match_id, (ps->>'match_entry_id')::uuid, ps->>'team_side', (ps->>'ordem')::int, (ps->>'participant_id')::uuid, (ps->>'convertido')::boolean, auth.uid()
    FROM jsonb_array_elements(p_payload->'penalty_shots') AS ps;
  END IF;

  RETURN json_build_object('ok', true, 'match_id', p_match_id, 'results_saved', v_results_count);
END;
$function$;
