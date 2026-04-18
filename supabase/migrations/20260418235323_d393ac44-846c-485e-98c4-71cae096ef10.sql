-- ============================================================
-- Seed de Logística por Etapa
-- RPCs: seed_logistics_by_stage / clear_logistics_seed_by_stage
-- Tag única: 'seed:logistica:stage'
-- ============================================================

-- Helper: normaliza nome do evento em SEDE (A-Z, sem acento)
CREATE OR REPLACE FUNCTION public._seed_logistics_sede_code(p_event_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_code text;
BEGIN
  SELECT COALESCE(slug, name) INTO v_name FROM public.events WHERE id = p_event_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Evento % não encontrado', p_event_id;
  END IF;
  -- remove acentos, mantém só letras, upper, pega último token significativo
  v_code := upper(regexp_replace(
    translate(v_name,
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
    '[^A-Za-z0-9]+', '-', 'g'));
  -- pega último segmento (geralmente o município)
  v_code := split_part(v_code, '-', array_length(string_to_array(v_code,'-'),1));
  IF v_code IS NULL OR length(v_code) < 2 THEN
    v_code := upper(regexp_replace(v_name, '[^A-Za-z0-9]+', '', 'g'));
  END IF;
  RETURN v_code;
END;
$$;

-- ============================================================
-- SEED: gera dataset completo
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_logistics_by_stage(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag      text := 'seed:logistica:stage';
  v_batch    uuid := gen_random_uuid();
  v_sede     text;
  v_user     uuid := auth.uid();
  v_event    record;
  v_venue    record;
  v_deleg    record;
  v_loc_id   uuid;
  v_meal_id  uuid;
  v_route_int_alo uuid;
  v_route_alo_comp uuid;
  v_route_comp_alo uuid;
  v_route_alo_int uuid;
  v_n_venues int;
  v_n_delegs int;
  v_seq      int;
  v_d        date;
  v_cnt jsonb := jsonb_build_object('vehicles',0,'lodging_locations',0,'lodging_units',0,
                                    'meal_types',0,'meal_windows',0,'routes',0,'trips',0);
BEGIN
  -- Permissão
  IF NOT public.has_role(v_user, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permissão negada: apenas admin pode gerar seed de logística';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF v_event.id IS NULL THEN RAISE EXCEPTION 'Evento não encontrado'; END IF;

  v_sede := public._seed_logistics_sede_code(p_event_id);

  -- Pré-checagem: precisa ter venues e delegações
  SELECT count(*) INTO v_n_venues FROM public.venues WHERE event_id = p_event_id;
  SELECT count(*) INTO v_n_delegs FROM public.delegations WHERE event_id = p_event_id;
  IF v_n_venues = 0 THEN RAISE EXCEPTION 'Evento sem locais de competição (venues). Cadastre antes.'; END IF;
  IF v_n_delegs = 0 THEN RAISE EXCEPTION 'Evento sem delegações. Cadastre antes.'; END IF;

  -- Idempotência: se já houver seed deste tipo neste evento, aborta orientando limpar
  IF EXISTS (SELECT 1 FROM public.transport_vehicles WHERE event_id=p_event_id AND seed_tag=v_tag) THEN
    RAISE EXCEPTION 'Já existe seed de logística para este evento. Use "Limpar seed" antes de gerar novamente.';
  END IF;

  -- ===== VEÍCULOS (2 ônibus, 2 vans, 1 micro) =====
  INSERT INTO public.transport_vehicles(event_id, plate, label, capacity, vehicle_type, is_active, seed_tag, seed_batch_id)
  VALUES
    (p_event_id, 'ONIBUS-'||v_sede||'-001', 'ONIBUS-'||v_sede||'-001', 44, 'bus',   true, v_tag, v_batch),
    (p_event_id, 'ONIBUS-'||v_sede||'-002', 'ONIBUS-'||v_sede||'-002', 44, 'bus',   true, v_tag, v_batch),
    (p_event_id, 'VAN-'||v_sede||'-001',    'VAN-'||v_sede||'-001',    15, 'van',   true, v_tag, v_batch),
    (p_event_id, 'VAN-'||v_sede||'-002',    'VAN-'||v_sede||'-002',    15, 'van',   true, v_tag, v_batch),
    (p_event_id, 'MICRO-'||v_sede||'-001',  'MICRO-'||v_sede||'-001',  28, 'minibus',true, v_tag, v_batch);
  v_cnt := jsonb_set(v_cnt,'{vehicles}', to_jsonb(5));

  -- ===== ALOJAMENTOS + UNIDADES (1 por venue) =====
  v_seq := 0;
  FOR v_venue IN SELECT id, name FROM public.venues WHERE event_id=p_event_id ORDER BY name LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.lodging_locations(event_id, name, address, is_active, seed_tag, seed_batch_id, notes)
    VALUES (p_event_id, 'ALOJ-'||v_sede||'-'||lpad(v_seq::text,3,'0'),
            'Endereço seed - vinculado a '||v_venue.name, true, v_tag, v_batch,
            'Alojamento seed associado ao venue '||v_venue.name)
    RETURNING id INTO v_loc_id;
    v_cnt := jsonb_set(v_cnt,'{lodging_locations}', to_jsonb((v_cnt->>'lodging_locations')::int+1));

    INSERT INTO public.lodging_units(event_id, location_id, name, capacity, gender_restriction, is_active, seed_tag, seed_batch_id)
    VALUES
      (p_event_id, v_loc_id, 'UNIT-'||v_sede||'-'||lpad(v_seq::text,3,'0')||'-MASC', 30, 'male',   true, v_tag, v_batch),
      (p_event_id, v_loc_id, 'UNIT-'||v_sede||'-'||lpad(v_seq::text,3,'0')||'-FEM',  30, 'female', true, v_tag, v_batch);
    v_cnt := jsonb_set(v_cnt,'{lodging_units}', to_jsonb((v_cnt->>'lodging_units')::int+2));
  END LOOP;

  -- ===== MEAL TYPES + JANELAS =====
  -- 1 refeitório por alojamento (representado como meal_type "REFEIT-{SEDE}-NNN") com 3 janelas/dia
  v_seq := 0;
  FOR v_venue IN SELECT id, name FROM public.venues WHERE event_id=p_event_id ORDER BY name LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.meal_types(event_id, name, slug, sort_order, is_active, seed_tag, seed_batch_id)
    VALUES (p_event_id,
            'REFEIT-'||v_sede||'-'||lpad(v_seq::text,3,'0'),
            lower('refeit-'||v_sede||'-'||lpad(v_seq::text,3,'0')),
            v_seq, true, v_tag, v_batch)
    RETURNING id INTO v_meal_id;
    v_cnt := jsonb_set(v_cnt,'{meal_types}', to_jsonb((v_cnt->>'meal_types')::int+1));

    -- janelas para cada dia do evento (fallback: hoje + 2)
    FOR v_d IN
      SELECT generate_series(
        COALESCE(v_event.start_date, CURRENT_DATE)::date,
        COALESCE(v_event.end_date,   COALESCE(v_event.start_date, CURRENT_DATE) + 2)::date,
        '1 day'::interval)::date
    LOOP
      INSERT INTO public.meal_windows(event_id, meal_type_id, label, service_date, start_time, end_time, location, is_active, seed_tag, seed_batch_id)
      VALUES
        (p_event_id, v_meal_id, 'Café da manhã', v_d, '06:30'::time, '08:30'::time, 'REFEIT-'||v_sede||'-'||lpad(v_seq::text,3,'0'), true, v_tag, v_batch),
        (p_event_id, v_meal_id, 'Almoço',        v_d, '11:30'::time, '14:00'::time, 'REFEIT-'||v_sede||'-'||lpad(v_seq::text,3,'0'), true, v_tag, v_batch),
        (p_event_id, v_meal_id, 'Jantar',        v_d, '18:00'::time, '20:30'::time, 'REFEIT-'||v_sede||'-'||lpad(v_seq::text,3,'0'), true, v_tag, v_batch);
      v_cnt := jsonb_set(v_cnt,'{meal_windows}', to_jsonb((v_cnt->>'meal_windows')::int+3));
    END LOOP;
  END LOOP;

  -- ===== ROTAS (4 tipos por venue) + 4 viagens por delegação (1 de cada tipo, distribuídas) =====
  v_seq := 0;
  FOR v_venue IN SELECT id, name FROM public.venues WHERE event_id=p_event_id ORDER BY name LOOP
    v_seq := v_seq + 1;

    INSERT INTO public.transport_routes(event_id, name, origin, destination, is_active, seed_tag, seed_batch_id, notes)
    VALUES (p_event_id, 'ROTA-'||v_sede||'-INT-ALO-'||lpad(v_seq::text,3,'0'),
            'Município de origem', 'ALOJ-'||v_sede||'-'||lpad(v_seq::text,3,'0'),
            true, v_tag, v_batch, 'Busca interior → alojamento')
    RETURNING id INTO v_route_int_alo;

    INSERT INTO public.transport_routes(event_id, name, origin, destination, is_active, seed_tag, seed_batch_id, notes)
    VALUES (p_event_id, 'ROTA-'||v_sede||'-ALO-COMP-'||lpad(v_seq::text,3,'0'),
            'ALOJ-'||v_sede||'-'||lpad(v_seq::text,3,'0'), v_venue.name,
            true, v_tag, v_batch, 'Alojamento → competição')
    RETURNING id INTO v_route_alo_comp;

    INSERT INTO public.transport_routes(event_id, name, origin, destination, is_active, seed_tag, seed_batch_id, notes)
    VALUES (p_event_id, 'ROTA-'||v_sede||'-COMP-ALO-'||lpad(v_seq::text,3,'0'),
            v_venue.name, 'ALOJ-'||v_sede||'-'||lpad(v_seq::text,3,'0'),
            true, v_tag, v_batch, 'Competição → alojamento')
    RETURNING id INTO v_route_comp_alo;

    INSERT INTO public.transport_routes(event_id, name, origin, destination, is_active, seed_tag, seed_batch_id, notes)
    VALUES (p_event_id, 'ROTA-'||v_sede||'-ALO-INT-'||lpad(v_seq::text,3,'0'),
            'ALOJ-'||v_sede||'-'||lpad(v_seq::text,3,'0'), 'Município de origem',
            true, v_tag, v_batch, 'Alojamento → interior')
    RETURNING id INTO v_route_alo_int;

    v_cnt := jsonb_set(v_cnt,'{routes}', to_jsonb((v_cnt->>'routes')::int+4));
  END LOOP;

  -- ===== VIAGENS: 4 por delegação (uma de cada tipo de rota), cíclica nos venues =====
  DECLARE
    v_trip_seq int := 0;
    v_routes uuid[];
    v_route_id uuid;
    v_vehicles uuid[];
    v_vehicle_id uuid;
    v_route_idx int;
    v_veh_idx int := 0;
  BEGIN
    SELECT array_agg(id ORDER BY name) INTO v_vehicles
      FROM public.transport_vehicles WHERE event_id=p_event_id AND seed_tag=v_tag;

    FOR v_deleg IN SELECT id FROM public.delegations WHERE event_id=p_event_id ORDER BY school_name LOOP
      -- pega 1 rota de cada tipo (rotação por venue)
      FOR v_route_id IN
        SELECT id FROM public.transport_routes
         WHERE event_id=p_event_id AND seed_tag=v_tag
         ORDER BY name
         LIMIT 4
      LOOP
        v_trip_seq := v_trip_seq + 1;
        v_veh_idx  := (v_veh_idx % array_length(v_vehicles,1)) + 1;
        v_vehicle_id := v_vehicles[v_veh_idx];

        INSERT INTO public.transport_trips(
          event_id, route_id, vehicle_id, driver_name, scheduled_at, status, trip_status,
          notes, created_by, seed_tag, seed_batch_id, has_incidents)
        VALUES (p_event_id, v_route_id, v_vehicle_id,
                'Motorista Seed '||v_trip_seq,
                COALESCE(v_event.start_date, CURRENT_DATE)::timestamptz + (v_trip_seq * interval '30 minutes'),
                'scheduled', 'scheduled',
                'VIAGEM-'||v_sede||'-'||lpad(v_trip_seq::text,3,'0')||' (delegação '||v_deleg.id::text||')',
                v_user, v_tag, v_batch, false);
        v_cnt := jsonb_set(v_cnt,'{trips}', to_jsonb((v_cnt->>'trips')::int+1));
      END LOOP;
    END LOOP;
  END;

  -- Auditoria
  INSERT INTO public.audit_events(table_name, record_id, action, payload, created_by)
  VALUES ('logistics_seed', p_event_id, 'seed_generated',
          jsonb_build_object('event_id',p_event_id,'sede',v_sede,'batch',v_batch,'counts',v_cnt),
          v_user);

  RETURN jsonb_build_object('ok', true, 'sede', v_sede, 'batch', v_batch, 'counts', v_cnt);
END;
$$;

-- ============================================================
-- CLEAR
-- ============================================================
CREATE OR REPLACE FUNCTION public.clear_logistics_seed_by_stage(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag  text := 'seed:logistica:stage';
  v_user uuid := auth.uid();
  v_cnt  jsonb := '{}'::jsonb;
  n int;
BEGIN
  IF NOT public.has_role(v_user, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permissão negada: apenas admin pode limpar seed de logística';
  END IF;

  DELETE FROM public.transport_trips WHERE event_id=p_event_id AND seed_tag=v_tag;
  GET DIAGNOSTICS n = ROW_COUNT; v_cnt := jsonb_set(v_cnt,'{trips}', to_jsonb(n), true);

  DELETE FROM public.transport_routes WHERE event_id=p_event_id AND seed_tag=v_tag;
  GET DIAGNOSTICS n = ROW_COUNT; v_cnt := jsonb_set(v_cnt,'{routes}', to_jsonb(n), true);

  DELETE FROM public.transport_vehicles WHERE event_id=p_event_id AND seed_tag=v_tag;
  GET DIAGNOSTICS n = ROW_COUNT; v_cnt := jsonb_set(v_cnt,'{vehicles}', to_jsonb(n), true);

  DELETE FROM public.meal_windows WHERE event_id=p_event_id AND seed_tag=v_tag;
  GET DIAGNOSTICS n = ROW_COUNT; v_cnt := jsonb_set(v_cnt,'{meal_windows}', to_jsonb(n), true);

  DELETE FROM public.meal_types WHERE event_id=p_event_id AND seed_tag=v_tag;
  GET DIAGNOSTICS n = ROW_COUNT; v_cnt := jsonb_set(v_cnt,'{meal_types}', to_jsonb(n), true);

  DELETE FROM public.lodging_units WHERE event_id=p_event_id AND seed_tag=v_tag;
  GET DIAGNOSTICS n = ROW_COUNT; v_cnt := jsonb_set(v_cnt,'{lodging_units}', to_jsonb(n), true);

  DELETE FROM public.lodging_locations WHERE event_id=p_event_id AND seed_tag=v_tag;
  GET DIAGNOSTICS n = ROW_COUNT; v_cnt := jsonb_set(v_cnt,'{lodging_locations}', to_jsonb(n), true);

  INSERT INTO public.audit_events(table_name, record_id, action, payload, created_by)
  VALUES ('logistics_seed', p_event_id, 'seed_cleared',
          jsonb_build_object('event_id',p_event_id,'counts',v_cnt), v_user);

  RETURN jsonb_build_object('ok', true, 'counts', v_cnt);
END;
$$;

REVOKE ALL ON FUNCTION public.seed_logistics_by_stage(uuid)        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_logistics_seed_by_stage(uuid)  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_logistics_by_stage(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_logistics_seed_by_stage(uuid)  TO authenticated;