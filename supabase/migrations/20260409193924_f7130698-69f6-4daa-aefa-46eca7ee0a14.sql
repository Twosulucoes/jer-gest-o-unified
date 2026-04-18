
-- 1. Adicionar sport_event_id em competition_matches
ALTER TABLE public.competition_matches
  ADD COLUMN sport_event_id uuid REFERENCES public.sport_events(id);

-- 2. Preencher sport_event_id nos registros existentes a partir da fase
UPDATE public.competition_matches cm
SET sport_event_id = cp.sport_event_id
FROM public.competition_phases cp
WHERE cm.phase_id = cp.id
  AND cm.sport_event_id IS NULL;

-- 3. Criar índice para performance
CREATE INDEX idx_competition_matches_sport_event_id ON public.competition_matches(sport_event_id);

-- 4. Trigger: auto-preencher sport_event_id a partir da fase
CREATE OR REPLACE FUNCTION public.auto_fill_match_sport_event_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.sport_event_id IS NULL AND NEW.phase_id IS NOT NULL THEN
    SELECT sport_event_id INTO NEW.sport_event_id
    FROM public.competition_phases
    WHERE id = NEW.phase_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_fill_match_sport_event
  BEFORE INSERT OR UPDATE ON public.competition_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_match_sport_event_id();

-- 5. Trigger: validar consistência de evento em match_entries
CREATE OR REPLACE FUNCTION public.validate_match_entry_event_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_match_event_id uuid;
  v_pse_event_id uuid;
  v_participant_event_id uuid;
BEGIN
  -- Obter event_id da partida
  SELECT event_id INTO v_match_event_id
  FROM public.competition_matches
  WHERE id = NEW.match_id;

  -- Obter event_id do participant via sport_event
  SELECT se.event_id INTO v_pse_event_id
  FROM public.participant_sport_events pse
  JOIN public.sport_events se ON se.id = pse.sport_event_id
  WHERE pse.id = NEW.participant_sport_event_id;

  IF v_match_event_id IS DISTINCT FROM v_pse_event_id THEN
    RAISE EXCEPTION 'match event_id (%) does not match participant_sport_event event_id (%)',
      v_match_event_id, v_pse_event_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_match_entry_event
  BEFORE INSERT OR UPDATE ON public.competition_match_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_match_entry_event_consistency();
