
CREATE TABLE public.competition_match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.competition_matches(id) ON DELETE CASCADE,
  match_entry_id uuid NOT NULL REFERENCES public.competition_match_entries(id) ON DELETE CASCADE,
  score text,
  position integer,
  result_text text,
  result_status text NOT NULL DEFAULT 'resultado_lancado',
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  validated_by uuid,
  validated_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_entry_id)
);

ALTER TABLE public.competition_match_results ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_competition_match_results_updated_at
  BEFORE UPDATE ON public.competition_match_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admin full access competition_match_results"
  ON public.competition_match_results FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Secretaria can manage competition_match_results"
  ON public.competition_match_results FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Coordenacao tecnica can manage competition_match_results"
  ON public.competition_match_results FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica')) WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'));
