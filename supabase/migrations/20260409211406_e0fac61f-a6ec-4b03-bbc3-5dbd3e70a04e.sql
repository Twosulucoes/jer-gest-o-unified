
CREATE TABLE public.match_penalties (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.competition_matches(id) ON DELETE CASCADE,
  match_entry_id uuid REFERENCES public.competition_match_entries(id) ON DELETE CASCADE,
  match_lineup_id uuid REFERENCES public.match_lineups(id) ON DELETE SET NULL,
  participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  penalty_key text NOT NULL,
  minute integer,
  period integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access match_penalties"
  ON public.match_penalties FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Coordenacao tecnica can manage match_penalties"
  ON public.match_penalties FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica')) WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'));

CREATE POLICY "Secretaria can manage match_penalties"
  ON public.match_penalties FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));

CREATE TRIGGER update_match_penalties_updated_at
  BEFORE UPDATE ON public.match_penalties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_match_penalties_match ON public.match_penalties(match_id);
CREATE INDEX idx_match_penalties_participant ON public.match_penalties(participant_id);
