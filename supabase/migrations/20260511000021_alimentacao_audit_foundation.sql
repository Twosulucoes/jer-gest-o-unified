-- ============================================================================
-- ALIMENTAÇÃO — FUNDAÇÃO DE AUDITORIA (meal_audit_logs + trigger)
-- Idempotente: usa IF NOT EXISTS / CREATE OR REPLACE em todos os objetos.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.meal_audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action          text NOT NULL,
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

CREATE OR REPLACE FUNCTION public.tg_meal_consumptions_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role  text := public.get_actor_primary_role(v_actor);
  v_skip_delete boolean := COALESCE(current_setting('jer.suppress_meal_audit_delete', true) = 'true', false);
  v_skip_update boolean := COALESCE(current_setting('jer.suppress_meal_audit_update', true) = 'true', false);
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
    IF NOT v_skip_update THEN
      INSERT INTO public.meal_audit_logs
        (action, consumption_id, meal_window_id, participant_id,
         before_data, after_data, actor_id, actor_role, source)
      VALUES
        ('update', NEW.id, NEW.meal_window_id, NEW.participant_id,
         to_jsonb(OLD), to_jsonb(NEW), v_actor, v_role, NEW.method);
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    IF NOT v_skip_delete THEN
      INSERT INTO public.meal_audit_logs
        (action, consumption_id, meal_window_id, participant_id,
         before_data, after_data, actor_id, actor_role, source)
      VALUES
        ('delete', OLD.id, OLD.meal_window_id, OLD.participant_id,
         to_jsonb(OLD), NULL, v_actor, v_role, OLD.method);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS meal_consumptions_audit_iud ON public.meal_consumptions;
CREATE TRIGGER meal_consumptions_audit_iud
  AFTER INSERT OR UPDATE OR DELETE ON public.meal_consumptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_meal_consumptions_audit();

COMMENT ON TABLE public.meal_audit_logs IS
  'Trilha imutável de inserts/updates/deletes/estornos/restaurações em meal_consumptions.';
