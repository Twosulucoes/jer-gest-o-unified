-- Seed inicial de logística por etapa (sem participantes)
CREATE OR REPLACE FUNCTION public.seed_logistics_stage_template(
  p_event_id uuid,
  p_stage_name text DEFAULT 'Etapa Modelo Logística',
  p_seed_tag text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_id uuid;
  v_stage_slug text := 'etapa-modelo-logistica';
  v_seed_tag text := COALESCE(p_seed_tag, 'seed:logistica:' || p_event_id::text);
  v_seed_batch_id uuid := gen_random_uuid();
  v_stage_start date;
  v_mt_cafe uuid;
  v_mt_almoco uuid;
  v_mt_jantar uuid;
  v_loc_a uuid;
  v_loc_b uuid;
  v_route_1 uuid;
  v_route_2 uuid;
  v_route_3 uuid;
  v_veh_1 uuid;
  v_veh_2 uuid;
  v_veh_3 uuid;
  v_n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id) THEN
    RAISE EXCEPTION 'Evento % não encontrado', p_event_id;
  END IF;

  SELECT COALESCE(e.start_date, CURRENT_DATE)
  INTO v_stage_start
  FROM public.events e
  WHERE e.id = p_event_id;

  -- 1) Garante etapa base de exemplo
  SELECT es.id
  INTO v_stage_id
  FROM public.event_stages es
  WHERE es.event_id = p_event_id
    AND es.slug = v_stage_slug
  LIMIT 1;

  IF v_stage_id IS NULL THEN
    INSERT INTO public.event_stages (
      event_id, name, slug, kind, status, sort_order, starts_at, ends_at
    )
    VALUES (
      p_event_id,
      p_stage_name,
      v_stage_slug,
      'regional',
      'draft',
      10,
      v_stage_start::timestamptz,
      (v_stage_start + INTERVAL '3 days')::timestamptz
    )
    RETURNING id INTO v_stage_id;
  END IF;

  -- 2) Limpa dados anteriores deste seed/tag para permitir reexecução idempotente
  DELETE FROM public.transport_trips WHERE event_id = p_event_id AND seed_tag = v_seed_tag;
  DELETE FROM public.transport_routes WHERE event_id = p_event_id AND seed_tag = v_seed_tag;
  DELETE FROM public.transport_vehicles WHERE event_id = p_event_id AND seed_tag = v_seed_tag;

  DELETE FROM public.meal_windows WHERE event_id = p_event_id AND seed_tag = v_seed_tag;
  DELETE FROM public.meal_types WHERE event_id = p_event_id AND seed_tag = v_seed_tag;

  DELETE FROM public.lodging_units WHERE event_id = p_event_id AND seed_tag = v_seed_tag;
  DELETE FROM public.lodging_locations WHERE event_id = p_event_id AND seed_tag = v_seed_tag;

  -- 3) Alojamento (estrutura)
  INSERT INTO public.lodging_locations (
    event_id, event_stage_id, name, address, notes, seed_tag, seed_batch_id
  ) VALUES
    (p_event_id, v_stage_id, 'Escola Estadual Monte Roraima', 'Av. Central, 1200', 'Alojamento masculino/feminino por bloco', v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, 'Escola Estadual Serra Grande', 'Rua das Palmeiras, 88', 'Reserva para delegações de apoio', v_seed_tag, v_seed_batch_id)
  RETURNING id;

  SELECT id INTO v_loc_a
  FROM public.lodging_locations
  WHERE event_id = p_event_id AND seed_tag = v_seed_tag
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id INTO v_loc_b
  FROM public.lodging_locations
  WHERE event_id = p_event_id AND seed_tag = v_seed_tag
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO public.lodging_units (
    event_id, event_stage_id, location_id, name, capacity, gender_restriction,
    is_accessible, notes, seed_tag, seed_batch_id
  ) VALUES
    (p_event_id, v_stage_id, v_loc_a, 'Bloco A - Quarto 01', 20, 'none', true, 'Prioridade PCD', v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, v_loc_a, 'Bloco A - Quarto 02', 24, 'none', false, NULL, v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, v_loc_a, 'Bloco B - Quarto 03', 24, 'none', false, NULL, v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, v_loc_b, 'Bloco C - Quarto 01', 18, 'none', false, NULL, v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, v_loc_b, 'Bloco C - Quarto 02', 18, 'none', false, NULL, v_seed_tag, v_seed_batch_id);

  -- 4) Alimentação (tipos e janelas)
  INSERT INTO public.meal_types (
    event_id, event_stage_id, name, slug, sort_order, seed_tag, seed_batch_id
  ) VALUES
    (p_event_id, v_stage_id, 'Café da Manhã', 'cafe-da-manha', 1, v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, 'Almoço', 'almoco', 2, v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, 'Jantar', 'jantar', 3, v_seed_tag, v_seed_batch_id)
  RETURNING id;

  SELECT id INTO v_mt_cafe FROM public.meal_types WHERE event_id = p_event_id AND seed_tag = v_seed_tag AND slug = 'cafe-da-manha' LIMIT 1;
  SELECT id INTO v_mt_almoco FROM public.meal_types WHERE event_id = p_event_id AND seed_tag = v_seed_tag AND slug = 'almoco' LIMIT 1;
  SELECT id INTO v_mt_jantar FROM public.meal_types WHERE event_id = p_event_id AND seed_tag = v_seed_tag AND slug = 'jantar' LIMIT 1;

  INSERT INTO public.meal_windows (
    event_id, event_stage_id, meal_type_id, service_date, start_time, end_time, location,
    label, seed_tag, seed_batch_id
  )
  SELECT p_event_id, v_stage_id, v_mt_cafe, d::date, '06:30', '08:30', 'Refeitório Central', 'Café', v_seed_tag, v_seed_batch_id
  FROM generate_series(v_stage_start, v_stage_start + INTERVAL '2 days', INTERVAL '1 day') d
  UNION ALL
  SELECT p_event_id, v_stage_id, v_mt_almoco, d::date, '11:30', '13:30', 'Refeitório Central', 'Almoço', v_seed_tag, v_seed_batch_id
  FROM generate_series(v_stage_start, v_stage_start + INTERVAL '2 days', INTERVAL '1 day') d
  UNION ALL
  SELECT p_event_id, v_stage_id, v_mt_jantar, d::date, '18:00', '20:00', 'Refeitório Central', 'Jantar', v_seed_tag, v_seed_batch_id
  FROM generate_series(v_stage_start, v_stage_start + INTERVAL '2 days', INTERVAL '1 day') d;

  -- 5) Transporte (veículos, rotas, viagens)
  INSERT INTO public.transport_vehicles (
    event_id, event_stage_id, plate, vehicle_type, capacity, label, seed_tag, seed_batch_id
  ) VALUES
    (p_event_id, v_stage_id, 'RRD-1A23', 'bus', 46, 'Ônibus 01', v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, 'RRD-1A24', 'bus', 46, 'Ônibus 02', v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, 'RRD-9B10', 'van', 16, 'Van Apoio', v_seed_tag, v_seed_batch_id)
  RETURNING id;

  SELECT id INTO v_veh_1 FROM public.transport_vehicles WHERE event_id = p_event_id AND seed_tag = v_seed_tag AND plate = 'RRD-1A23' LIMIT 1;
  SELECT id INTO v_veh_2 FROM public.transport_vehicles WHERE event_id = p_event_id AND seed_tag = v_seed_tag AND plate = 'RRD-1A24' LIMIT 1;
  SELECT id INTO v_veh_3 FROM public.transport_vehicles WHERE event_id = p_event_id AND seed_tag = v_seed_tag AND plate = 'RRD-9B10' LIMIT 1;

  INSERT INTO public.transport_routes (
    event_id, event_stage_id, name, origin, destination, notes, seed_tag, seed_batch_id
  ) VALUES
    (p_event_id, v_stage_id, 'Rota A - Alojamento → Arena', 'Escola Monte Roraima', 'Arena Principal', 'Primeiro turno', v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, 'Rota B - Alojamento → Ginásio', 'Escola Serra Grande', 'Ginásio Poliesportivo', 'Turno da manhã', v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, 'Rota C - Arena → Alojamento', 'Arena Principal', 'Escolas de Alojamento', 'Retorno noite', v_seed_tag, v_seed_batch_id)
  RETURNING id;

  SELECT id INTO v_route_1 FROM public.transport_routes WHERE event_id = p_event_id AND seed_tag = v_seed_tag AND name = 'Rota A - Alojamento → Arena' LIMIT 1;
  SELECT id INTO v_route_2 FROM public.transport_routes WHERE event_id = p_event_id AND seed_tag = v_seed_tag AND name = 'Rota B - Alojamento → Ginásio' LIMIT 1;
  SELECT id INTO v_route_3 FROM public.transport_routes WHERE event_id = p_event_id AND seed_tag = v_seed_tag AND name = 'Rota C - Arena → Alojamento' LIMIT 1;

  INSERT INTO public.transport_trips (
    event_id, event_stage_id, route_id, vehicle_id, scheduled_at, status, trip_status,
    driver_name, driver_phone, notes, seed_tag, seed_batch_id
  ) VALUES
    (p_event_id, v_stage_id, v_route_1, v_veh_1, (v_stage_start::timestamp + INTERVAL '06:30'), 'scheduled', 'scheduled', 'Carlos Silva', '(95) 99999-0101', 'Saída oficial manhã', v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, v_route_2, v_veh_2, (v_stage_start::timestamp + INTERVAL '07:00'), 'scheduled', 'scheduled', 'Ana Souza', '(95) 99999-0102', 'Delegações do bloco B', v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, v_route_3, v_veh_1, (v_stage_start::timestamp + INTERVAL '20:30'), 'scheduled', 'scheduled', 'Carlos Silva', '(95) 99999-0101', 'Retorno após finais', v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, v_route_1, v_veh_3, ((v_stage_start + INTERVAL '1 day')::timestamp + INTERVAL '06:30'), 'scheduled', 'scheduled', 'Pedro Lima', '(95) 99999-0103', 'Apoio logística', v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, v_route_2, v_veh_2, ((v_stage_start + INTERVAL '1 day')::timestamp + INTERVAL '07:00'), 'scheduled', 'scheduled', 'Ana Souza', '(95) 99999-0102', NULL, v_seed_tag, v_seed_batch_id),
    (p_event_id, v_stage_id, v_route_3, v_veh_1, ((v_stage_start + INTERVAL '1 day')::timestamp + INTERVAL '20:30'), 'scheduled', 'scheduled', 'Carlos Silva', '(95) 99999-0101', NULL, v_seed_tag, v_seed_batch_id);

  SELECT COUNT(*) INTO v_n
  FROM public.transport_trips
  WHERE event_id = p_event_id AND seed_tag = v_seed_tag;

  RETURN jsonb_build_object(
    'ok', true,
    'event_id', p_event_id,
    'event_stage_id', v_stage_id,
    'seed_tag', v_seed_tag,
    'seed_batch_id', v_seed_batch_id,
    'counts', jsonb_build_object(
      'lodging_locations', (SELECT COUNT(*) FROM public.lodging_locations WHERE event_id = p_event_id AND seed_tag = v_seed_tag),
      'lodging_units', (SELECT COUNT(*) FROM public.lodging_units WHERE event_id = p_event_id AND seed_tag = v_seed_tag),
      'meal_types', (SELECT COUNT(*) FROM public.meal_types WHERE event_id = p_event_id AND seed_tag = v_seed_tag),
      'meal_windows', (SELECT COUNT(*) FROM public.meal_windows WHERE event_id = p_event_id AND seed_tag = v_seed_tag),
      'transport_vehicles', (SELECT COUNT(*) FROM public.transport_vehicles WHERE event_id = p_event_id AND seed_tag = v_seed_tag),
      'transport_routes', (SELECT COUNT(*) FROM public.transport_routes WHERE event_id = p_event_id AND seed_tag = v_seed_tag),
      'transport_trips', v_n
    ),
    'note', 'Seed de logística criado sem participantes. Cliente pode editar os dados livremente.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seed_logistics_stage_template(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_logistics_stage_template(uuid, text, text) TO authenticated;
