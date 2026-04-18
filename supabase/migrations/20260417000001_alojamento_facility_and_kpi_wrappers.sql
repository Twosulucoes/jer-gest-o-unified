-- Public wrapper: list active facilities from alojamento schema
CREATE OR REPLACE FUNCTION public.list_alojamento_facilities()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name)
  INTO result
  FROM alojamento.facilities
  WHERE active = true;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_alojamento_facilities() TO authenticated;

-- Public wrapper: KPIs for a facility
CREATE OR REPLACE FUNCTION public.get_alojamento_kpis(p_facility_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hospedados    int;
  v_checkins_hoje int;
  v_checkouts_hoje int;
  v_total_beds    int;
  v_assigned_beds int;
  v_today         date := current_date;
BEGIN
  SELECT COUNT(*) INTO v_hospedados
  FROM alojamento.stays
  WHERE facility_id = p_facility_id AND status = 'hospedado';

  SELECT COUNT(*) INTO v_checkins_hoje
  FROM alojamento.stays
  WHERE facility_id = p_facility_id
    AND checkin_at >= v_today::timestamptz;

  SELECT COUNT(*) INTO v_checkouts_hoje
  FROM alojamento.stays
  WHERE facility_id = p_facility_id
    AND status = 'finalizado'
    AND checkout_at >= v_today::timestamptz;

  SELECT COUNT(*) INTO v_total_beds
  FROM alojamento.beds b
  JOIN alojamento.rooms r ON r.id = b.room_id
  JOIN alojamento.blocks bl ON bl.id = r.block_id
  WHERE bl.facility_id = p_facility_id AND b.active = true;

  SELECT COUNT(*) INTO v_assigned_beds
  FROM alojamento.assignments a
  JOIN alojamento.beds b ON b.id = a.bed_id
  JOIN alojamento.rooms r ON r.id = b.room_id
  JOIN alojamento.blocks bl ON bl.id = r.block_id
  WHERE bl.facility_id = p_facility_id AND a.active = true;

  RETURN jsonb_build_object(
    'hospedados',      v_hospedados,
    'checkins_hoje',   v_checkins_hoje,
    'checkouts_hoje',  v_checkouts_hoje,
    'total_beds',      GREATEST(v_total_beds, 1),
    'assigned_beds',   v_assigned_beds
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_alojamento_kpis(uuid) TO authenticated;
