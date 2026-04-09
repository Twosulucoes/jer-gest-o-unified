
-- Table for individual player statistics per match
CREATE TABLE public.match_player_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.competition_matches(id) ON DELETE CASCADE,
  match_lineup_id uuid NOT NULL REFERENCES public.match_lineups(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  stat_key text NOT NULL,
  stat_value numeric NOT NULL DEFAULT 0,
  period integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, match_lineup_id, stat_key, period)
);

-- RLS
ALTER TABLE public.match_player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access match_player_stats"
  ON public.match_player_stats FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Coordenacao tecnica can manage match_player_stats"
  ON public.match_player_stats FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica')) WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'));

CREATE POLICY "Secretaria can manage match_player_stats"
  ON public.match_player_stats FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));

-- Trigger updated_at
CREATE TRIGGER update_match_player_stats_updated_at
  BEFORE UPDATE ON public.match_player_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for history queries by participant
CREATE INDEX idx_match_player_stats_participant ON public.match_player_stats(participant_id);
CREATE INDEX idx_match_player_stats_match ON public.match_player_stats(match_id);
