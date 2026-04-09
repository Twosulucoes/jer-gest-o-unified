
-- 1. Add match_config to sports
ALTER TABLE public.sports
  ADD COLUMN IF NOT EXISTS match_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Create match_scores table
CREATE TABLE public.match_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.competition_matches(id) ON DELETE CASCADE,
  match_entry_id uuid NOT NULL REFERENCES public.competition_match_entries(id) ON DELETE CASCADE,
  score_final text,
  score_detail jsonb,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_entry_id)
);

-- 3. Enable RLS
ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "Admin full access match_scores"
  ON public.match_scores FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria can manage match_scores"
  ON public.match_scores FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role))
  WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Coordenacao tecnica can manage match_scores"
  ON public.match_scores FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- 5. Updated_at trigger
CREATE TRIGGER update_match_scores_updated_at
  BEFORE UPDATE ON public.match_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
