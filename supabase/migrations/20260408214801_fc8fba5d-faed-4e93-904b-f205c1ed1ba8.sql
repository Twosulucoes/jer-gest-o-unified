
-- =============================================
-- LODGING LOCATIONS
-- =============================================
CREATE TABLE public.lodging_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lodging_locations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_lodging_locations_updated_at
  BEFORE UPDATE ON public.lodging_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admin full access lodging_locations" ON public.lodging_locations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage lodging_locations" ON public.lodging_locations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Coordenacao tecnica can read lodging_locations" ON public.lodging_locations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'));

-- =============================================
-- LODGING UNITS
-- =============================================
CREATE TABLE public.lodging_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.lodging_locations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  capacity integer NOT NULL DEFAULT 1,
  gender_restriction text NOT NULL DEFAULT 'mixed',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lodging_units ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_lodging_units_updated_at
  BEFORE UPDATE ON public.lodging_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admin full access lodging_units" ON public.lodging_units FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage lodging_units" ON public.lodging_units FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Coordenacao tecnica can read lodging_units" ON public.lodging_units FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'));

-- =============================================
-- LODGING OCCUPANCIES
-- =============================================
CREATE TABLE public.lodging_occupancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.lodging_units(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'allocated',
  checked_in_at timestamptz,
  checked_in_by uuid,
  checked_out_at timestamptz,
  checked_out_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lodging_occupancies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_lodging_occupancies_updated_at
  BEFORE UPDATE ON public.lodging_occupancies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Unique partial index: one active occupancy per participant per event
CREATE UNIQUE INDEX uq_lodging_active_occupancy
  ON public.lodging_occupancies (event_id, participant_id)
  WHERE status IN ('allocated', 'checked_in');

-- Trigger: enforce unit capacity
CREATE OR REPLACE FUNCTION public.validate_lodging_capacity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_capacity integer;
  v_current integer;
BEGIN
  SELECT capacity INTO v_capacity FROM public.lodging_units WHERE id = NEW.unit_id;

  SELECT count(*) INTO v_current
    FROM public.lodging_occupancies
    WHERE unit_id = NEW.unit_id
      AND status IN ('allocated', 'checked_in')
      AND id IS DISTINCT FROM NEW.id;

  IF v_current >= v_capacity THEN
    RAISE EXCEPTION 'Unit capacity (%) reached. Cannot allocate more participants.', v_capacity;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_lodging_capacity
  BEFORE INSERT OR UPDATE ON public.lodging_occupancies
  FOR EACH ROW
  WHEN (NEW.status IN ('allocated', 'checked_in'))
  EXECUTE FUNCTION public.validate_lodging_capacity();

-- RLS policies
CREATE POLICY "Admin full access lodging_occupancies" ON public.lodging_occupancies FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage lodging_occupancies" ON public.lodging_occupancies FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Coordenacao tecnica can read lodging_occupancies" ON public.lodging_occupancies FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'));
