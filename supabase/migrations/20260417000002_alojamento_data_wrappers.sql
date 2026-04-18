-- Public wrappers for alojamento schema data queries
-- Required because supabase-js cannot access non-public schemas via .schema()

-- ─────────────────────────────────────────
-- Person detail (stays + assignment + bed)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_alojamento_person_detail(
  p_participant_id uuid,
  p_facility_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stay       record;
  v_fac_name   text;
  v_assignment record;
  v_bed        record;
BEGIN
  -- Current active stay
  SELECT id, checkin_at, facility_id
  INTO v_stay
  FROM alojamento.stays
  WHERE person_id = p_participant_id AND status = 'hospedado'
  LIMIT 1;

  -- Facility name
  IF v_stay.facility_id IS NOT NULL THEN
    SELECT name INTO v_fac_name
    FROM alojamento.facilities
    WHERE id = v_stay.facility_id;
  END IF;

  -- Active bed assignment
  SELECT bed_id INTO v_assignment
  FROM alojamento.assignments
  WHERE person_id = p_participant_id AND active = true
  LIMIT 1;

  -- Bed / room / block
  IF v_assignment.bed_id IS NOT NULL THEN
    SELECT b.bed_code, r.code AS room_code, bl.name AS block_name
    INTO v_bed
    FROM alojamento.beds b
    JOIN alojamento.rooms r  ON r.id  = b.room_id
    JOIN alojamento.blocks bl ON bl.id = r.block_id
    WHERE b.id = v_assignment.bed_id;
  END IF;

  RETURN jsonb_build_object(
    'is_checked_in',  v_stay.id IS NOT NULL,
    'stay_checkin_at', v_stay.checkin_at,
    'facility_name',   v_fac_name,
    'bed_code',        v_bed.bed_code,
    'room_code',       v_bed.room_code,
    'block_name',      v_bed.block_name
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_alojamento_person_detail(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────
-- Ocupação: blocks → rooms with bed counts
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_alojamento_ocupacao(p_facility_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_block  record;
  v_rooms  jsonb;
BEGIN
  FOR v_block IN
    SELECT id, name, gender_policy
    FROM alojamento.blocks
    WHERE facility_id = p_facility_id AND active = true
    ORDER BY name
  LOOP
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',       r.id,
        'code',     r.code,
        'capacity', r.capacity,
        'occupied', (
          SELECT COUNT(*)
          FROM alojamento.beds b
          JOIN alojamento.assignments a ON a.bed_id = b.id AND a.active = true
          WHERE b.room_id = r.id AND b.active = true
        )
      ) ORDER BY r.code
    )
    INTO v_rooms
    FROM alojamento.rooms r
    WHERE r.block_id = v_block.id AND r.active = true;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'id',            v_block.id,
      'name',          v_block.name,
      'gender_policy', v_block.gender_policy,
      'rooms',         COALESCE(v_rooms, '[]'::jsonb)
    ));
  END LOOP;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_alojamento_ocupacao(uuid) TO authenticated;

-- ─────────────────────────────────────────
-- Incidents: list by facility + status
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_alojamento_incidents(
  p_facility_id uuid,
  p_status      text DEFAULT 'aberta'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',          id,
      'severity',    severity,
      'category',    category,
      'description', description,
      'status',      status,
      'created_at',  created_at
    ) ORDER BY created_at DESC
  )
  INTO v_result
  FROM alojamento.incidents
  WHERE facility_id = p_facility_id AND status = p_status
  LIMIT 50;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_alojamento_incidents(uuid, text) TO authenticated;

-- ─────────────────────────────────────────
-- Incidents: create
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_alojamento_incident(
  p_facility_id uuid,
  p_severity    text,
  p_category    text,
  p_description text,
  p_created_by  uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO alojamento.incidents (facility_id, severity, category, description, created_by)
  VALUES (p_facility_id, p_severity, p_category, p_description, p_created_by);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_alojamento_incident(uuid, text, text, text, uuid) TO authenticated;

-- ─────────────────────────────────────────
-- Duplicate stays alert
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_alojamento_duplicates(p_facility_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(row_to_json(d))
  INTO v_result
  FROM (
    SELECT
      s.person_id,
      pe.full_name AS person_name,
      jsonb_agg(DISTINCT COALESCE(r.code, '?')) AS rooms
    FROM alojamento.stays s
    JOIN alojamento.assignments asgn ON asgn.person_id = s.person_id AND asgn.active = true
    JOIN alojamento.beds b   ON b.id  = asgn.bed_id
    JOIN alojamento.rooms r  ON r.id  = b.room_id
    JOIN public.participants p ON p.id = s.person_id
    JOIN public.people pe       ON pe.id = p.person_id
    WHERE s.facility_id = p_facility_id AND s.status = 'hospedado'
    GROUP BY s.person_id, pe.full_name
    HAVING COUNT(DISTINCT r.id) > 1
  ) d;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_alojamento_duplicates(uuid) TO authenticated;
