
-- =============================================
-- INSTITUTIONS
-- =============================================
CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  official_name text,
  slug text NOT NULL,
  network_type text NOT NULL DEFAULT 'municipal',
  city text,
  state char(2),
  district text,
  contact_name text,
  contact_phone text,
  contact_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT institutions_state_check CHECK (state IS NULL OR state ~ '^[A-Z]{2}$')
);

CREATE UNIQUE INDEX institutions_slug_key ON public.institutions (slug);
CREATE INDEX idx_institutions_name ON public.institutions (name);

CREATE TRIGGER set_institutions_updated_at
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access institutions"
  ON public.institutions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Secretaria can read institutions"
  ON public.institutions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Secretaria can insert institutions"
  ON public.institutions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Secretaria can update institutions"
  ON public.institutions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Coordenacao tecnica can read institutions"
  ON public.institutions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'));

-- =============================================
-- DELEGATIONS
-- =============================================
CREATE TABLE public.delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  chief_name text,
  chief_phone text,
  chief_email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delegations_status_check
    CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled'))
);

CREATE UNIQUE INDEX delegations_event_institution_key
  ON public.delegations (event_id, institution_id);
CREATE INDEX idx_delegations_event_id
  ON public.delegations (event_id);
CREATE INDEX idx_delegations_institution_id
  ON public.delegations (institution_id);

CREATE TRIGGER set_delegations_updated_at
  BEFORE UPDATE ON public.delegations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.delegations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access delegations"
  ON public.delegations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Secretaria can read delegations"
  ON public.delegations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Secretaria can insert delegations"
  ON public.delegations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Secretaria can update delegations"
  ON public.delegations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Coordenacao tecnica can read delegations"
  ON public.delegations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'));
