
-- Tabela people
CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  birth_date date NOT NULL,
  gender text NOT NULL DEFAULT 'male',
  cpf text,
  rg text,
  email text,
  phone text,
  photo_url text,
  food_restrictions text,
  medical_notes text,
  disability_type text,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT people_gender_check CHECK (gender IN ('male', 'female')),
  CONSTRAINT people_birth_date_check CHECK (birth_date <= CURRENT_DATE)
);

-- Índices
CREATE UNIQUE INDEX idx_people_cpf ON public.people (cpf) WHERE cpf IS NOT NULL;
CREATE INDEX idx_people_institution_id ON public.people (institution_id);
CREATE INDEX idx_people_full_name ON public.people (full_name);

-- Trigger updated_at
CREATE TRIGGER set_people_updated_at
  BEFORE UPDATE ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies
CREATE POLICY "Admin full access people"
  ON public.people FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Secretaria can read people"
  ON public.people FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Secretaria can insert people"
  ON public.people FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Secretaria can update people"
  ON public.people FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Coordenacao tecnica can read people"
  ON public.people FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'));
