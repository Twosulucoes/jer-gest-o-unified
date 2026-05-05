-- ============================================================
-- Etapa 3.2 — Lei de Escopo no schema arbitragem.*
-- ============================================================
-- Auditoria: docs/modulos/arbitros-auditoria.md (Etapa 3)
--
-- Aplica a mesma denormalização de event_stage_id em:
--   - arbitragem.match_officials  (tem match_id)
--   - arbitragem.results          (tem match_id)
--
-- Excluídas propositalmente (catálogo de evento, sem match_id):
--   - arbitragem.officials
--   - arbitragem.result_files (vinculada a result, indireto)
--   - arbitragem.result_responsibles (idem)
--   - arbitragem.submission_events (idem)
--
-- Mesma característica de 3.1: coluna NULLABLE até que
-- competition_matches.event_stage_id seja NOT NULL.
-- ============================================================

-- ============================================================
-- A) arbitragem.match_officials
-- ============================================================

ALTER TABLE arbitragem.match_officials
  ADD COLUMN IF NOT EXISTS event_stage_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'arbitragem_match_officials_event_stage_id_fkey'
  ) THEN
    ALTER TABLE arbitragem.match_officials
      ADD CONSTRAINT arbitragem_match_officials_event_stage_id_fkey
      FOREIGN KEY (event_stage_id) REFERENCES public.event_stages(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS arbitragem_match_officials_event_stage_idx
  ON arbitragem.match_officials(event_stage_id)
  WHERE event_stage_id IS NOT NULL;

UPDATE arbitragem.match_officials mo
SET event_stage_id = cm.event_stage_id
FROM public.competition_matches cm
WHERE mo.match_id = cm.id
  AND mo.event_stage_id IS DISTINCT FROM cm.event_stage_id;

CREATE OR REPLACE FUNCTION arbitragem.sync_match_officials_stage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, arbitragem AS $$
BEGIN
  IF NEW.match_id IS NULL THEN
    NEW.event_stage_id := NULL;
    RETURN NEW;
  END IF;

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

DROP TRIGGER IF EXISTS trg_sync_arbitragem_match_officials_stage
  ON arbitragem.match_officials;
CREATE TRIGGER trg_sync_arbitragem_match_officials_stage
  BEFORE INSERT OR UPDATE OF match_id, event_stage_id ON arbitragem.match_officials
  FOR EACH ROW
  EXECUTE FUNCTION arbitragem.sync_match_officials_stage();

COMMENT ON COLUMN arbitragem.match_officials.event_stage_id IS
  'Denormalização de competition_matches.event_stage_id (Etapa 3.2 da auditoria de arbitragem). Mantida em sync por trigger.';

-- ============================================================
-- B) arbitragem.results
-- ============================================================

ALTER TABLE arbitragem.results
  ADD COLUMN IF NOT EXISTS event_stage_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'arbitragem_results_event_stage_id_fkey'
  ) THEN
    ALTER TABLE arbitragem.results
      ADD CONSTRAINT arbitragem_results_event_stage_id_fkey
      FOREIGN KEY (event_stage_id) REFERENCES public.event_stages(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS arbitragem_results_event_stage_idx
  ON arbitragem.results(event_stage_id)
  WHERE event_stage_id IS NOT NULL;

UPDATE arbitragem.results r
SET event_stage_id = cm.event_stage_id
FROM public.competition_matches cm
WHERE r.match_id = cm.id
  AND r.event_stage_id IS DISTINCT FROM cm.event_stage_id;

CREATE OR REPLACE FUNCTION arbitragem.sync_results_stage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, arbitragem AS $$
BEGIN
  IF NEW.match_id IS NULL THEN
    NEW.event_stage_id := NULL;
    RETURN NEW;
  END IF;

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

DROP TRIGGER IF EXISTS trg_sync_arbitragem_results_stage
  ON arbitragem.results;
CREATE TRIGGER trg_sync_arbitragem_results_stage
  BEFORE INSERT OR UPDATE OF match_id, event_stage_id ON arbitragem.results
  FOR EACH ROW
  EXECUTE FUNCTION arbitragem.sync_results_stage();

COMMENT ON COLUMN arbitragem.results.event_stage_id IS
  'Denormalização de competition_matches.event_stage_id (Etapa 3.2 da auditoria de arbitragem). Mantida em sync por trigger.';
