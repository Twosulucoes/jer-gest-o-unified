-- ============================================================
-- FUNÇÃO: validação cruzada de event_id em sport_events
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_sport_event_references()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_sport_event_id uuid;
  v_category_event_id uuid;
BEGIN
  SELECT event_id INTO v_sport_event_id
    FROM public.sports WHERE id = NEW.sport_id;

  IF v_sport_event_id IS DISTINCT FROM NEW.event_id THEN
    RAISE EXCEPTION
      'sport_id % belongs to event %, not event %',
      NEW.sport_id, v_sport_event_id, NEW.event_id;
  END IF;

  SELECT event_id INTO v_category_event_id
    FROM public.categories WHERE id = NEW.category_id;

  IF v_category_event_id IS DISTINCT FROM NEW.event_id THEN
    RAISE EXCEPTION
      'category_id % belongs to event %, not event %',
      NEW.category_id, v_category_event_id, NEW.event_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- TABELA: sport_events (provas/disciplinas)
-- ============================================================
CREATE TABLE public.sport_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_sport_event UNIQUE (sport_id, category_id, event_id, slug)
);

ALTER TABLE public.sport_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_sport_events_event_id ON public.sport_events (event_id);
CREATE INDEX idx_sport_events_sport_id ON public.sport_events (sport_id);
CREATE INDEX idx_sport_events_category_id ON public.sport_events (category_id);

CREATE TRIGGER set_sport_events_updated_at
  BEFORE UPDATE ON public.sport_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_validate_sport_event_references
  BEFORE INSERT OR UPDATE ON public.sport_events
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_sport_event_references();

CREATE POLICY "Admin full access sport_events"
  ON public.sport_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Secretaria can read sport_events"
  ON public.sport_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Secretaria can insert sport_events"
  ON public.sport_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Secretaria can update sport_events"
  ON public.sport_events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Coordenacao tecnica can read sport_events"
  ON public.sport_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'));

-- ============================================================
-- FUNÇÃO: validação cruzada participant ↔ sport_event
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_pse_event_consistency()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_participant_event_id uuid;
  v_sport_event_event_id uuid;
BEGIN
  SELECT event_id INTO v_participant_event_id
    FROM public.participants WHERE id = NEW.participant_id;

  SELECT event_id INTO v_sport_event_event_id
    FROM public.sport_events WHERE id = NEW.sport_event_id;

  IF v_participant_event_id IS DISTINCT FROM v_sport_event_event_id THEN
    RAISE EXCEPTION
      'participant event_id (%) does not match sport_event event_id (%)',
      v_participant_event_id, v_sport_event_event_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- TABELA: participant_sport_events (inscrição na prova)
-- ============================================================
CREATE TABLE public.participant_sport_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  sport_event_id uuid NOT NULL REFERENCES public.sport_events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_participant_sport_event UNIQUE (participant_id, sport_event_id)
);

ALTER TABLE public.participant_sport_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pse_participant_id ON public.participant_sport_events (participant_id);
CREATE INDEX idx_pse_sport_event_id ON public.participant_sport_events (sport_event_id);

CREATE TRIGGER set_pse_updated_at
  BEFORE UPDATE ON public.participant_sport_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_validate_pse_event_consistency
  BEFORE INSERT OR UPDATE ON public.participant_sport_events
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pse_event_consistency();

CREATE POLICY "Admin full access participant_sport_events"
  ON public.participant_sport_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Secretaria can read participant_sport_events"
  ON public.participant_sport_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Secretaria can insert participant_sport_events"
  ON public.participant_sport_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Secretaria can update participant_sport_events"
  ON public.participant_sport_events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Coordenacao tecnica can read participant_sport_events"
  ON public.participant_sport_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'));