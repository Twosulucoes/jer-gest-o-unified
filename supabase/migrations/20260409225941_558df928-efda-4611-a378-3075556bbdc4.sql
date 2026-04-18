
-- Create match_attempts table
CREATE TABLE public.match_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.competition_matches(id) ON DELETE CASCADE,
  match_entry_id uuid NOT NULL REFERENCES public.competition_match_entries(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  value_cm bigint,
  value_ms bigint,
  value_points numeric,
  is_valid boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (match_entry_id, attempt_number)
);

-- Enable RLS
ALTER TABLE public.match_attempts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin full access match_attempts"
  ON public.match_attempts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coordenacao tecnica can manage match_attempts"
  ON public.match_attempts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

CREATE POLICY "Secretaria can manage match_attempts"
  ON public.match_attempts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role))
  WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

-- Index for fast lookup by match
CREATE INDEX idx_match_attempts_match_id ON public.match_attempts(match_id);

-- Updated_at trigger
CREATE TRIGGER update_match_attempts_updated_at
  BEFORE UPDATE ON public.match_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
