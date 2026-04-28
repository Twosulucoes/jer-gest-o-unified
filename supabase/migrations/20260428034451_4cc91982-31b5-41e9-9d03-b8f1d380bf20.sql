CREATE OR REPLACE FUNCTION public.get_alojamento_kpis(p_facility_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_hospedados    int;
  v_checkins_hoje int;
  v_checkouts_hoje int;
  v_total_capacity int;
  v_planned       int;
  v_today         date := current_date;
BEGIN
  -- 1. Checked-in people (actually present)
  SELECT COUNT(*) INTO v_hospedados
  FROM public.lodging_occupancies
  WHERE (unit_id IN (SELECT id FROM public.lodging_units WHERE location_id = p_facility_id) 
         OR checked_in_location_id = p_facility_id)
    AND status = 'checked_in';

  -- 2. Check-ins today
  SELECT COUNT(*) INTO v_checkins_hoje
  FROM public.lodging_occupancies
  WHERE (unit_id IN (SELECT id FROM public.lodging_units WHERE location_id = p_facility_id) 
         OR checked_in_location_id = p_facility_id)
    AND status = 'checked_in'
    AND checked_in_at >= v_today::timestamptz;

  -- 3. Check-outs today
  SELECT COUNT(*) INTO v_checkouts_hoje
  FROM public.lodging_occupancies
  WHERE (unit_id IN (SELECT id FROM public.lodging_units WHERE location_id = p_facility_id) 
         OR checked_in_location_id = p_facility_id)
    AND status = 'checked_out'
    AND checked_out_at >= v_today::timestamptz;

  -- 4. Total capacity
  SELECT COALESCE(SUM(capacity), 0) INTO v_total_capacity
  FROM public.lodging_units
  WHERE location_id = p_facility_id AND is_active = true;

  -- 5. Planned (allocated but not yet checked-in)
  SELECT COUNT(*) INTO v_planned
  FROM public.lodging_occupancies
  WHERE unit_id IN (SELECT id FROM public.lodging_units WHERE location_id = p_facility_id)
    AND status = 'planned';

  RETURN jsonb_build_object(
    'hospedados',      v_hospedados,
    'checkins_hoje',   v_checkins_hoje,
    'checkouts_hoje',  v_checkouts_hoje,
    'total_beds',      v_total_capacity,
    'assigned_beds',   v_hospedados + v_planned,
    'reserved_beds',   v_planned
  );
END;
$$;
