-- 1) Add updated_by to competition_match_results
ALTER TABLE public.competition_match_results
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- 2) Create match_results_history table
CREATE TABLE IF NOT EXISTS public.match_results_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.competition_matches(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  action_type text NOT NULL -- 'insert', 'update', 'delete'
);

-- 3) Create match_penalty_shots table
CREATE TABLE IF NOT EXISTS public.match_penalty_shots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.competition_matches(id) ON DELETE CASCADE,
  match_entry_id uuid REFERENCES public.competition_match_entries(id) ON DELETE CASCADE,
  team_side text, -- 'A' or 'B'
  ordem integer NOT NULL,
  participant_id uuid REFERENCES public.participants(id),
  convertido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- 4) RLS for match_results_history
ALTER TABLE public.match_results_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access match_results_history"
  ON public.match_results_history FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Coord tec full access match_results_history"
  ON public.match_results_history FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica')) WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'));

CREATE POLICY "Others read-only match_results_history"
  ON public.match_results_history FOR SELECT TO authenticated
  USING (true);

-- 5) RLS for match_penalty_shots
ALTER TABLE public.match_penalty_shots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access match_penalty_shots"
  ON public.match_penalty_shots FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Coord tec full access match_penalty_shots"
  ON public.match_penalty_shots FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica')) WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'));

CREATE POLICY "Mesario can manage match_penalty_shots"
  ON public.match_penalty_shots FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'mesario')) WITH CHECK (has_role(auth.uid(), 'mesario'));

CREATE POLICY "Others read-only match_penalty_shots"
  ON public.match_penalty_shots FOR SELECT TO authenticated
  USING (true);

-- 6) Trigger to preencher updated_by/updated_at em cada edição de competition_match_results
CREATE OR REPLACE FUNCTION public.handle_cmr_audit()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_audit_cmr
  BEFORE UPDATE ON public.competition_match_results
  FOR EACH ROW EXECUTE FUNCTION public.handle_cmr_audit();

