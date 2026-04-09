-- Create match_events table
CREATE TABLE public.match_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.competition_matches(id) ON DELETE CASCADE,
  match_entry_id uuid REFERENCES public.competition_match_entries(id) ON DELETE SET NULL,
  match_lineup_id uuid REFERENCES public.match_lineups(id) ON DELETE SET NULL,
  participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  event_key text NOT NULL,
  minute integer,
  period integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin full access match_events"
  ON public.match_events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria can manage match_events"
  ON public.match_events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role))
  WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Coordenacao tecnica can manage match_events"
  ON public.match_events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- updated_at trigger
CREATE TRIGGER update_match_events_updated_at
  BEFORE UPDATE ON public.match_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_match_events_match_id ON public.match_events(match_id);
