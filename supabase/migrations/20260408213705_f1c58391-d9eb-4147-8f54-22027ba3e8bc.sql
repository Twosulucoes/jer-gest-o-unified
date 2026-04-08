
-- ============================================
-- FOOD SERVICE MODULE — MINIMAL VIABLE TABLES
-- ============================================

-- 1. Meal Types
CREATE TABLE public.meal_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_meal_type_slug_event ON public.meal_types (event_id, slug);

CREATE TRIGGER update_meal_types_updated_at
  BEFORE UPDATE ON public.meal_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Meal Windows (service windows)
CREATE TABLE public.meal_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  meal_type_id uuid NOT NULL REFERENCES public.meal_types(id) ON DELETE CASCADE,
  label text,
  service_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_meal_windows_updated_at
  BEFORE UPDATE ON public.meal_windows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Meal Consumptions
CREATE TABLE public.meal_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_window_id uuid NOT NULL REFERENCES public.meal_windows(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  registered_by uuid NOT NULL REFERENCES auth.users(id),
  method text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate consumption in same window
CREATE UNIQUE INDEX uq_meal_consumption_participant_window 
  ON public.meal_consumptions (meal_window_id, participant_id);

-- ============================================
-- RLS POLICIES
-- ============================================

-- meal_types
ALTER TABLE public.meal_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access meal_types" ON public.meal_types FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage meal_types" ON public.meal_types FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Alimentacao can read meal_types" ON public.meal_types FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'alimentacao'));
CREATE POLICY "Coordenacao tecnica can read meal_types" ON public.meal_types FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'));

-- meal_windows
ALTER TABLE public.meal_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access meal_windows" ON public.meal_windows FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage meal_windows" ON public.meal_windows FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Alimentacao can read meal_windows" ON public.meal_windows FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'alimentacao'));
CREATE POLICY "Coordenacao tecnica can read meal_windows" ON public.meal_windows FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'));

-- meal_consumptions
ALTER TABLE public.meal_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access meal_consumptions" ON public.meal_consumptions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage meal_consumptions" ON public.meal_consumptions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Alimentacao can read meal_consumptions" ON public.meal_consumptions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'alimentacao'));
CREATE POLICY "Alimentacao can insert meal_consumptions" ON public.meal_consumptions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'alimentacao') AND registered_by = auth.uid());
CREATE POLICY "Coordenacao tecnica can read meal_consumptions" ON public.meal_consumptions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'));
