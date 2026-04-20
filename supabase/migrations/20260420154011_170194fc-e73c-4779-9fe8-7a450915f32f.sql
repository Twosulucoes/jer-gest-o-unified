-- ============================================================
-- Seed de logística para TODAS as etapas do evento
-- Reaproveita a estrutura de seed_logistics_by_stage, mas
-- itera por event_stages e isola por seed_tag por etapa
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_logistics_all_stages(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_event    record;
  v_stage    record;
  v_sede     text;
  v_n_venues int;
  v_n_delegs int;
  v_n_stages int;
  v_tag      text;
  v_batch    uuid;
  v_venue    record;
  v_deleg    record;
  v_loc_id   uuid;
  v_meal_id  uuid;
  v_route_int_alo uuid;
  v_route_alo_comp uuid;
  v_route_comp_alo uuid;
  v_route_alo_int uuid;
  v_seq      int;
  v_d        date;
  v_stage_results jsonb := '[]'::jsonb;
  v_stage_cnt jsonb;
  v_skipped int := 0;
  v_processed int := 0;
BEGIN
  IF NOT public.has_role(v_user, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permissão negada: apenas admin pode gerar seed de logística';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF v_event.id IS NULL THEN RAISE EXCEPTION 'Evento não encontrado'; END IF;

  v_sede := public._seed_logistics_sede_code(p_event_id);

  SELECT count(*) INTO v_n_venues FROM public.venues WHERE event_id = p_event_id;
  SELECT count(*) INTO v_n_delegs FROM public.delegations WHERE event_id = p_event_id;
  SELECT count(*) INTO v_n_stages FROM public.event_stages WHERE event_id = p_event_id AND status = 'active';

  IF v_n_venues = 0 THEN RAISE EXCEPTION 'Evento sem venues. Cadastre antes.'; END IF;
  IF v_n_delegs = 0 THEN RAISE EXCEPTION 'Evento sem delegações. Cadastre antes.'; END IF;
  IF v_n_stages = 0 THEN RAISE EXCEPTION 'Evento sem etapas ativas. Crie ao menos uma etapa antes.'; END IF;

  FOR v_stage IN
    SELECT id, name, slug, starts_at, ends_at
    FROM public.event_stages
    WHERE event_id = p_event_id AND status = 'active'
    ORDER BY sort_order, name
  LOOP
    v_tag := 'seed:logistica:stage:' || v_stage.slug;
    v_batch := gen_random_uuid();
    v_stage_cnt := jsonb_build_object('vehicles',0,'lodging_locations',0,'lodging_units',0,
                                      'meal_types',0,'meal_windows',0,'routes',0,'trips',0);

    -- Idempotência por etapa: pula se já houver seed
    IF EXISTS (SELECT 1 FROM public.transport_vehicles
               WHERE event_id=p_event_id AND seed_tag=v_tag) THEN
      v_skipped := v_skipped + 1;
      v_stage_results := v_stage_results || jsonb_build_object(
        'stage_id', v_stage.id, 'stage_name', v_stage.name,
        'status', 'skipped', 'reason', 'já existe seed nesta etapa'
      );
      CONTINUE;
    END IF;

    -- ===== VEÍCULOS =====
    INSERT INTO public.transport_vehicles(event_id, event_stage_id, plate, label, capacity, vehicle_type, is_active, seed_tag, seed_batch_id)
    VALUES
      (p_event_id, v_stage.id, 'ONIBUS-'||v_sede||'-'||v_stage.slug||'-001', 'ONIBUS-'||v_sede||'-'||v_stage.slug||'-001', 44, 'bus',     true, v_tag, v_batch),
      (p_event_id, v_stage.id, 'ONIBUS-'||v_sede||'-'||v_stage.slug||'-002', 'ONIBUS-'||v_sede||'-'||v_stage.slug||'-002', 44, 'bus',     true, v_tag, v_batch),
      (p_event_id, v_stage.id, 'VAN-'||v_sede||'-'||v_stage.slug||'-001',    'VAN-'||v_sede||'-'||v_stage.slug||'-001',    15, 'van',     true, v_tag, v_batch),
      (p_event_id, v_stage.id, 'VAN-'||v_sede||'-'||v_stage.slug||'-002',    'VAN-'||v_sede||'-'||v_stage.slug||'-002',    15, 'van',     true, v_tag, v_batch),
      (p_event_id, v_stage.id, 'MICRO-'||v_sede||'-'||v_stage.slug||'-001',  'MICRO-'||v_sede||'-'||v_stage.slug||'-001',  28, 'minibus', true, v_tag, v_batch);
    v_stage_cnt := jsonb_set(v_stage_cnt,'{vehicles}', to_jsonb(5));

    -- ===== ALOJAMENTOS + UNIDADES =====
    v_seq := 0;
    FOR v_venue IN SELECT id, name FROM public.venues WHERE event_id=p_event_id ORDER BY name LOOP
      v_seq := v_seq + 1;
      INSERT INTO public.lodging_locations(event_id, event_stage_id, name, address, is_active, seed_tag, seed_batch_id, notes)
      VALUES (p_event_id, v_stage.id,
              'ALOJ-'||v_sede||'-'||v_stage.slug||'-'||lpad(v_seq::text,3,'0'),
              'Endereço seed - vinculado a '||v_venue.name, true, v_tag, v_batch,
              'Alojamento seed (etapa '||v_stage.name||') associado ao venue '||v_venue.name)
      RETURNING id INTO v_loc_id;
      v_stage_cnt := jsonb_set(v_stage_cnt,'{lodging_locations}', to_jsonb((v_stage_cnt->>'lodging_locations')::int+1));

      INSERT INTO public.lodging_units(event_id, event_stage_id, location_id, name, capacity, gender_restriction, is_active, seed_tag, seed_batch_id)
      VALUES
        (p_event_id, v_stage.id, v_loc_id, 'UNIT-'||v_sede||'-'||v_stage.slug||'-'||lpad(v_seq::text,3,'0')||'-MASC', 30, 'male',   true, v_tag, v_batch),
        (p_event_id, v_stage.id, v_loc_id, 'UNIT-'||v_sede||'-'||v_stage.slug||'-'||lpad(v_seq::text,3,'0')||'-FEM',  30, 'female', true, v_tag, v_batch);
      v_stage_cnt := jsonb_set(v_stage_cnt,'{lodging_units}', to_jsonb((v_stage_cnt->>'lodging_units')::int+2));
    END LOOP;

    -- ===== MEAL TYPES + JANELAS =====
    v_seq := 0;
    FOR v_venue IN SELECT id, name FROM public.venues WHERE event_id=p_event_id ORDER BY name LOOP
      v_seq := v_seq + 1;
      INSERT INTO public.meal_types(event_id, event_stage_id, name, slug, sort_order, is_active, seed_tag, seed_batch_id)
      VALUES (p_event_id, v_stage.id,
              'REFEIT-'||v_sede||'-'||v_stage.slug||'-'||lpad(v_seq::text,3,'0'),
              lower('refeit-'||v_sede||'-'||v_stage.slug||'-'||lpad(v_seq::text,3,'0')),
              v_seq, true, v_tag, v_batch)
      RETURNING id INTO v_meal_id;
      v_stage_cnt := jsonb_set(v_stage_cnt,'{meal_types}', to_jsonb((v_stage_cnt->>'meal_types')::int+1));

      FOR v_d IN
        SELECT generate_series(
          COALESCE(v_stage.starts_at::date, v_event.start_date, CURRENT_DATE),
          COALESCE(v_stage.ends_at::date,   v_event.end_date,   COALESCE(v_stage.starts_at::date, v_event.start_date, CURRENT_DATE) + 2),
          '1 day'::interval)::date
      LOOP
        INSERT INTO public.meal_windows(event_id, event_stage_id, meal_type_id, label, service_date, start_time, end_time, location, is_active, seed_tag, seed_batch_id)
        VALUES
          (p_event_id, v_stage.id, v_meal_id, 'Café da manhã', v_d, '06:30'::time, '08:30'::time, 'REFEIT-'||v_sede||'-'||v_stage.slug||'-'||lpad(v_seq::text,3,'0'), true, v_tag, v_batch),
          (p_event_id, v_stage.id, v_meal_id, 'Almoço',        v_d, '11:30'::time, '14:00'::time, 'REFEIT-'||v_sede||'-'||v_stage.slug||'-'||lpad(v_seq::text,3,'0'), true, v_tag, v_batch),
          (p_event_id, v_stage.id, v_meal_id, 'Jantar',        v_d, '18:00'::time, '20:30'::time, 'REFEIT-'||v_sede||'-'||v_stage.slug||'-'||lpad(v_seq::text,3,'0'), true, v_tag, v_batch);
        v_stage_cnt := jsonb_set(v_stage_cnt,'{meal_windows}', to_jsonb((v_stage_cnt->>'meal_windows')::int+3));
      END LOOP;
    END LOOP;

    -- ===== ROTAS (4 por venue) =====
    v_seq := 0;
    FOR v_venue IN SELECT id, name FROM public.venues WHERE event_id=p_event_id ORDER BY name LOOP
      v_seq := v_seq + 1;

      INSERT INTO public.transport_routes(event_id, event_stage_id, name, origin, destination, is_active, seed_tag, seed_batch_id, notes)
      VALUES (p_event_id, v_stage.id, 'ROTA-'||v_sede||'-'||v_stage.slug||'-INT-ALO-'||lpad(v_seq::text,3,'0'),
              'Município de origem', 'ALOJ-'||v_sede||'-'||v_stage.slug||'-'||lpad(v_seq::text,3,'0'),
              true, v_tag, v_batch, 'Busca interior → alojamento')
      RETURNING id INTO v_route_int_alo;

      INSERT INTO public.transport_routes(event_id, event_stage_id, name, origin, destination, is_active, seed_tag, seed_batch_id, notes)
      VALUES (p_event_id, v_stage.id, 'ROTA-'||v_sede||'-'||v_stage.slug||'-ALO-COMP-'||lpad(v_seq::text,3,'0'),
              'ALOJ-'||v_sede||'-'||v_stage.slug||'-'||lpad(v_seq::text,3,'0'), v_venue.name,
              true, v_tag, v_batch, 'Alojamento → competição')
      RETURNING id INTO v_route_alo_comp;

      INSERT INTO public.transport_routes(event_id, event_stage_id, name, origin, destination, is_active, seed_tag, seed_batch_id, notes)
      VALUES (p_event_id, v_stage.id, 'ROTA-'||v_sede||'-'||v_stage.slug||'-COMP-ALO-'||lpad(v_seq::text,3,'0'),
              v_venue.name, 'ALOJ-'||v_sede||'-'||v_stage.slug||'-'||lpad(v_seq::text,3,'0'),
              true, v_tag, v_batch, 'Competição → alojamento')
      RETURNING id INTO v_route_comp_alo;

      INSERT INTO public.transport_routes(event_id, event_stage_id, name, origin, destination, is_active, seed_tag, seed_batch_id, notes)
      VALUES (p_event_id, v_stage.id, 'ROTA-'||v_sede||'-'||v_stage.slug||'-ALO-INT-'||lpad(v_seq::text,3,'0'),
              'ALOJ-'||v_sede||'-'||v_stage.slug||'-'||lpad(v_seq::text,3,'0'), 'Município de origem',
              true, v_tag, v_batch, 'Alojamento → interior')
      RETURNING id INTO v_route_alo_int;

      v_stage_cnt := jsonb_set(v_stage_cnt,'{routes}', to_jsonb((v_stage_cnt->>'routes')::int+4));
    END LOOP;

    -- ===== VIAGENS =====
    DECLARE
      v_routes uuid[];
      v_route_id uuid;
      v_vehicles uuid[];
      v_veh_idx int := 0;
      v_n_trips int := 0;
    BEGIN
      SELECT array_agg(id ORDER BY name) INTO v_vehicles
        FROM public.transport_vehicles WHERE event_id=p_event_id AND seed_tag=v_tag;

      FOR v_deleg IN SELECT id FROM public.delegations WHERE event_id=p_event_id ORDER BY school_name LOOP
        FOR v_route_id IN
          SELECT id FROM public.transport_routes
           WHERE event_id=p_event_id AND seed_tag=v_tag
           ORDER BY name
           LIMIT 4
        LOOP
          v_veh_idx := (v_veh_idx % array_length(v_vehicles,1)) + 1;
          INSERT INTO public.transport_trips(
            event_id, event_stage_id, route_id, vehicle_id, driver_name, scheduled_at, status, trip_status,
            notes, created_by, seed_tag, seed_batch_id
          )
          VALUES (
            p_event_id, v_stage.id, v_route_id, v_vehicles[v_veh_idx], 'Motorista Seed',
            COALESCE(v_stage.starts_at, now()) + (v_n_trips || ' minutes')::interval,
            'scheduled', 'scheduled', 'Viagem seed (etapa '||v_stage.name||')', v_user, v_tag, v_batch
          );
          v_n_trips := v_n_trips + 1;
        END LOOP;
      END LOOP;
      v_stage_cnt := jsonb_set(v_stage_cnt,'{trips}', to_jsonb(v_n_trips));
    END;

    v_processed := v_processed + 1;
    v_stage_results := v_stage_results || jsonb_build_object(
      'stage_id', v_stage.id, 'stage_name', v_stage.name, 'seed_tag', v_tag,
      'status', 'created', 'counts', v_stage_cnt
    );

    INSERT INTO public.audit_events(table_name, record_id, action, payload, created_by)
    VALUES ('logistics_seed', v_stage.id, 'seed_all_stages',
            jsonb_build_object('event_id', p_event_id, 'stage_id', v_stage.id, 'seed_tag', v_tag, 'counts', v_stage_cnt), v_user);
  END LOOP;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'stages_total', v_n_stages,
    'stages_processed', v_processed,
    'stages_skipped', v_skipped,
    'results', v_stage_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seed_logistics_all_stages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_logistics_all_stages(uuid) TO authenticated;

-- ============================================================
-- LIMPAR seed de TODAS as etapas
-- ============================================================
CREATE OR REPLACE FUNCTION public.clear_logistics_seed_all_stages(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pattern text := 'seed:logistica:stage:%';
  v_d_trips int; v_d_routes int; v_d_vehicles int;
  v_d_mw int; v_d_mt int;
  v_d_units int; v_d_locs int;
BEGIN
  IF NOT public.has_role(v_user, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permissão negada: apenas admin pode limpar seed de logística';
  END IF;

  WITH d AS (DELETE FROM public.transport_trips     WHERE event_id=p_event_id AND seed_tag LIKE v_pattern RETURNING 1) SELECT count(*) INTO v_d_trips FROM d;
  WITH d AS (DELETE FROM public.transport_routes    WHERE event_id=p_event_id AND seed_tag LIKE v_pattern RETURNING 1) SELECT count(*) INTO v_d_routes FROM d;
  WITH d AS (DELETE FROM public.transport_vehicles  WHERE event_id=p_event_id AND seed_tag LIKE v_pattern RETURNING 1) SELECT count(*) INTO v_d_vehicles FROM d;
  WITH d AS (DELETE FROM public.meal_windows        WHERE event_id=p_event_id AND seed_tag LIKE v_pattern RETURNING 1) SELECT count(*) INTO v_d_mw FROM d;
  WITH d AS (DELETE FROM public.meal_types          WHERE event_id=p_event_id AND seed_tag LIKE v_pattern RETURNING 1) SELECT count(*) INTO v_d_mt FROM d;
  WITH d AS (DELETE FROM public.lodging_units       WHERE event_id=p_event_id AND seed_tag LIKE v_pattern RETURNING 1) SELECT count(*) INTO v_d_units FROM d;
  WITH d AS (DELETE FROM public.lodging_locations   WHERE event_id=p_event_id AND seed_tag LIKE v_pattern RETURNING 1) SELECT count(*) INTO v_d_locs FROM d;

  INSERT INTO public.audit_events(table_name, record_id, action, payload, created_by)
  VALUES ('logistics_seed', p_event_id, 'clear_all_stages',
          jsonb_build_object('trips',v_d_trips,'routes',v_d_routes,'vehicles',v_d_vehicles,
                             'meal_windows',v_d_mw,'meal_types',v_d_mt,'lodging_units',v_d_units,'lodging_locations',v_d_locs),
          v_user);

  RETURN jsonb_build_object(
    'ok', true,
    'deleted', jsonb_build_object(
      'transport_trips', v_d_trips,
      'transport_routes', v_d_routes,
      'transport_vehicles', v_d_vehicles,
      'meal_windows', v_d_mw,
      'meal_types', v_d_mt,
      'lodging_units', v_d_units,
      'lodging_locations', v_d_locs
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.clear_logistics_seed_all_stages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_logistics_seed_all_stages(uuid) TO authenticated;