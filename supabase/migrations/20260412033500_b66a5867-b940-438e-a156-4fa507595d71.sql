
-- ============================================================
-- 1) Add seed_tag + seed_batch_id columns to target tables
-- ============================================================
DO $$
DECLARE
  _tables text[] := ARRAY[
    'teams','competition_phases','competition_groups','competition_matches',
    'competition_match_entries','competition_match_results','match_scores',
    'venues','institutions','delegations','people','participants',
    'participant_sport_events','transport_vehicles','transport_routes',
    'transport_trips','lodging_locations','lodging_units','meal_types','meal_windows'
  ];
  _t text;
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=_t AND column_name='seed_tag') THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN seed_tag text NULL', _t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=_t AND column_name='seed_batch_id') THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN seed_batch_id uuid NULL', _t);
    END IF;
  END LOOP;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teams_seed_tag ON public.teams(seed_tag) WHERE seed_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_competition_phases_seed_tag ON public.competition_phases(seed_tag) WHERE seed_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_competition_groups_seed_tag ON public.competition_groups(seed_tag) WHERE seed_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_competition_matches_seed_tag ON public.competition_matches(seed_tag) WHERE seed_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_competition_match_entries_seed_tag ON public.competition_match_entries(seed_tag) WHERE seed_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_competition_match_results_seed_tag ON public.competition_match_results(seed_tag) WHERE seed_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_match_scores_seed_tag ON public.match_scores(seed_tag) WHERE seed_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_venues_seed_tag ON public.venues(seed_tag) WHERE seed_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_institutions_seed_tag ON public.institutions(seed_tag) WHERE seed_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_delegations_seed_tag ON public.delegations(seed_tag) WHERE seed_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_seed_tag ON public.people(seed_tag) WHERE seed_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_participants_seed_tag ON public.participants(seed_tag) WHERE seed_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_participant_sport_events_seed_tag ON public.participant_sport_events(seed_tag) WHERE seed_tag IS NOT NULL;

-- ============================================================
-- 2) reset_demo RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_demo(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _counts jsonb := '{}'::jsonb;
  _c bigint;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenacao_tecnica')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  DELETE FROM match_scores WHERE seed_tag='demo' AND match_id IN (SELECT id FROM competition_matches WHERE event_id=p_event_id AND seed_tag='demo');
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('match_scores', _c);

  DELETE FROM competition_match_results WHERE seed_tag='demo' AND match_id IN (SELECT id FROM competition_matches WHERE event_id=p_event_id AND seed_tag='demo');
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('competition_match_results', _c);

  DELETE FROM competition_match_entries WHERE seed_tag='demo' AND match_id IN (SELECT id FROM competition_matches WHERE event_id=p_event_id AND seed_tag='demo');
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('competition_match_entries', _c);

  DELETE FROM competition_matches WHERE event_id=p_event_id AND seed_tag='demo';
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('competition_matches', _c);

  DELETE FROM competition_groups WHERE event_id=p_event_id AND seed_tag='demo';
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('competition_groups', _c);

  DELETE FROM competition_phases WHERE event_id=p_event_id AND seed_tag='demo';
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('competition_phases', _c);

  DELETE FROM participant_sport_events WHERE seed_tag='demo' AND participant_id IN (SELECT id FROM participants WHERE event_id=p_event_id AND seed_tag='demo');
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('participant_sport_events', _c);

  DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE event_id=p_event_id AND seed_tag='demo');
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('team_members', _c);

  DELETE FROM teams WHERE event_id=p_event_id AND seed_tag='demo';
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('teams', _c);

  DELETE FROM participants WHERE event_id=p_event_id AND seed_tag='demo';
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('participants', _c);

  DELETE FROM people WHERE seed_tag='demo' AND institution_id IN (SELECT id FROM institutions WHERE seed_tag='demo');
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('people', _c);

  DELETE FROM delegations WHERE event_id=p_event_id AND seed_tag='demo';
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('delegations', _c);

  DELETE FROM institutions WHERE seed_tag='demo' AND NOT EXISTS (SELECT 1 FROM delegations d WHERE d.institution_id = institutions.id AND d.seed_tag IS DISTINCT FROM 'demo');
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('institutions', _c);

  DELETE FROM venues WHERE event_id=p_event_id AND seed_tag='demo';
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('venues', _c);

  DELETE FROM transport_trips WHERE event_id=p_event_id AND seed_tag='demo';
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('transport_trips', _c);
  DELETE FROM transport_routes WHERE event_id=p_event_id AND seed_tag='demo';
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('transport_routes', _c);
  DELETE FROM transport_vehicles WHERE event_id=p_event_id AND seed_tag='demo';
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('transport_vehicles', _c);
  DELETE FROM lodging_units WHERE event_id=p_event_id AND seed_tag='demo';
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('lodging_units', _c);
  DELETE FROM lodging_locations WHERE event_id=p_event_id AND seed_tag='demo';
  GET DIAGNOSTICS _c = ROW_COUNT; _counts := _counts || jsonb_build_object('lodging_locations', _c);

  RETURN jsonb_build_object('event_id', p_event_id, 'deleted', _counts);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_demo FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_demo TO authenticated;

-- ============================================================
-- 3) seed_event_demo RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_event_demo(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _batch_id uuid := gen_random_uuid();
  _caller uuid := auth.uid();
  _notes text[] := ARRAY[]::text[];
  _demo_se_ids uuid[] := ARRAY[]::uuid[];
  _inst_ids uuid[] := ARRAY[]::uuid[];
  _del_ids uuid[] := ARRAY[]::uuid[];
  _venue_ids uuid[] := ARRAY[]::uuid[];
  _team_ids uuid[] := ARRAY[]::uuid[];
  _tmp_id uuid;
  _phase_id uuid;
  _group_a_id uuid;
  _group_b_id uuid;
  _match_id uuid;
  _entry_a_id uuid;
  _entry_b_id uuid;
  _i int;
  _j int;
  _grp int;
  _match_num int := 0;
  _score_home int;
  _score_away int;
  _outcome_home text;
  _outcome_away text;
  _is_wo boolean;
  _family text;
  _wo_policy text;
  _se_id uuid;
  _se_name text;
  _se_sport_id uuid;
  _se_is_collective boolean;
  -- counters
  _inst_count int := 0;
  _del_count int := 0;
  _people_count int := 0;
  _part_count int := 0;
  _team_count int := 0;
  _phase_count int := 0;
  _group_count int := 0;
  _match_count int := 0;
  _entry_count int := 0;
  _score_count int := 0;
  _venue_count int := 0;
  _cur CURSOR FOR
    SELECT se.id, se.name, se.sport_id,
           COALESCE(ser.rules->>'family', 'score') as family,
           COALESCE(ser.rules->'scoring'->>'walkover_policy', '3x0') as wo_policy,
           s.is_collective
    FROM sport_events se
    JOIN sports s ON s.id = se.sport_id
    LEFT JOIN sport_event_rules ser ON ser.sport_event_id = se.id AND ser.is_active = true
    WHERE se.event_id = p_event_id AND se.is_active = true
    ORDER BY
      CASE COALESCE(ser.rules->>'family', 'score')
        WHEN 'score' THEN 1 WHEN 'sets' THEN 2 WHEN 'time' THEN 3 WHEN 'combat' THEN 4 ELSE 5
      END, se.name
    LIMIT 4;
  _cur_count int := 0;
BEGIN
  IF NOT (has_role(_caller, 'admin') OR has_role(_caller, 'coordenacao_tecnica')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;

  -- Idempotent: reset first
  PERFORM reset_demo(p_event_id);

  -- A) Institutions (8)
  FOR _i IN 1..8 LOOP
    INSERT INTO institutions (name, slug, seed_tag, seed_batch_id)
    VALUES ('Escola Demo ' || _i, 'escola-demo-' || _i || '-' || substr(_batch_id::text,1,8), 'demo', _batch_id)
    RETURNING id INTO _tmp_id;
    _inst_ids := array_append(_inst_ids, _tmp_id);
    _inst_count := _inst_count + 1;
  END LOOP;

  -- B) Delegations (8)
  FOR _i IN 1..8 LOOP
    INSERT INTO delegations (event_id, institution_id, status, chief_name, seed_tag, seed_batch_id)
    VALUES (p_event_id, _inst_ids[_i], 'active', 'Chefe Demo ' || _i, 'demo', _batch_id)
    RETURNING id INTO _tmp_id;
    _del_ids := array_append(_del_ids, _tmp_id);
    _del_count := _del_count + 1;
  END LOOP;

  -- C) Venues (3)
  FOR _i IN 1..3 LOOP
    INSERT INTO venues (event_id, name, venue_type, seed_tag, seed_batch_id)
    VALUES (p_event_id,
      CASE _i WHEN 1 THEN 'Ginásio Demo A' WHEN 2 THEN 'Quadra Demo B' ELSE 'Piscina Demo C' END,
      'arena', 'demo', _batch_id)
    RETURNING id INTO _tmp_id;
    _venue_ids := array_append(_venue_ids, _tmp_id);
    _venue_count := _venue_count + 1;
  END LOOP;

  -- D) People + Participants (10 per delegation = 80)
  FOR _i IN 1..8 LOOP
    FOR _j IN 1..10 LOOP
      INSERT INTO people (full_name, birth_date, gender, institution_id, seed_tag, seed_batch_id)
      VALUES ('Atleta Demo ' || ((_i-1)*10+_j), ('2008-01-01'::date + ((_j*30)||' days')::interval)::date,
        CASE WHEN _j<=5 THEN 'male' ELSE 'female' END, _inst_ids[_i], 'demo', _batch_id)
      RETURNING id INTO _tmp_id;
      _people_count := _people_count + 1;

      INSERT INTO participants (person_id, event_id, delegation_id, participant_type, status, seed_tag, seed_batch_id)
      VALUES (_tmp_id, p_event_id, _del_ids[_i], 'athlete', 'credenciado', 'demo', _batch_id);
      _part_count := _part_count + 1;
    END LOOP;
  END LOOP;

  -- E) Sport events loop
  OPEN _cur;
  LOOP
    FETCH _cur INTO _se_id, _se_name, _se_sport_id, _family, _wo_policy, _se_is_collective;
    EXIT WHEN NOT FOUND;
    _cur_count := _cur_count + 1;
    _demo_se_ids := array_append(_demo_se_ids, _se_id);

    -- Phase
    INSERT INTO competition_phases (event_id, sport_event_id, name, phase_type, sort_order, status, seed_tag, seed_batch_id)
    VALUES (p_event_id, _se_id, 'Fase de Grupos', 'group', 1, 'active', 'demo', _batch_id)
    RETURNING id INTO _phase_id;
    _phase_count := _phase_count + 1;

    IF _family IN ('score', 'sets') THEN
      -- Groups
      INSERT INTO competition_groups (event_id, phase_id, name, sort_order, seed_tag, seed_batch_id)
      VALUES (p_event_id, _phase_id, 'Grupo A', 1, 'demo', _batch_id) RETURNING id INTO _group_a_id;
      INSERT INTO competition_groups (event_id, phase_id, name, sort_order, seed_tag, seed_batch_id)
      VALUES (p_event_id, _phase_id, 'Grupo B', 2, 'demo', _batch_id) RETURNING id INTO _group_b_id;
      _group_count := _group_count + 2;

      -- Teams (8)
      _team_ids := ARRAY[]::uuid[];
      FOR _i IN 1..8 LOOP
        INSERT INTO teams (event_id, sport_event_id, delegation_id, name, status, seed_tag, seed_batch_id)
        VALUES (p_event_id, _se_id, _del_ids[_i],
          'Time Demo ' || _i || ' (' || substring(_se_name,1,12) || ')',
          'active', 'demo', _batch_id)
        RETURNING id INTO _tmp_id;
        _team_ids := array_append(_team_ids, _tmp_id);
        _team_count := _team_count + 1;
      END LOOP;

      -- Round-robin per group (4 teams => 6 matches)
      FOR _grp IN 0..1 LOOP
        FOR _i IN 1..4 LOOP
          FOR _j IN (_i+1)..4 LOOP
            _match_num := _match_num + 1;
            _is_wo := (_match_num % 8 = 0);

            INSERT INTO competition_matches (
              event_id, sport_event_id, phase_id, group_id, match_number, round_number, status, venue_id, seed_tag, seed_batch_id
            ) VALUES (
              p_event_id, _se_id, _phase_id,
              CASE WHEN _grp=0 THEN _group_a_id ELSE _group_b_id END,
              _match_num, _j - _i, 'finished',
              _venue_ids[1 + (_match_num % 3)], 'demo', _batch_id
            ) RETURNING id INTO _match_id;
            _match_count := _match_count + 1;

            INSERT INTO competition_match_entries (match_id, side, team_id, seed, seed_tag, seed_batch_id)
            VALUES (_match_id, 'home', _team_ids[_grp*4+_i], _i, 'demo', _batch_id) RETURNING id INTO _entry_a_id;
            INSERT INTO competition_match_entries (match_id, side, team_id, seed, seed_tag, seed_batch_id)
            VALUES (_match_id, 'away', _team_ids[_grp*4+_j], _j, 'demo', _batch_id) RETURNING id INTO _entry_b_id;
            _entry_count := _entry_count + 2;

            IF _is_wo THEN
              IF _family = 'score' THEN
                _score_home := CASE WHEN _wo_policy LIKE '%20%' THEN 20 WHEN _wo_policy LIKE '%10%' THEN 10 ELSE 3 END;
              ELSE _score_home := 3;
              END IF;
              _score_away := 0;
              _outcome_home := 'wo_win'; _outcome_away := 'wo_loss';
            ELSE
              IF _family = 'score' THEN
                _score_home := ((_match_num*7+_i*3) % 5);
                _score_away := ((_match_num*3+_j*7) % 4);
                IF _score_home = _score_away AND _match_num % 3 != 0 THEN _score_home := _score_home + 1; END IF;
                IF _score_home > _score_away THEN _outcome_home := 'win'; _outcome_away := 'loss';
                ELSIF _score_home < _score_away THEN _outcome_home := 'loss'; _outcome_away := 'win';
                ELSE _outcome_home := 'draw'; _outcome_away := 'draw';
                END IF;
              ELSE
                -- Sets: generate 3-0, 3-1, 3-2, 2-3 patterns
                CASE (_match_num + _i) % 4
                  WHEN 0 THEN _score_home := 3; _score_away := 0;
                  WHEN 1 THEN _score_home := 3; _score_away := 1;
                  WHEN 2 THEN _score_home := 3; _score_away := 2;
                  WHEN 3 THEN _score_home := 1; _score_away := 3;
                END CASE;
                IF _score_home > _score_away THEN _outcome_home := 'win'; _outcome_away := 'loss';
                ELSE _outcome_home := 'loss'; _outcome_away := 'win';
                END IF;
              END IF;
            END IF;

            INSERT INTO match_scores (match_id, match_entry_id, score_final, outcome, seed_tag, seed_batch_id, score_detail)
            VALUES (_match_id, _entry_a_id, _score_home::text, _outcome_home, 'demo', _batch_id,
              CASE WHEN _family='sets' THEN jsonb_build_object('sets', jsonb_build_array(
                jsonb_build_object('home',25,'away',CASE WHEN _score_home>=1 THEN 20 ELSE 25 END),
                jsonb_build_object('home',CASE WHEN _score_home>=2 THEN 25 ELSE 18 END,'away',CASE WHEN _score_away>=1 THEN 25 ELSE 20 END),
                jsonb_build_object('home',CASE WHEN _score_home>=3 THEN 25 ELSE 15 END,'away',CASE WHEN _score_away>=2 THEN 25 ELSE 18 END)
              )) ELSE NULL END
            );
            INSERT INTO match_scores (match_id, match_entry_id, score_final, outcome, seed_tag, seed_batch_id, score_detail)
            VALUES (_match_id, _entry_b_id, _score_away::text, _outcome_away, 'demo', _batch_id,
              CASE WHEN _family='sets' THEN jsonb_build_object('sets', jsonb_build_array(
                jsonb_build_object('home',CASE WHEN _score_home>=1 THEN 20 ELSE 25 END,'away',25),
                jsonb_build_object('home',CASE WHEN _score_away>=1 THEN 25 ELSE 20 END,'away',CASE WHEN _score_home>=2 THEN 25 ELSE 18 END),
                jsonb_build_object('home',CASE WHEN _score_away>=2 THEN 25 ELSE 18 END,'away',CASE WHEN _score_home>=3 THEN 25 ELSE 15 END)
              )) ELSE NULL END
            );
            _score_count := _score_count + 2;

          END LOOP;
        END LOOP;
      END LOOP;

    ELSE
      -- Time/combat: 4 bracket matches
      FOR _i IN 1..4 LOOP
        _match_num := _match_num + 1;
        INSERT INTO competition_matches (event_id, sport_event_id, phase_id, match_number, round_number, status, venue_id, seed_tag, seed_batch_id)
        VALUES (p_event_id, _se_id, _phase_id, _match_num, 1, 'finished', _venue_ids[1], 'demo', _batch_id)
        RETURNING id INTO _match_id;
        _match_count := _match_count + 1;

        INSERT INTO competition_match_entries (match_id, side, seed, seed_tag, seed_batch_id)
        VALUES (_match_id, 'home', _i*2-1, 'demo', _batch_id) RETURNING id INTO _entry_a_id;
        INSERT INTO competition_match_entries (match_id, side, seed, seed_tag, seed_batch_id)
        VALUES (_match_id, 'away', _i*2, 'demo', _batch_id) RETURNING id INTO _entry_b_id;
        _entry_count := _entry_count + 2;

        IF _family = 'time' THEN
          INSERT INTO competition_match_results (match_id, match_entry_id, recorded_by, result_status, outcome, time_ms, result_text, seed_tag, seed_batch_id)
          VALUES (_match_id, _entry_a_id, _caller, 'resultado_lancado', 'win', (10000+_i*1000)::bigint, (10+_i)::text||'.0s', 'demo', _batch_id);
          INSERT INTO competition_match_results (match_id, match_entry_id, recorded_by, result_status, outcome, time_ms, result_text, seed_tag, seed_batch_id)
          VALUES (_match_id, _entry_b_id, _caller, 'resultado_lancado', 'loss', (10000+_i*1000+500)::bigint, (10+_i)::text||'.5s', 'demo', _batch_id);
        ELSE
          INSERT INTO match_scores (match_id, match_entry_id, score_final, outcome, seed_tag, seed_batch_id)
          VALUES (_match_id, _entry_a_id, '1', 'win', 'demo', _batch_id);
          INSERT INTO match_scores (match_id, match_entry_id, score_final, outcome, seed_tag, seed_batch_id)
          VALUES (_match_id, _entry_b_id, '0', 'loss', 'demo', _batch_id);
        END IF;
        _score_count := _score_count + 2;
      END LOOP;
    END IF;

    _notes := array_append(_notes, 'Seeded ' || _se_name || ' (' || _family || ')');
  END LOOP;
  CLOSE _cur;

  -- F) Logistics
  INSERT INTO transport_vehicles (event_id, plate, capacity, vehicle_type, seed_tag, seed_batch_id)
  VALUES (p_event_id, 'DEMO-001', 40, 'bus', 'demo', _batch_id),
         (p_event_id, 'DEMO-002', 15, 'van', 'demo', _batch_id);

  INSERT INTO transport_routes (event_id, name, origin, destination, seed_tag, seed_batch_id)
  VALUES (p_event_id, 'Rota Demo Centro-Ginásio', 'Centro', 'Ginásio Demo A', 'demo', _batch_id)
  RETURNING id INTO _tmp_id;

  INSERT INTO transport_trips (event_id, route_id, status, seed_tag, seed_batch_id, scheduled_at)
  SELECT p_event_id, _tmp_id, 'scheduled', 'demo', _batch_id, now()+interval '1 day'
  FROM transport_vehicles tv WHERE tv.event_id=p_event_id AND tv.seed_tag='demo' LIMIT 1;

  INSERT INTO lodging_locations (event_id, name, address, seed_tag, seed_batch_id)
  VALUES (p_event_id, 'Alojamento Demo Central', 'Rua Demo, 100', 'demo', _batch_id)
  RETURNING id INTO _tmp_id;

  INSERT INTO lodging_units (event_id, location_id, name, capacity, seed_tag, seed_batch_id)
  VALUES (p_event_id, _tmp_id, 'Quarto Demo 101', 4, 'demo', _batch_id),
         (p_event_id, _tmp_id, 'Quarto Demo 102', 4, 'demo', _batch_id);

  IF _cur_count = 0 THEN
    _notes := array_append(_notes, 'AVISO: Nenhum sport_event encontrado. Crie modalidades/provas primeiro.');
  END IF;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'seed_batch_id', _batch_id,
    'created', jsonb_build_object(
      'institutions', _inst_count, 'delegations', _del_count,
      'people', _people_count, 'participants', _part_count,
      'teams', _team_count, 'phases', _phase_count, 'groups', _group_count,
      'matches', _match_count, 'entries', _entry_count, 'scores', _score_count,
      'venues', _venue_count, 'transport_vehicles', 2, 'transport_routes', 1,
      'transport_trips', 1, 'lodging_locations', 1, 'lodging_units', 2
    ),
    'demo_sport_events', to_jsonb(_demo_se_ids),
    'notes', to_jsonb(_notes)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seed_event_demo FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_event_demo TO authenticated;
