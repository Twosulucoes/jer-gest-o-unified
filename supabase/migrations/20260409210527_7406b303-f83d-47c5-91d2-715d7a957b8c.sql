
CREATE TABLE public.match_officials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.competition_matches(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'referee',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_officials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access match_officials"
  ON public.match_officials FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria can manage match_officials"
  ON public.match_officials FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role))
  WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Coordenacao tecnica can manage match_officials"
  ON public.match_officials FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

CREATE TRIGGER update_match_officials_updated_at
  BEFORE UPDATE ON public.match_officials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
