
-- 1. Create match_lineups table
CREATE TABLE public.match_lineups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.competition_matches(id) ON DELETE CASCADE,
  match_entry_id uuid NOT NULL REFERENCES public.competition_match_entries(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  jersey_number integer,
  position text,
  is_starter boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_entry_id, team_member_id)
);

-- 2. Enable RLS
ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
CREATE POLICY "Admin full access match_lineups"
  ON public.match_lineups FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria can manage match_lineups"
  ON public.match_lineups FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role))
  WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Coordenacao tecnica can manage match_lineups"
  ON public.match_lineups FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- 4. Updated_at trigger
CREATE TRIGGER update_match_lineups_updated_at
  BEFORE UPDATE ON public.match_lineups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Consistency trigger: team_member must belong to the same team as the entry
CREATE OR REPLACE FUNCTION public.validate_lineup_entry_consistency()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_entry_team_id uuid;
  v_member_team_id uuid;
  v_member_participant_id uuid;
BEGIN
  -- Get team_id from the entry
  SELECT team_id INTO v_entry_team_id
    FROM public.competition_match_entries WHERE id = NEW.match_entry_id;

  IF v_entry_team_id IS NULL THEN
    RAISE EXCEPTION 'match_entry_id % is not a team entry', NEW.match_entry_id;
  END IF;

  -- Get team_id and participant_id from the team_member
  SELECT team_id, participant_id INTO v_member_team_id, v_member_participant_id
    FROM public.team_members WHERE id = NEW.team_member_id;

  IF v_member_team_id IS DISTINCT FROM v_entry_team_id THEN
    RAISE EXCEPTION 'team_member % belongs to team %, not entry team %',
      NEW.team_member_id, v_member_team_id, v_entry_team_id;
  END IF;

  -- Ensure participant_id matches
  IF NEW.participant_id IS DISTINCT FROM v_member_participant_id THEN
    RAISE EXCEPTION 'participant_id % does not match team_member participant_id %',
      NEW.participant_id, v_member_participant_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_lineup_entry
  BEFORE INSERT OR UPDATE ON public.match_lineups
  FOR EACH ROW EXECUTE FUNCTION public.validate_lineup_entry_consistency();
