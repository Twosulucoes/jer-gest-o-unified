CREATE OR REPLACE FUNCTION public.clone_logistics_between_stages(
  p_source_stage_id uuid,
  p_target_stage_id uuid,
  p_include_lodging boolean DEFAULT true,
  p_include_meals boolean DEFAULT true,
  p_include_transport boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_event uuid;
  v_target_event uuid;
  v_loc_count int := 0;
  v_unit_count int := 0;
  v_meal_type_count int := 0;
  v_meal_window_count int := 0;
  v_vehicle_count int := 0;
  v_route_count int := 0;
  v_loc_map jsonb := '{}'::jsonb;
  v_meal_type_map jsonb := '{}'::jsonb;
  r record;
  v_new_id uuid;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria')) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  IF p_source_stage_id = p_target_stage_id THEN
    RAISE EXCEPTION 'Etapa origem e destino não podem ser iguais';
  END IF;

  SELECT event_id INTO v_source_event FROM event_stages WHERE id = p_source_stage_id;
  SELECT event_id INTO v_target_event FROM event_stages WHERE id = p_target_stage_id;

  IF v_source_event IS NULL OR v_target_event IS NULL THEN
    RAISE EXCEPTION 'Etapa não encontrada';
  END IF;
  IF v_source_event <> v_target_event THEN
    RAISE EXCEPTION 'Clonagem só é permitida entre etapas do mesmo evento';
  END IF;

  -- ALOJAMENTO
  IF p_include_lodging THEN
    FOR r IN SELECT * FROM lodging_locations WHERE event_stage_id = p_source_stage_id LOOP
      v_new_id := gen_random_uuid();
      INSERT INTO lodging_locations (id, event_id, event_stage_id, name, address, notes, is_active)
      VALUES (v_new_id, v_target_event, p_target_stage_id, r.name, r.address, r.notes, r.is_active);
      v_loc_map := v_loc_map || jsonb_build_object(r.id::text, v_new_id::text);
      v_loc_count := v_loc_count + 1;
    END LOOP;

    FOR r IN SELECT * FROM lodging_units WHERE event_stage_id = p_source_stage_id LOOP
      INSERT INTO lodging_units (
        event_id, event_stage_id, location_id, name, capacity,
        gender_restriction, notes, is_active, is_accessible,
        accessible_features_json, gender_zone, min_age_policy
      )
      VALUES (
        v_target_event, p_target_stage_id,
        (v_loc_map ->> r.location_id::text)::uuid,
        r.name, r.capacity, r.gender_restriction, r.notes, r.is_active,
        r.is_accessible, r.accessible_features_json, r.gender_zone, r.min_age_policy
      );
      v_unit_count := v_unit_count + 1;
    END LOOP;
  END IF;

  -- ALIMENTAÇÃO
  IF p_include_meals THEN
    FOR r IN SELECT * FROM meal_types WHERE event_stage_id = p_source_stage_id LOOP
      v_new_id := gen_random_uuid();
      INSERT INTO meal_types (id, event_id, event_stage_id, name, slug, sort_order, is_active)
      VALUES (v_new_id, v_target_event, p_target_stage_id, r.name, r.slug, r.sort_order, r.is_active);
      v_meal_type_map := v_meal_type_map || jsonb_build_object(r.id::text, v_new_id::text);
      v_meal_type_count := v_meal_type_count + 1;
    END LOOP;

    FOR r IN SELECT * FROM meal_windows WHERE event_stage_id = p_source_stage_id LOOP
      INSERT INTO meal_windows (
        event_id, event_stage_id, meal_type_id, label,
        service_date, start_time, end_time, location, is_active
      )
      VALUES (
        v_target_event, p_target_stage_id,
        COALESCE((v_meal_type_map ->> r.meal_type_id::text)::uuid, r.meal_type_id),
        r.label, r.service_date, r.start_time, r.end_time, r.location, r.is_active
      );
      v_meal_window_count := v_meal_window_count + 1;
    END LOOP;
  END IF;

  -- TRANSPORTE
  IF p_include_transport THEN
    FOR r IN SELECT * FROM transport_vehicles WHERE event_stage_id = p_source_stage_id LOOP
      INSERT INTO transport_vehicles (
        event_id, event_stage_id, plate, label, capacity, vehicle_type, is_active
      )
      VALUES (
        v_target_event, p_target_stage_id,
        r.plate, r.label, r.capacity, r.vehicle_type, r.is_active
      );
      v_vehicle_count := v_vehicle_count + 1;
    END LOOP;

    FOR r IN SELECT * FROM transport_routes WHERE event_stage_id = p_source_stage_id LOOP
      INSERT INTO transport_routes (
        event_id, event_stage_id, name, origin, destination, notes, is_active
      )
      VALUES (
        v_target_event, p_target_stage_id,
        r.name, r.origin, r.destination, r.notes, r.is_active
      );
      v_route_count := v_route_count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'lodging_locations', v_loc_count,
    'lodging_units', v_unit_count,
    'meal_types', v_meal_type_count,
    'meal_windows', v_meal_window_count,
    'vehicles', v_vehicle_count,
    'routes', v_route_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.clone_logistics_between_stages(uuid, uuid, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clone_logistics_between_stages(uuid, uuid, boolean, boolean, boolean) TO authenticated;