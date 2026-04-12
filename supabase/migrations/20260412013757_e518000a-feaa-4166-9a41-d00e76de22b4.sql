
-- A1) Add bracket_config to competition_phases
ALTER TABLE public.competition_phases
  ADD COLUMN IF NOT EXISTS bracket_config jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_competition_phases_bracket_config
  ON public.competition_phases USING gin (bracket_config);

-- Add round_number to competition_matches
ALTER TABLE public.competition_matches
  ADD COLUMN IF NOT EXISTS round_number int;

-- A3) RPC: rpc_generate_matches_knockout
CREATE OR REPLACE FUNCTION public.rpc_generate_matches_knockout(
  p_event_id uuid,
  p_sport_event_id uuid,
  p_phase_id uuid,
  p_participants jsonb,
  p_seeding_mode text DEFAULT 'manual',
  p_force boolean DEFAULT false
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
  v_entry_id_a uuid;
  v_pair_idx int;
  v_round int;
  v_matches_in_round int;
  v_existing_count int;
  v_phase_sport_event uuid;
  v_se_event uuid;
  -- For round 1 pairs using standard bracket seeding
  v_top int;
  v_bottom int;
  v_round1_match_ids uuid[];
  v_prev_round_match_ids uuid[];
  v_curr_round_match_ids uuid[];
BEGIN
  -- Validate caller role
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  ) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  -- Validate phase belongs to sport_event
  SELECT sport_event_id INTO v_phase_sport_event
  FROM competition_phases WHERE id = p_phase_id;
  IF v_phase_sport_event IS NULL OR v_phase_sport_event != p_sport_event_id THEN
    RAISE EXCEPTION 'Fase não pertence à prova informada' USING ERRCODE = 'P0001';
  END IF;

  -- Validate sport_event belongs to event
  SELECT event_id INTO v_se_event FROM sport_events WHERE id = p_sport_event_id;
  IF v_se_event IS NULL OR v_se_event != p_event_id THEN
    RAISE EXCEPTION 'Prova não pertence ao evento informado' USING ERRCODE = 'P0001';
  END IF;

  -- Count participants
  v_n := jsonb_array_length(p_participants);
  IF v_n < 2 THEN
    RAISE EXCEPTION 'Mínimo de 2 participantes para gerar chave' USING ERRCODE = 'P0001';
  END IF;

  -- Check existing matches
  SELECT COUNT(*) INTO v_existing_count
  FROM competition_matches WHERE phase_id = p_phase_id AND event_id = p_event_id;

  IF v_existing_count > 0 AND NOT p_force THEN
    RAISE EXCEPTION 'MATCHES_ALREADY_EXIST' USING ERRCODE = 'P0001';
  END IF;

  -- If force, delete existing scheduled matches for this phase
  IF p_force AND v_existing_count > 0 THEN
    DELETE FROM competition_match_entries
    WHERE match_id IN (SELECT id FROM competition_matches WHERE phase_id = p_phase_id AND event_id = p_event_id AND status IN ('scheduled','finished'));
    DELETE FROM competition_matches WHERE phase_id = p_phase_id AND event_id = p_event_id AND status IN ('scheduled','finished');
  END IF;

  -- Calculate bracket size (next power of 2)
  v_bracket_size := 2;
  WHILE v_bracket_size < v_n LOOP
    v_bracket_size := v_bracket_size * 2;
  END LOOP;

  v_rounds := (ln(v_bracket_size) / ln(2))::int;
  v_byes := v_bracket_size - v_n;

  -- Build seeds array padded to bracket_size
  -- p_participants is ordered by seed
  v_seeds := ARRAY[]::jsonb[];
  FOR i IN 0..(v_bracket_size - 1) LOOP
    IF i < v_n THEN
      v_seeds := array_append(v_seeds, p_participants->i);
    ELSE
      v_seeds := array_append(v_seeds, jsonb_build_object('participant_id', null, 'seed', i + 1, 'label', 'BYE', 'participant_type', 'bye'));
    END IF;
  END LOOP;

  -- Generate Round 1 matches using standard bracket seeding
  v_round1_match_ids := ARRAY[]::uuid[];
  v_matches_in_round := v_bracket_size / 2;

  FOR v_pair_idx IN 0..(v_matches_in_round - 1) LOOP
    -- Standard bracket pairing: 1vN, N/2+1 vs N/2, etc.
    -- Simple approach: pair seed (pair_idx*2+1) vs seed (pair_idx*2+2) after proper ordering
    -- Use folded bracket: top = pair_idx, bottom = bracket_size - 1 - pair_idx
    v_top := v_pair_idx;
    v_bottom := v_bracket_size - 1 - v_pair_idx;

    -- But for proper bracket seeding we use a simpler sequential approach
    -- Pair 0: seed 1 vs seed bracket_size
    -- Pair 1: seed bracket_size/2+1 vs seed bracket_size/2
    -- ... This is complex; use simple sequential pairing for now
    v_seed_a := v_seeds[v_top + 1]; -- 1-indexed array
    v_seed_b := v_seeds[v_bottom + 1];

    DECLARE
      v_is_bye_a boolean := (v_seed_a->>'participant_type') = 'bye';
      v_is_bye_b boolean := (v_seed_b->>'participant_type') = 'bye';
      v_status text;
      v_team_id_a uuid;
      v_team_id_b uuid;
      v_pse_id_a uuid;
      v_pse_id_b uuid;
      v_side_a text;
      v_side_b text;
    BEGIN
      IF v_is_bye_a OR v_is_bye_b THEN
        v_status := 'finished'; -- auto-advance
      ELSE
        v_status := 'scheduled';
      END IF;

      INSERT INTO competition_matches (event_id, phase_id, sport_event_id, round_number, match_number, status, group_id)
      VALUES (p_event_id, p_phase_id, p_sport_event_id, 1, v_match_num, v_status, null)
      RETURNING id INTO v_match_id;

      v_round1_match_ids := array_append(v_round1_match_ids, v_match_id);
      v_match_num := v_match_num + 1;
      v_matches_created := v_matches_created + 1;

      -- Determine sides and IDs based on participant_type
      IF NOT v_is_bye_a THEN
        IF (v_seed_a->>'participant_type') = 'team' THEN
          v_team_id_a := (v_seed_a->>'participant_id')::uuid;
          v_side_a := 'home';
        ELSE
          v_pse_id_a := (v_seed_a->>'participant_id')::uuid;
          v_side_a := 'home';
        END IF;

        INSERT INTO competition_match_entries (match_id, side, team_id, participant_sport_event_id, seed)
        VALUES (v_match_id, v_side_a, v_team_id_a, v_pse_id_a, (v_seed_a->>'seed')::int);
      END IF;

      IF NOT v_is_bye_b THEN
        IF (v_seed_b->>'participant_type') = 'team' THEN
          v_team_id_b := (v_seed_b->>'participant_id')::uuid;
          v_side_b := 'away';
        ELSE
          v_pse_id_b := (v_seed_b->>'participant_id')::uuid;
          v_side_b := 'away';
        END IF;

        INSERT INTO competition_match_entries (match_id, side, team_id, participant_sport_event_id, seed)
        VALUES (v_match_id, v_side_b, v_team_id_b, v_pse_id_b, (v_seed_b->>'seed')::int);
      END IF;

      -- Auto-advance for BYE matches
      IF v_is_bye_a OR v_is_bye_b THEN
        v_auto_advanced := v_auto_advanced + 1;
      END IF;
    END;
  END LOOP;

  -- Generate placeholder matches for subsequent rounds
  v_prev_round_match_ids := v_round1_match_ids;
  FOR v_round IN 2..v_rounds LOOP
    v_curr_round_match_ids := ARRAY[]::uuid[];
    v_matches_in_round := array_length(v_prev_round_match_ids, 1) / 2;

    FOR v_pair_idx IN 0..(v_matches_in_round - 1) LOOP
      INSERT INTO competition_matches (event_id, phase_id, sport_event_id, round_number, match_number, status, group_id)
      VALUES (p_event_id, p_phase_id, p_sport_event_id, v_round, v_match_num, 'scheduled', null)
      RETURNING id INTO v_match_id;

      v_curr_round_match_ids := array_append(v_curr_round_match_ids, v_match_id);
      v_match_num := v_match_num + 1;
      v_matches_created := v_matches_created + 1;
    END LOOP;

    v_prev_round_match_ids := v_curr_round_match_ids;
  END LOOP;

  -- Update bracket_config
  UPDATE competition_phases SET bracket_config = jsonb_build_object(
    'format', 'knockout_single_elimination',
    'participants_source', CASE WHEN (p_participants->0->>'participant_type') = 'team' THEN 'teams' ELSE 'individuals' END,
    'seeding_mode', p_seeding_mode,
    'generated_at', now(),
    'generated_by', auth.uid(),
    'total_participants', v_n,
    'bracket_size', v_bracket_size,
    'rounds', v_rounds,
    'byes', v_byes,
    'seeds', p_participants
  ), updated_at = now()
  WHERE id = p_phase_id;

  RETURN json_build_object(
    'phase_id', p_phase_id,
    'sport_event_id', p_sport_event_id,
    'total_participants', v_n,
    'bracket_size', v_bracket_size,
    'rounds', v_rounds,
    'byes', v_byes,
    'matches_created', v_matches_created,
    'auto_advanced', v_auto_advanced
  );
END;
$$;

-- A5) RPC: rpc_get_knockout_bracket
CREATE OR REPLACE FUNCTION public.rpc_get_knockout_bracket(p_phase_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result json;
  v_bracket_config jsonb;
BEGIN
  -- Validate caller
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica') OR
    public.has_role(auth.uid(), 'secretaria')
  ) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT bracket_config INTO v_bracket_config FROM competition_phases WHERE id = p_phase_id;

  SELECT json_build_object(
    'phase_id', p_phase_id,
    'bracket_config', v_bracket_config,
    'rounds', (
      SELECT json_agg(round_data ORDER BY round_num)
      FROM (
        SELECT
          cm.round_number AS round_num,
          json_agg(
            json_build_object(
              'match_id', cm.id,
              'match_number', cm.match_number,
              'round_number', cm.round_number,
              'status', cm.status,
              'match_date', cm.match_date,
              'start_time', cm.start_time,
              'venue_id', cm.venue_id,
              'venue_name', v.name,
              'entries', (
                SELECT json_agg(json_build_object(
                  'entry_id', cme.id,
                  'side', cme.side,
                  'seed', cme.seed,
                  'team_id', cme.team_id,
                  'team_name', t.name,
                  'participant_sport_event_id', cme.participant_sport_event_id,
                  'participant_name', ppl.full_name
                ) ORDER BY cme.side)
                FROM competition_match_entries cme
                LEFT JOIN teams t ON t.id = cme.team_id
                LEFT JOIN participant_sport_events pse ON pse.id = cme.participant_sport_event_id
                LEFT JOIN participants part ON part.id = pse.participant_id
                LEFT JOIN people ppl ON ppl.id = part.person_id
                WHERE cme.match_id = cm.id
              )
            ) ORDER BY cm.match_number
          ) AS matches
        FROM competition_matches cm
        LEFT JOIN venues v ON v.id = cm.venue_id
        WHERE cm.phase_id = p_phase_id AND cm.round_number IS NOT NULL
        GROUP BY cm.round_number
      ) sub(round_num, matches)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
