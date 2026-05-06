-- ============================================================================
-- ALIMENTAÇÃO — FUNDAÇÃO DE AUDITORIA E INTEGRIDADE (L1)
-- Audit IDs cobertos: C3, H2 (parcial via NOT VALID), M4 (backfill)
-- ----------------------------------------------------------------------------
-- - C3: cria meal_audit_logs + triggers AFTER INSERT/UPDATE/DELETE em
--       meal_consumptions, registrando autor, ação, before/after e contexto.
-- - H2: adiciona CHECK NOT VALID exigindo event_stage_id em meal_windows
--       NOVAS (legacy preservado; força backfill manual antes do VALIDATE).
-- - M4: backfill best-effort de meal_windows.location -> meal_window_location_id
--       quando ainda não estiver populado (preserva texto livre).
-- Sem DROPs destrutivos. Idempotente onde possível.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. meal_audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meal_audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action          text NOT NULL CHECK (action IN ('insert','update','delete','reverse')),
  consumption_id  uuid,
  meal_window_id  uuid,
  participant_id  uuid,
  before_data     jsonb,
  after_data      jsonb,
  actor_id        uuid,
  actor_role      text,
  reason          text,
  source          text,
  device_info     jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_audit_logs_window
  ON public.meal_audit_logs (meal_window_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_audit_logs_participant
  ON public.meal_audit_logs (participant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_audit_logs_actor
  ON public.meal_audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_audit_logs_action_time
  ON public.meal_audit_logs (action, created_at DESC);

ALTER TABLE public.meal_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meal_audit_logs admin read" ON public.meal_audit_logs;
CREATE POLICY "meal_audit_logs admin read"
  ON public.meal_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'secretaria')
    OR public.has_role(auth.uid(), 'coordenacao_tecnica')
  );

-- Inserts apenas via trigger SECURITY DEFINER; sem policy de INSERT direta.

-- ---------------------------------------------------------------------------
-- 2. Helper: deriva primeiro role conhecido do ator (texto)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_actor_primary_role(p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
    FROM public.user_roles
   WHERE user_id = p_user
   ORDER BY
     CASE role::text
       WHEN 'admin' THEN 1
       WHEN 'secretaria' THEN 2
       WHEN 'coordenacao_tecnica' THEN 3
       WHEN 'alimentacao' THEN 4
       ELSE 9
     END
   LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. Trigger function — meal_consumptions audit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_meal_consumptions_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role  text := public.get_actor_primary_role(v_actor);
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.meal_audit_logs
      (action, consumption_id, meal_window_id, participant_id,
       before_data, after_data, actor_id, actor_role, source)
    VALUES
      ('insert', NEW.id, NEW.meal_window_id, NEW.participant_id,
       NULL, to_jsonb(NEW), COALESCE(NEW.registered_by, v_actor), v_role, NEW.method);
    RETURN NEW;

  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.meal_audit_logs
      (action, consumption_id, meal_window_id, participant_id,
       before_data, after_data, actor_id, actor_role, source)
    VALUES
      ('update', NEW.id, NEW.meal_window_id, NEW.participant_id,
       to_jsonb(OLD), to_jsonb(NEW), v_actor, v_role, NEW.method);
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.meal_audit_logs
      (action, consumption_id, meal_window_id, participant_id,
       before_data, after_data, actor_id, actor_role, source)
    VALUES
      ('delete', OLD.id, OLD.meal_window_id, OLD.participant_id,
       to_jsonb(OLD), NULL, v_actor, v_role, OLD.method);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS meal_consumptions_audit_iud ON public.meal_consumptions;
CREATE TRIGGER meal_consumptions_audit_iud
AFTER INSERT OR UPDATE OR DELETE ON public.meal_consumptions
FOR EACH ROW EXECUTE FUNCTION public.tg_meal_consumptions_audit();

-- ---------------------------------------------------------------------------
-- 4. H2: event_stage_id obrigatório em janelas NOVAS (legacy preservado)
--    Usamos NOT VALID — bloqueia novos NULL sem afetar linhas existentes.
--    Quando o backfill estiver pronto, executar:
--      ALTER TABLE public.meal_windows VALIDATE CONSTRAINT meal_windows_event_stage_id_required;
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meal_windows_event_stage_id_required'
      AND conrelid = 'public.meal_windows'::regclass
  ) THEN
    ALTER TABLE public.meal_windows
      ADD CONSTRAINT meal_windows_event_stage_id_required
      CHECK (event_stage_id IS NOT NULL) NOT VALID;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. M4: backfill best-effort meal_windows.location -> meal_window_location_id
-- ---------------------------------------------------------------------------
UPDATE public.meal_windows mw
   SET meal_window_location_id = ml.id
  FROM public.meal_locations ml
 WHERE mw.meal_window_location_id IS NULL
   AND mw.location IS NOT NULL
   AND mw.location <> ''
   AND ml.event_id = mw.event_id
   AND lower(ml.name) = lower(mw.location);

-- ---------------------------------------------------------------------------
-- 6. Comentários de documentação
-- ---------------------------------------------------------------------------
COMMENT ON TABLE  public.meal_audit_logs IS
  'Trilha imutável de inserts/updates/deletes/estornos em meal_consumptions. Populada por trigger SECURITY DEFINER.';
COMMENT ON COLUMN public.meal_audit_logs.action IS
  'insert | update | delete | reverse — "reverse" reservado para RPC de estorno (L2).';
COMMENT ON COLUMN public.meal_audit_logs.before_data IS
  'Snapshot da linha antes da operação (NULL em insert).';
COMMENT ON COLUMN public.meal_audit_logs.after_data IS
  'Snapshot da linha após a operação (NULL em delete).';

COMMIT;
