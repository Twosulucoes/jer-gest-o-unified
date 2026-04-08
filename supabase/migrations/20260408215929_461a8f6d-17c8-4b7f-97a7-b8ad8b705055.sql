
-- =============================================
-- COMPETITION PHASES
-- =============================================
CREATE TABLE public.competition_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_event_id uuid NOT NULL REFERENCES public.sport_events(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  phase_type text NOT NULL DEFAULT 'group',
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competition_phases ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_competition_phases_updated_at
  BEFORE UPDATE ON public.competition_phases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admin full access competition_phases" ON public.competition_phases FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage competition_phases" ON public.competition_phases FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Coordenacao tecnica can manage competition_phases" ON public.competition_phases FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica')) WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'));

-- =============================================
-- COMPETITION GROUPS
-- =============================================
CREATE TABLE public.competition_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES public.competition_phases(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competition_groups ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_competition_groups_updated_at
  BEFORE UPDATE ON public.competition_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admin full access competition_groups" ON public.competition_groups FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage competition_groups" ON public.competition_groups FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Coordenacao tecnica can manage competition_groups" ON public.competition_groups FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica')) WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'));

-- =============================================
-- COMPETITION MATCHES
-- =============================================
CREATE TABLE public.competition_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES public.competition_phases(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.competition_groups(id) ON DELETE SET NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  match_number integer,
  match_date date,
  start_time time,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competition_matches ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_competition_matches_updated_at
  BEFORE UPDATE ON public.competition_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admin full access competition_matches" ON public.competition_matches FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage competition_matches" ON public.competition_matches FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Coordenacao tecnica can manage competition_matches" ON public.competition_matches FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica')) WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'));

-- =============================================
-- COMPETITION MATCH ENTRIES
-- =============================================
CREATE TABLE public.competition_match_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.competition_matches(id) ON DELETE CASCADE,
  participant_sport_event_id uuid NOT NULL REFERENCES public.participant_sport_events(id) ON DELETE CASCADE,
  side text NOT NULL DEFAULT 'participant',
  seed integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, participant_sport_event_id)
);

ALTER TABLE public.competition_match_entries ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_competition_match_entries_updated_at
  BEFORE UPDATE ON public.competition_match_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admin full access competition_match_entries" ON public.competition_match_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage competition_match_entries" ON public.competition_match_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Coordenacao tecnica can manage competition_match_entries" ON public.competition_match_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica')) WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'));
