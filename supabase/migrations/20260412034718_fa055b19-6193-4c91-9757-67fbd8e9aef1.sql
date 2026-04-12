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
    VALUES (p_event_id, _inst_ids[_i], 'confirmed', 'Chefe Demo ' || _i, 'demo', _batch_id)
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
      VALUES (_tmp_id, p_event_id, _del_ids[_i], 'athlete', 'confirmed', 'demo', _batch_id);
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

    INSERT INTO competition_phases (event_id, sport_event_id, name, phase_type, sort_order, status, seed_tag, seed_batch_id)
    VALUES (p_event_id, _se_id, 'Fase de Grupos', 'group', 1, 'active', 'demo', _batch_id)
    RETURNING id INTO _phase_id;
    _phase_count := _phase_count + 1;

    INSERT INTO competition_groups (event_id, phase_id, name, sort_order, seed_tag, seed_batch_id)
    VALUES (p_event_id, _phase_id, 'Grupo A', 1, 'demo', _batch_id) RETURNING id INTO _group_a_id;
    INSERT INTO competition_groups (event_id, phase_id, name, sort_order, seed_tag, seed_batch_id)
    VALUES (p_event_id, _phase_id, 'Grupo B', 2, 'demo', _batch_id) RETURNING id INTO _group_b_id;
    _group_count := _group_count + 2;

    _team_ids := ARRAY[]::uuid[];
    FOR _i IN 1..8 LOOP
      INSERT INTO teams (event_id, sport_event_id, delegation_id, name, seed_tag, seed_batch_id)
      VALUES (p_event_id, _se_id, _del_ids[_i], 'Time Demo ' || _cur_count || '-' || _i, 'demo', _batch_id)
      RETURNING id INTO _tmp_id;
      _team_ids := array_append(_team_ids, _tmp_id);
      _team_count := _team_count + 1;
    END LOOP;

    -- Round-robin Group A (teams 1-4)
    FOR _i IN 1..3 LOOP
      FOR _j IN (_i+1)..4 LOOP
        _match_num := _match_num + 1;
        _is_wo := (_match_num % 7 = 0);

        INSERT INTO competition_matches (event_id, phase_id, group_id, sport_event_id, match_number, round_number, status, venue_id, seed_tag, seed_batch_id)
        VALUES (p_event_id, _phase_id, _group_a_id, _se_id, _match_num, _i, 'finished', _venue_ids[1 + (_match_num % 3)], 'demo', _batch_id)
        RETURNING id INTO _match_id;
        _match_count := _match_count + 1;

        INSERT INTO competition_match_entries (match_id, team_id, side, seed_tag, seed_batch_id)
        VALUES (_match_id, _team_ids[_i], 'home', 'demo', _batch_id) RETURNING id INTO _entry_a_id;
        INSERT INTO competition_match_entries (match_id, team_id, side, seed_tag, seed_batch_id)
        VALUES (_match_id, _team_ids[_j], 'away', 'demo', _batch_id) RETURNING id INTO _entry_b_id;
        _entry_count := _entry_count + 2;

        IF _is_wo THEN
          _score_home := split_part(_wo_policy, 'x', 1)::int;
          _score_away := 0;
          _outcome_home := 'wo_win'; _outcome_away := 'wo_loss';
        ELSE
          _score_home := floor(random()*5)::int;
          _score_away := floor(random()*5)::int;
          IF _score_home > _score_away THEN _outcome_home := 'win'; _outcome_away := 'loss';
          ELSIF _score_home < _score_away THEN _outcome_home := 'loss'; _outcome_away := 'win';
          ELSE _outcome_home := 'draw'; _outcome_away := 'draw';
          END IF;
        END IF;

        INSERT INTO match_scores (match_id, match_entry_id, score_final, outcome, seed_tag, seed_batch_id)
        VALUES (_match_id, _entry_a_id, _score_home::text, _outcome_home, 'demo', _batch_id);
        INSERT INTO match_scores (match_id, match_entry_id, score_final, outcome, seed_tag, seed_batch_id)
        VALUES (_match_id, _entry_b_id, _score_away::text, _outcome_away, 'demo', _batch_id);
        _score_count := _score_count + 2;
      END LOOP;
    END LOOP;

    -- Round-robin Group B (teams 5-8)
    FOR _i IN 5..7 LOOP
      FOR _j IN (_i+1)..8 LOOP
        _match_num := _match_num + 1;
        _is_wo := (_match_num % 7 = 0);

        INSERT INTO competition_matches (event_id, phase_id, group_id, sport_event_id, match_number, round_number, status, venue_id, seed_tag, seed_batch_id)
        VALUES (p_event_id, _phase_id, _group_b_id, _se_id, _match_num, _i-4, 'finished', _venue_ids[1 + (_match_num % 3)], 'demo', _batch_id)
        RETURNING id INTO _match_id;
        _match_count := _match_count + 1;

        INSERT INTO competition_match_entries (match_id, team_id, side, seed_tag, seed_batch_id)
        VALUES (_match_id, _team_ids[_i], 'home', 'demo', _batch_id) RETURNING id INTO _entry_a_id;
        INSERT INTO competition_match_entries (match_id, team_id, side, seed_tag, seed_batch_id)
        VALUES (_match_id, _team_ids[_j], 'away', 'demo', _batch_id) RETURNING id INTO _entry_b_id;
        _entry_count := _entry_count + 2;

        IF _is_wo THEN
          _score_home := split_part(_wo_policy, 'x', 1)::int;
          _score_away := 0;
          _outcome_home := 'wo_win'; _outcome_away := 'wo_loss';
        ELSE
          _score_home := floor(random()*5)::int;
          _score_away := floor(random()*5)::int;
          IF _score_home > _score_away THEN _outcome_home := 'win'; _outcome_away := 'loss';
          ELSIF _score_home < _score_away THEN _outcome_home := 'loss'; _outcome_away := 'win';
          ELSE _outcome_home := 'draw'; _outcome_away := 'draw';
          END IF;
        END IF;

        INSERT INTO match_scores (match_id, match_entry_id, score_final, outcome, seed_tag, seed_batch_id)
        VALUES (_match_id, _entry_a_id, _score_home::text, _outcome_home, 'demo', _batch_id);
        INSERT INTO match_scores (match_id, match_entry_id, score_final, outcome, seed_tag, seed_batch_id)
        VALUES (_match_id, _entry_b_id, _score_away::text, _outcome_away, 'demo', _batch_id);
        _score_count := _score_count + 2;
      END LOOP;
    END LOOP;

    _notes := array_append(_notes, format('SE %s (%s): 1 phase, 2 groups, %s teams', _se_name, _family, 8));
  END LOOP;
  CLOSE _cur;

  -- F) Lodging
  DECLARE _loc_id uuid;
  BEGIN
    INSERT INTO lodging_locations (event_id, name, address, seed_tag, seed_batch_id)
    VALUES (p_event_id, 'Alojamento Demo Central', 'Rua Demo 1', 'demo', _batch_id)
    RETURNING id INTO _loc_id;
    FOR _i IN 1..4 LOOP
      INSERT INTO lodging_units (event_id, location_id, name, capacity, seed_tag, seed_batch_id)
      VALUES (p_event_id, _loc_id, 'Quarto Demo ' || _i, 10, 'demo', _batch_id);
    END LOOP;
  END;

  -- G) Meals
  DECLARE _mt_id uuid;
  BEGIN
    INSERT INTO meal_types (event_id, name, slug, sort_order, seed_tag, seed_batch_id)
    VALUES (p_event_id, 'Almoço Demo', 'almoco-demo-' || substr(_batch_id::text,1,8), 1, 'demo', _batch_id)
    RETURNING id INTO _mt_id;
    INSERT INTO meal_windows (event_id, meal_type_id, service_date, start_time, end_time, location, seed_tag, seed_batch_id)
    VALUES (p_event_id, _mt_id, CURRENT_DATE, '11:30', '13:30', 'Refeitório Demo', 'demo', _batch_id);
  END;

  -- H) Transport
  BEGIN
    INSERT INTO transport_vehicles (event_id, plate, vehicle_type, capacity, seed_tag, seed_batch_id)
    VALUES (p_event_id, 'DEMO-0001', 'bus', 40, 'demo', _batch_id),
           (p_event_id, 'DEMO-0002', 'van', 15, 'demo', _batch_id);
  END;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'seed_batch_id', _batch_id,
    'created', jsonb_build_object(
      'institutions', _inst_count, 'delegations', _del_count,
      'people', _people_count, 'participants', _part_count,
      'teams', _team_count, 'phases', _phase_count,
      'groups', _group_count, 'matches', _match_count,
      'entries', _entry_count, 'scores', _score_count,
      'venues', _venue_count
    ),
    'demo_sport_events', to_jsonb(_demo_se_ids),
    'notes', to_jsonb(_notes)
  );
END;
$$;