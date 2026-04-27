
-- 1) Add round_type to competition_matches
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS round_type text;

-- 2) Update RLS policy for competition_match_results
DROP POLICY IF EXISTS "Public can read validated and published results" ON public.competition_match_results;
CREATE POLICY "Public can read published results only"
ON public.competition_match_results FOR SELECT
USING (result_status = 'publicado');

-- 3) Enhanced rpc_generate_matches_knockout
CREATE OR REPLACE FUNCTION public.rpc_generate_matches_knockout(
  p_event_id uuid,
  p_sport_event_id uuid,
  p_phase_id uuid,
  p_participants jsonb,
  p_seeding_mode text DEFAULT 'manual',
  p_force boolean DEFAULT false,
  p_with_bronze_match boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_n int;
  v_bracket_size int;
  v_rounds int;
  v_byes int;
  v_match_num int := 1;
  v_matches_created int := 0;
  v_auto_advanced int := 0;
  v_seeds jsonb[];
  v_seed_a jsonb;
  v_seed_b jsonb;
  v_match_id uuid;
  v_round int;
  v_matches_in_round int;
  v_existing_count int;
  v_phase_sport_event uuid;
  v_se_event uuid;
  v_top int;
  v_bottom int;
  v_round1_match_ids uuid[];
  v_prev_round_match_ids uuid[];
  v_curr_round_match_ids uuid[];
  v_matches_before_next int;
  v_round_matches int;
  v_k int;
  v_next_match_num int;
  v_next_side text;
  v_next_match_id uuid;
BEGIN
  -- Validate caller role
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  ) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT sport_event_id INTO v_phase_sport_event FROM competition_phases WHERE id = p_phase_id;
  IF v_phase_sport_event IS NULL OR v_phase_sport_event != p_sport_event_id THEN
    RAISE EXCEPTION 'Fase não pertence à prova informada' USING ERRCODE = 'P0001';
  END IF;

  SELECT event_id INTO v_se_event FROM sport_events WHERE id = p_sport_event_id;
  IF v_se_event IS NULL OR v_se_event != p_event_id THEN
    RAISE EXCEPTION 'Prova não pertence ao evento informado' USING ERRCODE = 'P0001';
  END IF;

  v_n := jsonb_array_length(p_participants);
  IF v_n < 2 THEN
    RAISE EXCEPTION 'Mínimo de 2 participantes para gerar chave' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM competition_matches WHERE phase_id = p_phase_id;
  IF v_existing_count > 0 AND NOT p_force THEN
    RAISE EXCEPTION 'MATCHES_ALREADY_EXIST' USING ERRCODE = 'P0001';
  END IF;

  IF p_force AND v_existing_count > 0 THEN
    DELETE FROM competition_match_entries WHERE match_id IN (SELECT id FROM competition_matches WHERE phase_id = p_phase_id);
    DELETE FROM competition_matches WHERE phase_id = p_phase_id;
  END IF;

  v_bracket_size := 2;
  WHILE v_bracket_size < v_n LOOP v_bracket_size := v_bracket_size * 2; END LOOP;
  v_rounds := (ln(v_bracket_size) / ln(2))::int;
  v_byes := v_bracket_size - v_n;

  v_seeds := ARRAY[]::jsonb[];
  FOR i IN 0..(v_bracket_size - 1) LOOP
    IF i < v_n THEN
      v_seeds := array_append(v_seeds, p_participants->i);
    ELSE
      v_seeds := array_append(v_seeds, jsonb_build_object('participant_id', null, 'seed', i + 1, 'label', 'BYE', 'participant_type', 'bye'));
    END IF;
  END LOOP;

  -- First create all matches across all rounds to have their IDs
  v_prev_round_match_ids := ARRAY[]::uuid[];
  v_match_num := 1;
  FOR v_round IN 1..v_rounds LOOP
    v_curr_round_match_ids := ARRAY[]::uuid[];
    v_matches_in_round := v_bracket_size / (2^v_round);
    
    FOR v_pair_idx IN 1..v_matches_in_round LOOP
      INSERT INTO competition_matches (event_id, phase_id, sport_event_id, round_number, match_number, status, round_type)
      VALUES (p_event_id, p_phase_id, p_sport_event_id, v_round, v_match_num, 'scheduled', 'regular')
      RETURNING id INTO v_match_id;
      
      v_curr_round_match_ids := array_append(v_curr_round_match_ids, v_match_id);
      v_match_num := v_match_num + 1;
      v_matches_created := v_matches_created + 1;
    END LOOP;
    
    IF v_round = 1 THEN v_round1_match_ids := v_curr_round_match_ids; END IF;
    v_prev_round_match_ids := v_curr_round_match_ids;
  END LOOP;

  -- Bronze match if requested
  IF p_with_bronze_match AND v_rounds >= 2 THEN
     INSERT INTO competition_matches (event_id, phase_id, sport_event_id, round_number, match_number, status, round_type)
     VALUES (p_event_id, p_phase_id, p_sport_event_id, v_rounds, v_match_num, 'scheduled', 'bronze')
     RETURNING id INTO v_match_id;
     v_match_num := v_match_num + 1;
     v_matches_created := v_matches_created + 1;
  END IF;

  -- Fill Round 1 entries and handle BYEs
  v_matches_in_round := v_bracket_size / 2;
  FOR v_pair_idx IN 0..(v_matches_in_round - 1) LOOP
    v_top := v_pair_idx;
    v_bottom := v_bracket_size - 1 - v_pair_idx;
    v_seed_a := v_seeds[v_top + 1];
    v_seed_b := v_seeds[v_bottom + 1];
    v_match_id := v_round1_match_ids[v_pair_idx + 1];

    DECLARE
      v_is_bye_a boolean := (v_seed_a->>'participant_type') = 'bye';
      v_is_bye_b boolean := (v_seed_b->>'participant_type') = 'bye';
      v_winner_seed jsonb;
    BEGIN
      IF NOT v_is_bye_a THEN
        INSERT INTO competition_match_entries (match_id, side, team_id, participant_sport_event_id, seed)
        VALUES (v_match_id, 'A', (v_seed_a->>'participant_id')::uuid, (v_seed_a->>'participant_id')::uuid, (v_seed_a->>'seed')::int);
      END IF;
      IF NOT v_is_bye_b THEN
        INSERT INTO competition_match_entries (match_id, side, team_id, participant_sport_event_id, seed)
        VALUES (v_match_id, 'B', (v_seed_b->>'participant_id')::uuid, (v_seed_b->>'participant_id')::uuid, (v_seed_b->>'seed')::int);
      END IF;

      IF v_is_bye_a OR v_is_bye_b THEN
        UPDATE competition_matches SET status = 'finished' WHERE id = v_match_id;
        v_auto_advanced := v_auto_advanced + 1;
        v_winner_seed := CASE WHEN v_is_bye_a THEN v_seed_b ELSE v_seed_a END;
        
        -- Propagate if not final
        IF v_rounds > 1 THEN
           v_k := v_pair_idx + 1;
           v_next_match_num := v_matches_in_round + ceil(v_k::float / 2)::int;
           v_next_side := CASE WHEN v_k % 2 = 1 THEN 'A' ELSE 'B' END;
           
           SELECT id INTO v_next_match_id FROM competition_matches WHERE phase_id = p_phase_id AND match_number = v_next_match_num;
           IF v_next_match_id IS NOT NULL THEN
              INSERT INTO competition_match_entries (match_id, side, team_id, participant_sport_event_id)
              VALUES (v_next_match_id, v_next_side, (v_winner_seed->>'participant_id')::uuid, (v_winner_seed->>'participant_id')::uuid)
              ON CONFLICT (match_id, side) DO UPDATE SET participant_sport_event_id = EXCLUDED.participant_sport_event_id, team_id = EXCLUDED.team_id, updated_at = now();
              
              INSERT INTO match_results_history (match_id, changed_by, payload, action_type)
              VALUES (v_match_id, auth.uid(), jsonb_build_object('action', 'bye_propagation', 'winner_id', v_winner_seed->>'participant_id', 'next_match_id', v_next_match_id), 'bye_propagation');
           END IF;
        END IF;
      END IF;
    END;
  END LOOP;

  UPDATE competition_phases SET bracket_config = jsonb_build_object(
    'format', 'knockout_single_elimination',
    'with_bronze', p_with_bronze_match,
    'generated_at', now(),
    'generated_by', auth.uid(),
    'total_participants', v_n,
    'bracket_size', v_bracket_size,
    'rounds', v_rounds,
    'byes', v_byes,
    'seeds', p_participants
  ), updated_at = now() WHERE id = p_phase_id;

  RETURN json_build_object('phase_id', p_phase_id, 'matches_created', v_matches_created, 'auto_advanced', v_auto_advanced);
END;
$$;

-- 4) Enhanced rpc_launch_match_result with KO validation
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
    INSERT INTO competition_match_results (match_id, match_entry_id, outcome, score, result_status, recorded_by, recorded_at, combat_detail, updated_by, updated_at)
    VALUES (p_match_id, (v_entry_data->>'match_entry_id')::uuid, v_entry_data->>'outcome', v_entry_data->>'score', 'resultado_lancado', auth.uid(), now(), CASE WHEN v_entry_data ? 'score_detail' THEN (v_entry_data->'score_detail') ELSE NULL END, auth.uid(), now())
    ON CONFLICT (match_entry_id) DO UPDATE SET outcome = EXCLUDED.outcome, score = EXCLUDED.score, result_status = 'resultado_lancado', recorded_by = EXCLUDED.recorded_by, combat_detail = COALESCE(EXCLUDED.combat_detail, competition_match_results.combat_detail), updated_by = auth.uid(), updated_at = now();
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

-- 5) Updated rpc_homologate_match_result with Bronze propagation
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
  v_match record;
  v_winner_entry record;
  v_loser_entry record;
  v_bracket_size int;
  v_rounds int;
  v_next_match_num int;
  v_next_side text;
  v_next_match_id uuid;
  v_bronze_match_id uuid;
  v_result_count int;
BEGIN
  IF NOT (public.has_role(v_user_id, 'coordenacao_tecnica') OR public.has_role(v_user_id, 'admin')) THEN
    RAISE EXCEPTION 'Permissão negada: apenas coordenação técnica ou admin podem homologar.' USING ERRCODE = 'P0003';
  END IF;
  IF p_password IS NULL OR length(p_password) < 1 THEN RAISE EXCEPTION 'Senha de confirmação é obrigatória.' USING ERRCODE = 'P0001'; END IF;

  SELECT cm.*, cp.bracket_config, cp.phase_type, cmr.result_status
  INTO v_match
  FROM competition_matches cm
  JOIN competition_phases cp ON cp.id = cm.phase_id
  LEFT JOIN competition_match_results cmr ON cmr.match_id = cm.id
  WHERE cm.id = p_match_id LIMIT 1;

  IF v_match.result_status IS NULL THEN RAISE EXCEPTION 'Nenhum resultado encontrado para esta partida.' USING ERRCODE = 'P0001'; END IF;
  IF v_match.result_status <> 'resultado_lancado' THEN RAISE EXCEPTION 'Apenas resultados com status "resultado_lancado" podem ser homologados.' USING ERRCODE = 'P0001'; END IF;

  UPDATE competition_match_results SET result_status = 'resultado_validado', validated_by = v_user_id, validated_at = now(), notes = COALESCE(notes, '') || CASE WHEN p_observation IS NOT NULL THEN E'\nHomologação: ' || p_observation ELSE '' END, updated_at = now(), updated_by = v_user_id WHERE match_id = p_match_id;
  GET DIAGNOSTICS v_result_count = ROW_COUNT;

  INSERT INTO match_results_history (match_id, changed_by, payload, action_type)
  VALUES (p_match_id, v_user_id, jsonb_build_object('status_before', v_match.result_status, 'status_after', 'resultado_validado', 'observation', p_observation), 'homologated');

  IF v_match.phase_type = 'knockout' AND v_match.bracket_config ? 'bracket_size' THEN
    SELECT cme.* INTO v_winner_entry FROM competition_match_entries cme JOIN competition_match_results cmr ON cmr.match_entry_id = cme.id WHERE cme.match_id = p_match_id AND (cmr.outcome = 'win' OR cmr.outcome = 'wo_win');
    SELECT cme.* INTO v_loser_entry FROM competition_match_entries cme JOIN competition_match_results cmr ON cmr.match_entry_id = cme.id WHERE cme.match_id = p_match_id AND (cmr.outcome = 'loss' OR cmr.outcome = 'wo_loss');

    IF v_winner_entry IS NOT NULL THEN
      v_bracket_size := (v_match.bracket_config->>'bracket_size')::int;
      v_rounds := (v_match.bracket_config->>'rounds')::int;
      
      IF v_match.round_number < v_rounds THEN
        -- Standard Winner Propagation
        DECLARE
          v_matches_before_next int := 0;
          v_round_matches int;
          v_k int;
        BEGIN
          FOR i IN 1..v_match.round_number LOOP v_matches_before_next := v_matches_before_next + (v_bracket_size / (2^i)); END LOOP;
          v_round_matches := v_bracket_size / (2^v_match.round_number);
          v_k := v_match.match_number - (v_matches_before_next - v_round_matches);
          v_next_match_num := v_matches_before_next + ceil(v_k::float / 2)::int;
          v_next_side := CASE WHEN v_k % 2 = 1 THEN 'A' ELSE 'B' END;

          SELECT id INTO v_next_match_id FROM competition_matches WHERE phase_id = v_match.phase_id AND match_number = v_next_match_num;
          IF v_next_match_id IS NOT NULL THEN
            INSERT INTO competition_match_entries (match_id, side, participant_sport_event_id, team_id)
            VALUES (v_next_match_id, v_next_side, v_winner_entry.participant_sport_event_id, v_winner_entry.team_id)
            ON CONFLICT (match_id, side) DO UPDATE SET participant_sport_event_id = EXCLUDED.participant_sport_event_id, team_id = EXCLUDED.team_id, updated_at = now();
            
            INSERT INTO match_results_history (match_id, changed_by, payload, action_type)
            VALUES (p_match_id, v_user_id, jsonb_build_object('action', 'propagate_winner', 'winner_id', v_winner_entry.participant_sport_event_id, 'next_match_id', v_next_match_id), 'propagation');
          END IF;
        END;

        -- Bronze Propagation (Loser of Semi-Final)
        IF v_match.round_number = v_rounds - 1 AND COALESCE((v_match.bracket_config->>'with_bronze')::boolean, true) AND v_loser_entry IS NOT NULL THEN
           SELECT id INTO v_bronze_match_id FROM competition_matches WHERE phase_id = v_match.phase_id AND round_type = 'bronze';
           IF v_bronze_match_id IS NOT NULL THEN
              v_next_side := CASE WHEN (v_match.match_number % 2) = 1 THEN 'A' ELSE 'B' END;
              INSERT INTO competition_match_entries (match_id, side, participant_sport_event_id, team_id)
              VALUES (v_bronze_match_id, v_next_side, v_loser_entry.participant_sport_event_id, v_loser_entry.team_id)
              ON CONFLICT (match_id, side) DO UPDATE SET participant_sport_event_id = EXCLUDED.participant_sport_event_id, team_id = EXCLUDED.team_id, updated_at = now();
              
              INSERT INTO match_results_history (match_id, changed_by, payload, action_type)
              VALUES (p_match_id, v_user_id, jsonb_build_object('action', 'propagate_loser_to_bronze', 'loser_id', v_loser_entry.participant_sport_event_id, 'bronze_match_id', v_bronze_match_id), 'propagation');
           END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'match_id', p_match_id, 'status', 'resultado_validado');
END;
$function$;

-- 6) Updated rpc_revert_match_result_status with propagation cleanup
CREATE OR REPLACE FUNCTION public.rpc_revert_match_result_status(
  p_match_id uuid,
  p_target_status text,
  p_reason text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_match record;
  v_bracket_size int;
  v_rounds int;
  v_next_match_num int;
  v_next_match_id uuid;
  v_bronze_match_id uuid;
BEGIN
  IF NOT public.has_role(v_user_id, 'admin') THEN RAISE EXCEPTION 'Permissão negada.' USING ERRCODE = 'P0003'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN RAISE EXCEPTION 'Justificativa obrigatória.' USING ERRCODE = 'P0001'; END IF;

  SELECT cm.*, cp.phase_type, cp.bracket_config, cmr.result_status
  INTO v_match
  FROM competition_matches cm
  JOIN competition_phases cp ON cp.id = cm.phase_id
  JOIN competition_match_results cmr ON cmr.match_id = cm.id
  WHERE cm.id = p_match_id LIMIT 1;

  IF v_match.result_status IS NULL THEN RAISE EXCEPTION 'Resultado não encontrado.' USING ERRCODE = 'P0001'; END IF;

  -- Block if next match has results
  IF v_match.phase_type = 'knockout' AND v_match.bracket_config ? 'bracket_size' THEN
     v_bracket_size := (v_match.bracket_config->>'bracket_size')::int;
     v_rounds := (v_match.bracket_config->>'rounds')::int;
     
     IF v_match.round_number < v_rounds THEN
        -- Winner next match
        DECLARE
          v_matches_before_next int := 0;
          v_round_matches int;
          v_k int;
        BEGIN
          FOR i IN 1..v_match.round_number LOOP v_matches_before_next := v_matches_before_next + (v_bracket_size / (2^i)); END LOOP;
          v_round_matches := v_bracket_size / (2^v_match.round_number);
          v_k := v_match.match_number - (v_matches_before_next - v_round_matches);
          v_next_match_num := v_matches_before_next + ceil(v_k::float / 2)::int;
          SELECT id INTO v_next_match_id FROM competition_matches WHERE phase_id = v_match.phase_id AND match_number = v_next_match_num;
          
          IF v_next_match_id IS NOT NULL AND EXISTS (SELECT 1 FROM competition_match_results WHERE match_id = v_next_match_id) THEN
             RAISE EXCEPTION 'Não é possível reverter esta homologação porque a próxima luta da chave (#%) já tem resultado registrado. Reverta primeiro a luta posterior.', v_next_match_num USING ERRCODE = 'P0001';
          END IF;
          
          -- Bronze match
          IF v_match.round_number = v_rounds - 1 AND COALESCE((v_match.bracket_config->>'with_bronze')::boolean, true) THEN
             SELECT id INTO v_bronze_match_id FROM competition_matches WHERE phase_id = v_match.phase_id AND round_type = 'bronze';
             IF v_bronze_match_id IS NOT NULL AND EXISTS (SELECT 1 FROM competition_match_results WHERE match_id = v_bronze_match_id) THEN
                RAISE EXCEPTION 'Não é possível reverter esta homologação porque a disputa de bronze já tem resultado registrado. Reverta primeiro a luta posterior.' USING ERRCODE = 'P0001';
             END IF;
          END IF;
          
          -- Cleanup propagation if reverting to launched
          IF p_target_status = 'resultado_lancado' THEN
             IF v_next_match_id IS NOT NULL THEN
                DELETE FROM competition_match_entries WHERE match_id = v_next_match_id AND (participant_sport_event_id IN (SELECT participant_sport_event_id FROM competition_match_entries WHERE match_id = p_match_id) OR team_id IN (SELECT team_id FROM competition_match_entries WHERE match_id = p_match_id));
                INSERT INTO match_results_history (match_id, changed_by, payload, action_type) VALUES (p_match_id, v_user_id, jsonb_build_object('action', 'propagation_reverted', 'next_match_id', v_next_match_id), 'propagation_reverted');
             END IF;
             IF v_bronze_match_id IS NOT NULL THEN
                DELETE FROM competition_match_entries WHERE match_id = v_bronze_match_id AND (participant_sport_event_id IN (SELECT participant_sport_event_id FROM competition_match_entries WHERE match_id = p_match_id) OR team_id IN (SELECT team_id FROM competition_match_entries WHERE match_id = p_match_id));
                INSERT INTO match_results_history (match_id, changed_by, payload, action_type) VALUES (p_match_id, v_user_id, jsonb_build_object('action', 'propagation_reverted', 'bronze_match_id', v_bronze_match_id), 'propagation_reverted');
             END IF;
          END IF;
        END;
     END IF;
  END IF;

  IF p_target_status = 'resultado_validado' AND v_match.result_status = 'publicado' THEN
    UPDATE competition_match_results SET result_status = 'resultado_validado', published_by = NULL, published_at = NULL, updated_at = now(), updated_by = v_user_id WHERE match_id = p_match_id;
  ELSIF p_target_status = 'resultado_lancado' AND v_match.result_status IN ('resultado_validado', 'publicado') THEN
    UPDATE competition_match_results SET result_status = 'resultado_lancado', published_by = NULL, published_at = NULL, validated_by = NULL, validated_at = NULL, updated_at = now(), updated_by = v_user_id WHERE match_id = p_match_id;
  ELSE
    RAISE EXCEPTION 'Reversão inválida.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO match_results_history (match_id, changed_by, payload, action_type)
  VALUES (p_match_id, v_user_id, jsonb_build_object('status_before', v_match.result_status, 'status_after', p_target_status, 'reason', p_reason), 'reverted');

  RETURN jsonb_build_object('ok', true, 'match_id', p_match_id, 'new_status', p_target_status);
END;
$function$;
