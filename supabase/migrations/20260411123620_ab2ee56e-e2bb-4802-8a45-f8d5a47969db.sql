
-- 1) Função de validação de elegibilidade para entries
CREATE OR REPLACE FUNCTION public.validate_match_entry_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_event_id uuid;
  v_participant_id uuid;
  v_invalid_count int;
  v_pse_status text;
BEGIN
  -- Caso 1: entry individual
  IF NEW.participant_sport_event_id IS NOT NULL THEN
    SELECT pse.participant_id, pse.status, se.event_id
      INTO v_participant_id, v_pse_status, v_event_id
    FROM public.participant_sport_events pse
    JOIN public.sport_events se ON se.id = pse.sport_event_id
    WHERE pse.id = NEW.participant_sport_event_id;

    IF v_event_id IS NULL OR v_participant_id IS NULL THEN
      RAISE EXCEPTION 'Entry individual inválida (PSE não encontrado)' USING ERRCODE = '23514';
    END IF;

    IF v_pse_status NOT IN ('confirmed','approved') THEN
      RAISE EXCEPTION 'Inscrição não aprovada/confirmada para esta prova' USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.participant_credentials pc
      WHERE pc.participant_id = v_participant_id
        AND pc.event_id = v_event_id
        AND pc.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Participante sem credencial ativa para este evento' USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
  END IF;

  -- Caso 2: entry coletiva
  IF NEW.team_id IS NOT NULL THEN
    SELECT se.event_id
      INTO v_event_id
    FROM public.teams t
    JOIN public.sport_events se ON se.id = t.sport_event_id
    WHERE t.id = NEW.team_id;

    IF v_event_id IS NULL THEN
      RAISE EXCEPTION 'Entry coletiva inválida (team/sport_event não encontrado)' USING ERRCODE = '23514';
    END IF;

    SELECT COUNT(*)
      INTO v_invalid_count
    FROM public.team_members tm
    LEFT JOIN public.participant_credentials pc
      ON pc.participant_id = tm.participant_id
     AND pc.event_id = v_event_id
     AND pc.status = 'active'
    WHERE tm.team_id = NEW.team_id
      AND tm.is_active = true
      AND pc.id IS NULL;

    IF v_invalid_count > 0 THEN
      RAISE EXCEPTION 'Equipe possui membros sem credencial ativa (% sem credencial)', v_invalid_count
        USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Entry inválida: informe team_id ou participant_sport_event_id'
    USING ERRCODE = '23514';
END;
$$;

-- 2) Triggers
DROP TRIGGER IF EXISTS trg_validate_match_entry_eligibility_ins ON public.competition_match_entries;
CREATE TRIGGER trg_validate_match_entry_eligibility_ins
  BEFORE INSERT ON public.competition_match_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_match_entry_eligibility();

DROP TRIGGER IF EXISTS trg_validate_match_entry_eligibility_upd ON public.competition_match_entries;
CREATE TRIGGER trg_validate_match_entry_eligibility_upd
  BEFORE UPDATE OF team_id, participant_sport_event_id ON public.competition_match_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_match_entry_eligibility();
