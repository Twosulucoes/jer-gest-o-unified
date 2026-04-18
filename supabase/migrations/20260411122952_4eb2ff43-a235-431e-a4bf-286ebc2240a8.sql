
-- 1) Função de validação para inscrições individuais (participant_sport_events)
CREATE OR REPLACE FUNCTION public.validate_participation_limit_pse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_event_id uuid;
  v_sport_id uuid;
  v_is_collective boolean;
  v_is_paralympic boolean;
  v_count_individual int;
  v_limit int;
BEGIN
  SELECT se.event_id, se.sport_id
    INTO v_event_id, v_sport_id
  FROM public.sport_events se
  WHERE se.id = NEW.sport_event_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'sport_event inválido' USING ERRCODE = '23514';
  END IF;

  SELECT s.is_collective, s.is_paralympic
    INTO v_is_collective, v_is_paralympic
  FROM public.sports s
  WHERE s.id = v_sport_id;

  -- Só validar inscrições individuais
  IF v_is_collective THEN
    RETURN NEW;
  END IF;

  -- Contar inscrições individuais existentes (BEFORE INSERT, NEW ainda não está na tabela)
  SELECT COUNT(*)
    INTO v_count_individual
  FROM public.participant_sport_events pse
  JOIN public.sport_events se2 ON se2.id = pse.sport_event_id
  JOIN public.sports s2 ON s2.id = se2.sport_id
  WHERE pse.participant_id = NEW.participant_id
    AND se2.event_id = v_event_id
    AND s2.is_collective = false;

  IF v_is_paralympic THEN
    v_limit := 1; -- JERPA: 1 individual
  ELSE
    v_limit := 2; -- JER: 2 individuais
  END IF;

  -- count é o existente; se já >= limit, bloquear
  IF v_count_individual >= v_limit THEN
    RAISE EXCEPTION 'Limite de participação excedido (individuais): permitido=%, já inscrito=%',
      v_limit, v_count_individual
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Função de validação para inscrição coletiva (team_members)
CREATE OR REPLACE FUNCTION public.validate_participation_limit_team_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_event_id uuid;
  v_sport_id uuid;
  v_is_collective boolean;
  v_is_paralympic boolean;
  v_count_collective int;
BEGIN
  SELECT se.event_id, se.sport_id
    INTO v_event_id, v_sport_id
  FROM public.teams t
  JOIN public.sport_events se ON se.id = t.sport_event_id
  WHERE t.id = NEW.team_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'team inválido / sport_event inválido' USING ERRCODE = '23514';
  END IF;

  SELECT s.is_collective, s.is_paralympic
    INTO v_is_collective, v_is_paralympic
  FROM public.sports s
  WHERE s.id = v_sport_id;

  -- Só aplicar para esportes coletivos
  IF NOT v_is_collective THEN
    RETURN NEW;
  END IF;

  -- JERPA coletivo: sem regra definida ainda
  IF v_is_paralympic THEN
    RETURN NEW;
  END IF;

  -- Contar equipes coletivas JER do participante no evento (BEFORE INSERT)
  SELECT COUNT(DISTINCT t2.id)
    INTO v_count_collective
  FROM public.team_members tm
  JOIN public.teams t2 ON t2.id = tm.team_id
  JOIN public.sport_events se2 ON se2.id = t2.sport_event_id
  JOIN public.sports s2 ON s2.id = se2.sport_id
  WHERE tm.participant_id = NEW.participant_id
    AND se2.event_id = v_event_id
    AND s2.is_collective = true
    AND s2.is_paralympic = false;

  -- JER: máximo 1 coletiva
  IF v_count_collective >= 1 THEN
    RAISE EXCEPTION 'Limite de participação excedido (coletivas): permitido=1, já inscrito=%',
      v_count_collective
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Triggers
DROP TRIGGER IF EXISTS trg_validate_participation_limit_pse ON public.participant_sport_events;
CREATE TRIGGER trg_validate_participation_limit_pse
  BEFORE INSERT ON public.participant_sport_events
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_participation_limit_pse();

DROP TRIGGER IF EXISTS trg_validate_participation_limit_team_member ON public.team_members;
CREATE TRIGGER trg_validate_participation_limit_team_member
  BEFORE INSERT ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_participation_limit_team_member();
