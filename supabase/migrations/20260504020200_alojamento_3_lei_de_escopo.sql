-- ============================================================
-- Etapa 3 — Lei de Escopo + RLS + CHECKs no Alojamento
-- ============================================================
-- Auditoria: docs/modulos/alojamento-auditoria.md (Etapa 3)
--
-- Esta migração consolida os 7 achados 🔴 do banco identificados
-- na reauditoria de 2026-05-04:
--
-- A) event_stage_id NULLABLE em lodging_locations/units/occupancies.
-- B) lodging_audit_logs sem event_id nem event_stage_id.
-- C) lodging_presence_logs sem event_stage_id.
-- D) lodging_supervisions sem event_stage_id e RLS frouxa.
-- E) Sem CHECK constraints para enums.
--
-- Estratégia geral:
--  - Backfill via JOIN com tabelas relacionadas (units → locations,
--    occupancies → units, audit/presence/supervisions → units/locations).
--  - Para `lodging_locations`/`lodging_units` que não têm
--    "ascendente": usar heurística do primeiro stage ativo do evento.
--  - SET NOT NULL e VALIDATE CONSTRAINT em blocos com EXCEPTION
--    (mantém NOT VALID se houver dados legados que ainda violem,
--    para não bloquear deploy).
-- ============================================================

-- ============================================================
-- A) Backfill + NOT NULL em lodging_locations/units/occupancies
-- ============================================================

-- A.1 — Heurística para locations: primeiro stage ativo do evento.
WITH first_stage_per_event AS (
  SELECT DISTINCT ON (event_id) event_id, id AS stage_id
  FROM public.event_stages
  WHERE status IS NULL OR status != 'archived'
  ORDER BY event_id, COALESCE(starts_at, created_at) ASC NULLS LAST
)
UPDATE public.lodging_locations ll
SET event_stage_id = fs.stage_id
FROM first_stage_per_event fs
WHERE ll.event_id = fs.event_id AND ll.event_stage_id IS NULL;

-- A.2 — Units herdam de location quando location já tem stage.
UPDATE public.lodging_units u
SET event_stage_id = l.event_stage_id
FROM public.lodging_locations l
WHERE u.location_id = l.id
  AND u.event_stage_id IS NULL
  AND l.event_stage_id IS NOT NULL;

-- Fallback: units restantes pegam o primeiro stage do evento.
WITH first_stage_per_event AS (
  SELECT DISTINCT ON (event_id) event_id, id AS stage_id
  FROM public.event_stages
  WHERE status IS NULL OR status != 'archived'
  ORDER BY event_id, COALESCE(starts_at, created_at) ASC NULLS LAST
)
UPDATE public.lodging_units u
SET event_stage_id = fs.stage_id
FROM first_stage_per_event fs
WHERE u.event_id = fs.event_id AND u.event_stage_id IS NULL;

-- A.3 — Occupancies herdam de unit (relação direta).
UPDATE public.lodging_occupancies o
SET event_stage_id = u.event_stage_id
FROM public.lodging_units u
WHERE o.unit_id = u.id
  AND o.event_stage_id IS DISTINCT FROM u.event_stage_id
  AND u.event_stage_id IS NOT NULL;

-- A.4 — Tenta SET NOT NULL nas 3 tabelas. Falha graciosamente se
--       restarem linhas órfãs (deploy continua).
DO $$
BEGIN
  ALTER TABLE public.lodging_locations ALTER COLUMN event_stage_id SET NOT NULL;
  RAISE NOTICE 'lodging_locations.event_stage_id agora NOT NULL.';
EXCEPTION WHEN not_null_violation THEN
  RAISE NOTICE 'lodging_locations tem linhas com event_stage_id NULL — coluna mantida NULLABLE. Corrija manualmente e rode ALTER TABLE ... SET NOT NULL.';
END $$;

DO $$
BEGIN
  ALTER TABLE public.lodging_units ALTER COLUMN event_stage_id SET NOT NULL;
  RAISE NOTICE 'lodging_units.event_stage_id agora NOT NULL.';
EXCEPTION WHEN not_null_violation THEN
  RAISE NOTICE 'lodging_units tem linhas com event_stage_id NULL — coluna mantida NULLABLE.';
END $$;

DO $$
BEGIN
  ALTER TABLE public.lodging_occupancies ALTER COLUMN event_stage_id SET NOT NULL;
  RAISE NOTICE 'lodging_occupancies.event_stage_id agora NOT NULL.';
EXCEPTION WHEN not_null_violation THEN
  RAISE NOTICE 'lodging_occupancies tem linhas com event_stage_id NULL — coluna mantida NULLABLE.';
END $$;

-- ============================================================
-- B) lodging_audit_logs ganha event_id + event_stage_id
-- ============================================================

ALTER TABLE public.lodging_audit_logs
  ADD COLUMN IF NOT EXISTS event_id UUID,
  ADD COLUMN IF NOT EXISTS event_stage_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lodging_audit_logs_event_id_fkey') THEN
    ALTER TABLE public.lodging_audit_logs
      ADD CONSTRAINT lodging_audit_logs_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lodging_audit_logs_event_stage_id_fkey') THEN
    ALTER TABLE public.lodging_audit_logs
      ADD CONSTRAINT lodging_audit_logs_event_stage_id_fkey
      FOREIGN KEY (event_stage_id) REFERENCES public.event_stages(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS lodging_audit_logs_event_stage_idx
  ON public.lodging_audit_logs(event_stage_id)
  WHERE event_stage_id IS NOT NULL;

-- Backfill via unit_id (preferencial) → location_id (fallback).
UPDATE public.lodging_audit_logs al
SET event_id       = u.event_id,
    event_stage_id = u.event_stage_id
FROM public.lodging_units u
WHERE al.unit_id = u.id AND al.event_id IS NULL;

UPDATE public.lodging_audit_logs al
SET event_id       = l.event_id,
    event_stage_id = l.event_stage_id
FROM public.lodging_locations l
WHERE al.location_id = l.id AND al.event_id IS NULL;

-- Trigger de sync para inserções/updates futuros.
CREATE OR REPLACE FUNCTION public.sync_lodging_audit_logs_scope()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_id UUID;
  v_stage_id UUID;
BEGIN
  IF NEW.unit_id IS NOT NULL THEN
    SELECT u.event_id, u.event_stage_id INTO v_event_id, v_stage_id
    FROM public.lodging_units u WHERE u.id = NEW.unit_id;
  ELSIF NEW.location_id IS NOT NULL THEN
    SELECT l.event_id, l.event_stage_id INTO v_event_id, v_stage_id
    FROM public.lodging_locations l WHERE l.id = NEW.location_id;
  END IF;
  IF v_event_id IS NOT NULL AND NEW.event_id IS NULL THEN
    NEW.event_id := v_event_id;
  END IF;
  IF v_stage_id IS NOT NULL AND NEW.event_stage_id IS NULL THEN
    NEW.event_stage_id := v_stage_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lodging_audit_logs_scope ON public.lodging_audit_logs;
CREATE TRIGGER trg_sync_lodging_audit_logs_scope
  BEFORE INSERT OR UPDATE OF unit_id, location_id ON public.lodging_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.sync_lodging_audit_logs_scope();

-- ============================================================
-- C) lodging_presence_logs ganha event_stage_id
-- ============================================================

ALTER TABLE public.lodging_presence_logs
  ADD COLUMN IF NOT EXISTS event_stage_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lodging_presence_logs_event_stage_id_fkey') THEN
    ALTER TABLE public.lodging_presence_logs
      ADD CONSTRAINT lodging_presence_logs_event_stage_id_fkey
      FOREIGN KEY (event_stage_id) REFERENCES public.event_stages(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS lodging_presence_logs_event_stage_idx
  ON public.lodging_presence_logs(event_stage_id)
  WHERE event_stage_id IS NOT NULL;

UPDATE public.lodging_presence_logs pl
SET event_stage_id = u.event_stage_id,
    event_id       = COALESCE(pl.event_id, u.event_id)
FROM public.lodging_units u
WHERE pl.unit_id = u.id AND (pl.event_stage_id IS NULL OR pl.event_id IS NULL);

CREATE OR REPLACE FUNCTION public.sync_lodging_presence_logs_scope()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_id UUID;
  v_stage_id UUID;
BEGIN
  IF NEW.unit_id IS NOT NULL THEN
    SELECT u.event_id, u.event_stage_id INTO v_event_id, v_stage_id
    FROM public.lodging_units u WHERE u.id = NEW.unit_id;
    IF v_event_id IS NOT NULL AND NEW.event_id IS NULL THEN
      NEW.event_id := v_event_id;
    END IF;
    IF v_stage_id IS NOT NULL AND NEW.event_stage_id IS NULL THEN
      NEW.event_stage_id := v_stage_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lodging_presence_logs_scope ON public.lodging_presence_logs;
CREATE TRIGGER trg_sync_lodging_presence_logs_scope
  BEFORE INSERT OR UPDATE OF unit_id ON public.lodging_presence_logs
  FOR EACH ROW EXECUTE FUNCTION public.sync_lodging_presence_logs_scope();

-- ============================================================
-- D) lodging_supervisions ganha event_stage_id + RLS canônica
-- ============================================================

ALTER TABLE public.lodging_supervisions
  ADD COLUMN IF NOT EXISTS event_stage_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lodging_supervisions_event_stage_id_fkey') THEN
    ALTER TABLE public.lodging_supervisions
      ADD CONSTRAINT lodging_supervisions_event_stage_id_fkey
      FOREIGN KEY (event_stage_id) REFERENCES public.event_stages(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS lodging_supervisions_event_stage_idx
  ON public.lodging_supervisions(event_stage_id)
  WHERE event_stage_id IS NOT NULL;

UPDATE public.lodging_supervisions s
SET event_stage_id = l.event_stage_id
FROM public.lodging_locations l
WHERE s.location_id = l.id
  AND s.event_stage_id IS NULL
  AND l.event_stage_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_lodging_supervisions_scope()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stage_id UUID;
BEGIN
  IF NEW.location_id IS NOT NULL AND NEW.event_stage_id IS NULL THEN
    SELECT l.event_stage_id INTO v_stage_id
    FROM public.lodging_locations l WHERE l.id = NEW.location_id;
    IF v_stage_id IS NOT NULL THEN
      NEW.event_stage_id := v_stage_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lodging_supervisions_scope ON public.lodging_supervisions;
CREATE TRIGGER trg_sync_lodging_supervisions_scope
  BEFORE INSERT OR UPDATE OF location_id ON public.lodging_supervisions
  FOR EACH ROW EXECUTE FUNCTION public.sync_lodging_supervisions_scope();

-- D.1 — Aperto da RLS: drop policy frouxa, criar canônicas.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy WHERE polrelid = 'public.lodging_supervisions'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.lodging_supervisions', r.polname);
  END LOOP;
END $$;

ALTER TABLE public.lodging_supervisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lodging_supervisions admin full access"
  ON public.lodging_supervisions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "lodging_supervisions secretaria full access"
  ON public.lodging_supervisions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));

CREATE POLICY "lodging_supervisions coord_tecnica read"
  ON public.lodging_supervisions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));

CREATE POLICY "lodging_supervisions alojamento manage"
  ON public.lodging_supervisions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'alojamento'::public.app_role));

CREATE POLICY "lodging_supervisions stage scoped read"
  ON public.lodging_supervisions FOR SELECT TO authenticated
  USING (
    event_stage_id IS NOT NULL
    AND public.check_user_stage_access(event_stage_id)
  );

-- ============================================================
-- E) CHECK constraints (NOT VALID + tentativa de VALIDATE)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lodging_units_gender_restriction_check') THEN
    ALTER TABLE public.lodging_units
      ADD CONSTRAINT lodging_units_gender_restriction_check
      CHECK (gender_restriction IN ('male','female','mixed')) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lodging_units VALIDATE CONSTRAINT lodging_units_gender_restriction_check;
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'lodging_units tem rows com gender_restriction inválido — constraint mantido NOT VALID.';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lodging_occupancies_status_check') THEN
    ALTER TABLE public.lodging_occupancies
      ADD CONSTRAINT lodging_occupancies_status_check
      CHECK (status IN ('planned','allocated','checked_in','checked_out','cancelled')) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lodging_occupancies VALIDATE CONSTRAINT lodging_occupancies_status_check;
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'lodging_occupancies tem rows com status fora do enum — constraint mantido NOT VALID.';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lodging_incidents_severity_check') THEN
    ALTER TABLE public.lodging_incidents
      ADD CONSTRAINT lodging_incidents_severity_check
      CHECK (severity IN ('baixa','media','alta')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lodging_incidents_category_check') THEN
    ALTER TABLE public.lodging_incidents
      ADD CONSTRAINT lodging_incidents_category_check
      CHECK (category IN ('geral','disciplina','saude','patrimonio','seguranca')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lodging_incidents_status_check') THEN
    ALTER TABLE public.lodging_incidents
      ADD CONSTRAINT lodging_incidents_status_check
      CHECK (status IN ('aberta','em_atendimento','resolvida')) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lodging_incidents VALIDATE CONSTRAINT lodging_incidents_severity_check;
  ALTER TABLE public.lodging_incidents VALIDATE CONSTRAINT lodging_incidents_category_check;
  ALTER TABLE public.lodging_incidents VALIDATE CONSTRAINT lodging_incidents_status_check;
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'lodging_incidents tem rows com severity/category/status fora do enum — constraint(s) mantidos NOT VALID.';
END $$;

-- ============================================================
-- Comentários (documentação inline)
-- ============================================================

COMMENT ON COLUMN public.lodging_audit_logs.event_stage_id IS
  'Denormalização derivada de unit/location (Etapa 3 da auditoria). Mantida em sync por trigger sync_lodging_audit_logs_scope.';
COMMENT ON COLUMN public.lodging_presence_logs.event_stage_id IS
  'Denormalização derivada de unit (Etapa 3 da auditoria). Mantida em sync por trigger sync_lodging_presence_logs_scope.';
COMMENT ON COLUMN public.lodging_supervisions.event_stage_id IS
  'Denormalização derivada de location (Etapa 3 da auditoria). Mantida em sync por trigger sync_lodging_supervisions_scope.';
COMMENT ON COLUMN public.lodging_occupancies.unit_id IS
  'Quarto PLANEJADO/alocado para o participante. Compare com checked_in_unit_id (quarto onde de fato fez check-in) para detectar divergências.';
COMMENT ON COLUMN public.lodging_occupancies.checked_in_unit_id IS
  'Quarto REAL onde o participante fez check-in. Pode diferir de unit_id se o operador remanejar — gera divergência.';
