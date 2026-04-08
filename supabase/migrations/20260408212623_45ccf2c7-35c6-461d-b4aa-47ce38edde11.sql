
-- ============================================
-- TRANSPORT MODULE — MINIMAL VIABLE TABLES
-- ============================================

-- 1. Vehicles
CREATE TABLE public.transport_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  plate text NOT NULL,
  label text,
  capacity integer NOT NULL DEFAULT 0,
  vehicle_type text NOT NULL DEFAULT 'bus',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_transport_vehicle_plate_event ON public.transport_vehicles (event_id, plate);

CREATE TRIGGER update_transport_vehicles_updated_at
  BEFORE UPDATE ON public.transport_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Routes
CREATE TABLE public.transport_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  origin text,
  destination text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_transport_routes_updated_at
  BEFORE UPDATE ON public.transport_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Trips
CREATE TABLE public.transport_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE RESTRICT,
  vehicle_id uuid REFERENCES public.transport_vehicles(id) ON DELETE SET NULL,
  driver_name text,
  driver_phone text,
  scheduled_at timestamptz,
  departed_at timestamptz,
  arrived_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_transport_trips_updated_at
  BEFORE UPDATE ON public.transport_trips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Passengers (boarding manifest)
CREATE TABLE public.transport_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.transport_trips(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'boarded',
  boarded_at timestamptz DEFAULT now(),
  boarded_by uuid REFERENCES auth.users(id),
  alighted_at timestamptz,
  alighted_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate active boarding on same trip
CREATE UNIQUE INDEX uq_transport_passenger_active ON public.transport_passengers (trip_id, participant_id)
  WHERE status NOT IN ('cancelled', 'no_show');

CREATE TRIGGER update_transport_passengers_updated_at
  BEFORE UPDATE ON public.transport_passengers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================

-- transport_vehicles
ALTER TABLE public.transport_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access transport_vehicles" ON public.transport_vehicles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage transport_vehicles" ON public.transport_vehicles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Transporte can read transport_vehicles" ON public.transport_vehicles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'transporte'));
CREATE POLICY "Coordenacao tecnica can read transport_vehicles" ON public.transport_vehicles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'));

-- transport_routes
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access transport_routes" ON public.transport_routes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage transport_routes" ON public.transport_routes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Transporte can read transport_routes" ON public.transport_routes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'transporte'));
CREATE POLICY "Coordenacao tecnica can read transport_routes" ON public.transport_routes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'));

-- transport_trips
ALTER TABLE public.transport_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access transport_trips" ON public.transport_trips FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage transport_trips" ON public.transport_trips FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Transporte can read transport_trips" ON public.transport_trips FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'transporte'));
CREATE POLICY "Transporte can insert transport_trips" ON public.transport_trips FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'transporte'));
CREATE POLICY "Transporte can update transport_trips" ON public.transport_trips FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'transporte')) WITH CHECK (has_role(auth.uid(), 'transporte'));
CREATE POLICY "Coordenacao tecnica can read transport_trips" ON public.transport_trips FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'));

-- transport_passengers
ALTER TABLE public.transport_passengers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access transport_passengers" ON public.transport_passengers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage transport_passengers" ON public.transport_passengers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Transporte can read transport_passengers" ON public.transport_passengers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'transporte'));
CREATE POLICY "Transporte can insert transport_passengers" ON public.transport_passengers FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'transporte'));
CREATE POLICY "Transporte can update transport_passengers" ON public.transport_passengers FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'transporte')) WITH CHECK (has_role(auth.uid(), 'transporte'));
CREATE POLICY "Coordenacao tecnica can read transport_passengers" ON public.transport_passengers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'));
