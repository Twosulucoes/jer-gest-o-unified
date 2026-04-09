
-- =============================================
-- BLOCO 1: Tabela teams
-- =============================================
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  sport_event_id uuid NOT NULL REFERENCES public.sport_events(id),
  delegation_id uuid NOT NULL REFERENCES public.delegations(id),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sport_event_id, delegation_id)
);

CREATE INDEX idx_teams_event_id ON public.teams(event_id);
CREATE INDEX idx_teams_sport_event_id ON public.teams(sport_event_id);
CREATE INDEX idx_teams_delegation_id ON public.teams(delegation_id);

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access teams"
  ON public.teams FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria can manage teams"
  ON public.teams FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role))
  WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Coordenacao tecnica can manage teams"
  ON public.teams FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- =============================================
-- BLOCO 1: Tabela team_members
-- =============================================
CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  role text DEFAULT 'titular',
  jersey_number integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, participant_id)
);

CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_participant_id ON public.team_members(participant_id);

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access team_members"
  ON public.team_members FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria can manage team_members"
  ON public.team_members FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role))
  WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Coordenacao tecnica can manage team_members"
  ON public.team_members FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- =============================================
-- BLOCO 2: Evolução de competition_match_entries
-- =============================================

-- Adicionar team_id nullable
ALTER TABLE public.competition_match_entries
  ADD COLUMN team_id uuid REFERENCES public.teams(id);

CREATE INDEX idx_competition_match_entries_team_id ON public.competition_match_entries(team_id);

-- Tornar participant_sport_event_id nullable (entries existentes já têm valor)
ALTER TABLE public.competition_match_entries
  ALTER COLUMN participant_sport_event_id DROP NOT NULL;

-- Constraint: exatamente um dos dois deve estar preenchido
ALTER TABLE public.competition_match_entries
  ADD CONSTRAINT chk_entry_individual_or_team
  CHECK (
    (participant_sport_event_id IS NOT NULL AND team_id IS NULL)
    OR
    (participant_sport_event_id IS NULL AND team_id IS NOT NULL)
  );

-- =============================================
-- BLOCO 3: Triggers de integridade
-- =============================================

-- Trigger: team.event_id deve ser compatível com sport_event.event_id
CREATE OR REPLACE FUNCTION public.validate_team_event_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_se_event_id uuid;
  v_del_event_id uuid;
BEGIN
  SELECT event_id INTO v_se_event_id
    FROM public.sport_events WHERE id = NEW.sport_event_id;

  IF v_se_event_id IS DISTINCT FROM NEW.event_id THEN
    RAISE EXCEPTION 'team event_id (%) does not match sport_event event_id (%)',
      NEW.event_id, v_se_event_id;
  END IF;

  SELECT event_id INTO v_del_event_id
    FROM public.delegations WHERE id = NEW.delegation_id;

  IF v_del_event_id IS DISTINCT FROM NEW.event_id THEN
    RAISE EXCEPTION 'team event_id (%) does not match delegation event_id (%)',
      NEW.event_id, v_del_event_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_team_event
  BEFORE INSERT OR UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_team_event_consistency();

-- Trigger: team_member participant deve pertencer ao mesmo evento da equipe
CREATE OR REPLACE FUNCTION public.validate_team_member_event_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_team_event_id uuid;
  v_participant_event_id uuid;
BEGIN
  SELECT event_id INTO v_team_event_id
    FROM public.teams WHERE id = NEW.team_id;

  SELECT event_id INTO v_participant_event_id
    FROM public.participants WHERE id = NEW.participant_id;

  IF v_team_event_id IS DISTINCT FROM v_participant_event_id THEN
    RAISE EXCEPTION 'team event_id (%) does not match participant event_id (%)',
      v_team_event_id, v_participant_event_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_team_member_event
  BEFORE INSERT OR UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_team_member_event_consistency();

-- Atualizar trigger de match_entry para suportar team_id
CREATE OR REPLACE FUNCTION public.validate_match_entry_event_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_match_event_id uuid;
  v_entry_event_id uuid;
BEGIN
  SELECT event_id INTO v_match_event_id
    FROM public.competition_matches WHERE id = NEW.match_id;

  IF NEW.participant_sport_event_id IS NOT NULL THEN
    SELECT se.event_id INTO v_entry_event_id
      FROM public.participant_sport_events pse
      JOIN public.sport_events se ON se.id = pse.sport_event_id
      WHERE pse.id = NEW.participant_sport_event_id;
  ELSIF NEW.team_id IS NOT NULL THEN
    SELECT event_id INTO v_entry_event_id
      FROM public.teams WHERE id = NEW.team_id;
  END IF;

  IF v_match_event_id IS DISTINCT FROM v_entry_event_id THEN
    RAISE EXCEPTION 'match event_id (%) does not match entry event_id (%)',
      v_match_event_id, v_entry_event_id;
  END IF;

  RETURN NEW;
END;
$$;
