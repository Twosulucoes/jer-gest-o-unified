-- Create lodging_incidents in public schema
CREATE TABLE IF NOT EXISTS public.lodging_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES public.lodging_locations(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
    severity TEXT NOT NULL DEFAULT 'baixa' CHECK (severity IN ('baixa','media','alta')),
    category TEXT NOT NULL DEFAULT 'geral' CHECK (category IN ('geral','disciplina','saude','patrimonio','seguranca')),
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_atendimento','resolvida')),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for lodging_incidents
ALTER TABLE public.lodging_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Secretaria full access lodging_incidents" 
ON public.lodging_incidents FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'secretaria'::public.app_role));

CREATE POLICY "Alojamento can read lodging_incidents" 
ON public.lodging_incidents FOR SELECT TO authenticated 
USING (public.has_role(auth.uid(), 'alojamento'::public.app_role));

CREATE POLICY "Alojamento can insert lodging_incidents" 
ON public.lodging_incidents FOR INSERT TO authenticated 
WITH CHECK (public.has_role(auth.uid(), 'alojamento'::public.app_role) AND created_by = auth.uid());

-- ─────────────────────────────────────────
-- Refactor RPCs to use public schema
-- ─────────────────────────────────────────

-- 1. get_alojamento_person_detail
CREATE OR REPLACE FUNCTION public.get_alojamento_person_detail(
  p_participant_id uuid,
  p_facility_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_occupancy   record;
  v_loc_name    text;
  v_unit        record;
BEGIN
  -- Current active stay/occupancy
  SELECT o.id, o.checked_in_at, o.unit_id, o.checked_in_location_id, o.status
  INTO v_occupancy
  FROM public.lodging_occupancies o
  WHERE o.participant_id = p_participant_id AND o.status = 'checked_in'
  LIMIT 1;

  -- Location name
  IF v_occupancy.id IS NOT NULL THEN
    SELECT name INTO v_loc_name
    FROM public.lodging_locations
    WHERE id = COALESCE(v_occupancy.checked_in_location_id, (SELECT location_id FROM public.lodging_units WHERE id = v_occupancy.unit_id));
  END IF;

  -- Unit (Room)
  IF v_occupancy.unit_id IS NOT NULL OR v_occupancy.checked_in_unit_id IS NOT NULL THEN
    SELECT name, floor
    INTO v_unit
    FROM public.lodging_units
    WHERE id = COALESCE(v_occupancy.checked_in_unit_id, v_occupancy.unit_id);
  END IF;

  RETURN jsonb_build_object(
    'is_checked_in',  v_occupancy.id IS NOT NULL,
    'stay_checkin_at', v_occupancy.checked_in_at,
    'facility_name',   v_loc_name,
    'bed_code',        NULL, -- Not using bed granularity in public
    'room_code',       v_unit.name,
    'block_name',      v_unit.floor
  );
END;
$$;

-- 2. get_alojamento_ocupacao (Simplified as public doesn't have Blocks)
CREATE OR REPLACE FUNCTION public.get_alojamento_ocupacao(p_facility_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',       u.id,
      'code',     u.name,
      'capacity', u.capacity,
      'occupied', (
        SELECT COUNT(*)
        FROM public.lodging_occupancies o
        WHERE o.unit_id = u.id AND o.status = 'checked_in'
      )
    ) ORDER BY u.name
  )
  INTO v_result
  FROM public.lodging_units u
  WHERE u.location_id = p_facility_id AND u.is_active = true;

  -- Wrap in a single dummy block for PWA compatibility if it expects blocks
  RETURN jsonb_build_array(jsonb_build_object(
    'id',            p_facility_id,
    'name',          'Quartos',
    'gender_policy', 'misto',
    'rooms',         COALESCE(v_result, '[]'::jsonb)
  ));
END;
$$;

-- 3. get_alojamento_incidents
CREATE OR REPLACE FUNCTION public.get_alojamento_incidents(
  p_facility_id uuid,
  p_status      text DEFAULT 'aberta'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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
  FROM public.lodging_incidents
  WHERE location_id = p_facility_id AND status = p_status
  LIMIT 50;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 4. create_alojamento_incident
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
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.lodging_incidents (location_id, severity, category, description, created_by)
  VALUES (p_facility_id, p_severity, p_category, p_description, p_created_by);
END;
$$;

-- 5. get_alojamento_duplicates
CREATE OR REPLACE FUNCTION public.get_alojamento_duplicates(p_facility_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(row_to_json(d))
  INTO v_result
  FROM (
    SELECT
      o.participant_id AS person_id,
      pe.full_name AS person_name,
      jsonb_agg(DISTINCT COALESCE(u.name, '?')) AS rooms
    FROM public.lodging_occupancies o
    JOIN public.lodging_units u ON u.id = o.unit_id
    JOIN public.participants p ON p.id = o.participant_id
    JOIN public.people pe       ON pe.id = p.person_id
    WHERE (u.location_id = p_facility_id OR o.checked_in_location_id = p_facility_id) 
      AND o.status = 'checked_in'
    GROUP BY o.participant_id, pe.full_name
    HAVING COUNT(DISTINCT o.id) > 1
  ) d;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
