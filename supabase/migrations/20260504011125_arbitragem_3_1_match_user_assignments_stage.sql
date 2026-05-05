-- ============================================================
-- Etapa 3.1 — Lei de Escopo em match_user_assignments
-- ============================================================
-- Auditoria: docs/modulos/arbitros-auditoria.md (Etapa 3)
--
-- match_user_assignments é o quadrante "Operação" do quadro
-- Pessoas/Inscrição/Operação/Competição. Hoje só tem event_id;
-- toda query que filtra por etapa precisa de JOIN em
-- competition_matches. Esta migração denormaliza event_stage_id
-- com trigger que mantém a consistência.
--
-- Coluna fica NULLABLE porque competition_matches.event_stage_id
-- é nullable. Quando o match não tem stage, a designação também
-- não. NOT NULL aspiracional: depende de uma migração futura que
-- torne competition_matches.event_stage_id NOT NULL para todo o
-- domínio (fora do escopo desta auditoria de arbitragem).
-- ============================================================

-- 1. Coluna + FK
ALTER TABLE public.match_user_assignments
  ADD COLUMN IF NOT EXISTS event_stage_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'match_user_assignments_event_stage_id_fkey'
  ) THEN
    ALTER TABLE public.match_user_assignments
      ADD CONSTRAINT match_user_assignments_event_stage_id_fkey
      FOREIGN KEY (event_stage_id) REFERENCES public.event_stages(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS match_user_assignments_event_stage_idx
  ON public.match_user_assignments(event_stage_id)
  WHERE event_stage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS match_user_assignments_user_event_stage_idx
  ON public.match_user_assignments(user_id, event_id, event_stage_id);

-- 2. Backfill (idempotente)
UPDATE public.match_user_assignments mua
SET event_stage_id = cm.event_stage_id
FROM public.competition_matches cm
WHERE mua.match_id = cm.id
  AND mua.event_stage_id IS DISTINCT FROM cm.event_stage_id;

-- 3. Trigger de sync: BEFORE INSERT/UPDATE deriva event_stage_id
--    de competition_matches.event_stage_id quando o match_id muda
--    ou quando o caller não preencheu event_stage_id.
CREATE OR REPLACE FUNCTION public.sync_match_user_assignments_stage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.match_id IS NULL THEN
    NEW.event_stage_id := NULL;
    RETURN NEW;
  END IF;

  -- Casos em que devemos rederivar:
  --  (a) INSERT
  --  (b) UPDATE com mudança de match_id
  --  (c) caller passou event_stage_id NULL mas o match tem stage
  IF (TG_OP = 'INSERT')
     OR (NEW.match_id IS DISTINCT FROM OLD.match_id)
     OR (NEW.event_stage_id IS NULL) THEN
    SELECT cm.event_stage_id
      INTO NEW.event_stage_id
      FROM public.competition_matches cm
      WHERE cm.id = NEW.match_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_match_user_assignments_stage
  ON public.match_user_assignments;
CREATE TRIGGER trg_sync_match_user_assignments_stage
  BEFORE INSERT OR UPDATE OF match_id, event_stage_id ON public.match_user_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_match_user_assignments_stage();

COMMENT ON COLUMN public.match_user_assignments.event_stage_id IS
  'Denormalização de competition_matches.event_stage_id (Etapa 3.1 da auditoria de arbitragem). Mantida em sync por trigger sync_match_user_assignments_stage. Nullable enquanto competition_matches.event_stage_id também for; NOT NULL aspiracional para o futuro.';
