
-- Update rpc_homologate_match_result to support winner propagation in combat brackets
CREATE OR REPLACE FUNCTION public.rpc_homologate_match_result(
  p_match_id uuid,
  p_password text,
  p_observation text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_status public.match_result_status;
  v_result_count int;
  v_match record;
  v_winner_entry record;
  v_next_match_num int;
  v_next_match_id uuid;
  v_next_side text;
  v_bracket_size int;
  v_rounds int;
  v_round_matches int;
  v_matches_before_next int;
  v_k int;
BEGIN
  -- 1) Validate user profile
  IF NOT (public.has_role(v_user_id, 'coordenacao_tecnica') OR public.has_role(v_user_id, 'admin')) THEN
    RAISE EXCEPTION 'Permissão negada: apenas coordenação técnica ou admin podem homologar.' USING ERRCODE = 'P0003';
  END IF;

  -- 2) Password validation
  IF p_password IS NULL OR length(p_password) < 1 THEN
    RAISE EXCEPTION 'Senha de confirmação é obrigatória.' USING ERRCODE = 'P0001';
  END IF;

  -- 3) Fetch match and current status
  SELECT cm.*, cp.bracket_config, cp.phase_type, cmr.result_status
  INTO v_match
  FROM competition_matches cm
  JOIN competition_phases cp ON cp.id = cm.phase_id
  LEFT JOIN competition_match_results cmr ON cmr.match_id = cm.id
  WHERE cm.id = p_match_id
  LIMIT 1;

  IF v_match.result_status IS NULL THEN
    RAISE EXCEPTION 'Nenhum resultado encontrado para esta partida.' USING ERRCODE = 'P0001';
  END IF;

  IF v_match.result_status <> 'resultado_lancado' THEN
    RAISE EXCEPTION 'Apenas resultados com status "resultado_lancado" podem ser homologados. Status atual: %', v_match.result_status USING ERRCODE = 'P0001';
  END IF;

  -- 4) Update status
  UPDATE competition_match_results
  SET 
    result_status = 'resultado_validado',
    validated_by = v_user_id,
    validated_at = now(),
    notes = COALESCE(notes, '') || CASE WHEN p_observation IS NOT NULL THEN E'\nHomologação: ' || p_observation ELSE '' END,
    updated_at = now(),
    updated_by = v_user_id
  WHERE match_id = p_match_id;

  GET DIAGNOSTICS v_result_count = ROW_COUNT;

  -- 5) Log history
  INSERT INTO match_results_history (match_id, changed_by, payload, action_type)
  VALUES (
    p_match_id, 
    v_user_id, 
    jsonb_build_object(
      'status_before', v_match.result_status,
      'status_after', 'resultado_validado',
      'observation', p_observation,
      'results_updated', v_result_count
    ), 
    'homologated'
  );

  -- 6) PROPAGATION LOGIC (Combat/Knockout specific)
  IF v_match.phase_type = 'knockout' AND v_match.bracket_config ? 'bracket_size' THEN
    -- Find winner
    SELECT * INTO v_winner_entry
    FROM competition_match_entries cme
    JOIN competition_match_results cmr ON cmr.match_entry_id = cme.id
    WHERE cme.match_id = p_match_id AND (cmr.outcome = 'win' OR cmr.outcome = 'wo_win');

    IF FOUND THEN
      v_bracket_size := (v_match.bracket_config->>'bracket_size')::int;
      v_rounds := (v_match.bracket_config->>'rounds')::int;
      
      -- If not final round
      IF v_match.round_number < v_rounds THEN
        -- Calculate next match
        v_matches_before_next := 0;
        FOR i IN 1..v_match.round_number LOOP
          v_matches_before_next := v_matches_before_next + (v_bracket_size / (2^i));
        END LOOP;

        v_round_matches := v_bracket_size / (2^v_match.round_number);
        v_k := v_match.match_number - (v_matches_before_next - v_round_matches);
        
        v_next_match_num := v_matches_before_next + ceil(v_k::float / 2)::int;
        v_next_side := CASE WHEN v_k % 2 = 1 THEN 'A' ELSE 'B' END;

        -- Find next match ID
        SELECT id INTO v_next_match_id
        FROM competition_matches
        WHERE phase_id = v_match.phase_id AND match_number = v_next_match_num;

        IF v_next_match_id IS NOT NULL THEN
          -- Upsert winner into next match entry
          INSERT INTO competition_match_entries (
            match_id, side, participant_sport_event_id, team_id
          ) VALUES (
            v_next_match_id, v_next_side, v_winner_entry.participant_sport_event_id, v_winner_entry.team_id
          )
          ON CONFLICT (match_id, side) DO UPDATE SET
            participant_sport_event_id = EXCLUDED.participant_sport_event_id,
            team_id = EXCLUDED.team_id,
            updated_at = now();
            
          -- Log propagation
          INSERT INTO match_results_history (match_id, changed_by, payload, action_type)
          VALUES (
            p_match_id, 
            v_user_id, 
            jsonb_build_object(
              'action', 'propagate_winner',
              'winner_id', v_winner_entry.participant_sport_event_id,
              'next_match_id', v_next_match_id,
              'next_side', v_next_side
            ), 
            'propagation'
          );
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'match_id', p_match_id,
    'status', 'resultado_validado',
    'results_updated', v_result_count
  );
END;
$function$;
