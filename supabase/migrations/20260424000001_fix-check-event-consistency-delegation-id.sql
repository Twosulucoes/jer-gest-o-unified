-- Fix: check_event_consistency() accessed NEW.delegation_id before checking TG_TABLE_NAME,
-- causing "record new has no field delegation_id" on participant_sport_events inserts.
-- PL/pgSQL does not guarantee short-circuit evaluation of AND, so nested IFs are required.
CREATE OR REPLACE FUNCTION public.check_event_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'participants' THEN
    IF NEW.delegation_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.delegations WHERE id = NEW.delegation_id AND event_id = NEW.event_id) THEN
        RAISE EXCEPTION 'A delegação informada não pertence ao mesmo evento do participante.';
      END IF;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'participant_sport_events' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.participants p
      JOIN public.sport_events se ON se.event_id = p.event_id
      WHERE p.id = NEW.participant_id AND se.id = NEW.sport_event_id
    ) THEN
      RAISE EXCEPTION 'A prova/modalidade informada não pertence ao evento do participante.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
