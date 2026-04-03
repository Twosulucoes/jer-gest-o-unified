
-- Função de validação cruzada delegation ↔ event
CREATE OR REPLACE FUNCTION public.validate_participant_delegation_event()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.delegations
    WHERE id = NEW.delegation_id AND event_id = NEW.event_id
  ) THEN
    RAISE EXCEPTION 'delegation_id % does not belong to event_id %',
      NEW.delegation_id, NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Tabela participants
CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  delegation_id uuid NOT NULL REFERENCES public.delegations(id) ON DELETE CASCADE,
  participant_type text NOT NULL DEFAULT 'athlete'
    CHECK (participant_type IN ('athlete', 'coach', 'head_of_delegation', 'official', 'staff')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rejected')),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_participant_person_event UNIQUE (person_id, event_id)
);

-- Índices
CREATE INDEX idx_participants_person_id ON public.participants (person_id);
CREATE INDEX idx_participants_event_id ON public.participants (event_id);
CREATE INDEX idx_participants_delegation_id ON public.participants (delegation_id);

-- Trigger updated_at
CREATE TRIGGER set_participants_updated_at
  BEFORE UPDATE ON public.participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger validação cruzada
CREATE TRIGGER trg_validate_participant_delegation_event
  BEFORE INSERT OR UPDATE ON public.participants
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_participant_delegation_event();

-- RLS policies
CREATE POLICY "Admin full access participants"
  ON public.participants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Secretaria can read participants"
  ON public.participants FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Secretaria can insert participants"
  ON public.participants FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Secretaria can update participants"
  ON public.participants FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Coordenacao tecnica can read participants"
  ON public.participants FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'));
