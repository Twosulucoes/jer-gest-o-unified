-- ============================================================================
-- BACKUP, RECUPERAÇÃO E AUDITORIA REVERSA
-- Cobre:
--   - Soft delete em meal_consumptions (status + cancelado_*)
--   - Unique constraint parcial (só linhas ativas)
--   - RPC reverse_meal_consumption → soft delete (UPDATE em vez de DELETE)
--   - RPC restore_meal_consumption → restaura cancelamento
--   - Ação 'restore' no meal_audit_logs
--   - Storage bucket 'backups' para backup diário
--   - pg_cron: backup-diario 23:50 diário + monitor-health a cada 5 min
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Soft-delete columns em meal_consumptions
-- ---------------------------------------------------------------------------
ALTER TABLE public.meal_consumptions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS cancelado_por UUID,
  ADD COLUMN IF NOT EXISTS cancelado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelamento_motivo TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_meal_consumptions_status'
      AND conrelid = 'public.meal_consumptions'::regclass
  ) THEN
    ALTER TABLE public.meal_consumptions
      ADD CONSTRAINT chk_meal_consumptions_status
      CHECK (status IN ('active', 'cancelado'));
  END IF;
END $$;

COMMENT ON COLUMN public.meal_consumptions.status IS 'active | cancelado — nunca hard-delete; usar reverse_meal_consumption RPC';
COMMENT ON COLUMN public.meal_consumptions.cancelado_por IS 'UUID do operador que cancelou (auth.users)';
COMMENT ON COLUMN public.meal_consumptions.cancelado_at IS 'Timestamp do cancelamento';
COMMENT ON COLUMN public.meal_consumptions.cancelamento_motivo IS 'Motivo enum do cancelamento (espelho do meal_audit_logs.reason)';

-- ---------------------------------------------------------------------------
-- 2. Unique constraint parcial — só linhas ativas
--    Participante só pode ter UMA refeição ativa por janela,
--    mas pode ser re-registrado após um cancelamento.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.uq_meal_consumption_participant_window;
ALTER TABLE public.meal_consumptions
  DROP CONSTRAINT IF EXISTS uq_meal_consumptions_window_participant;

CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_consumptions_active_window
  ON public.meal_consumptions (meal_window_id, participant_id)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 3. Adicionar ação 'restore' ao meal_audit_logs
-- ---------------------------------------------------------------------------
ALTER TABLE public.meal_audit_logs
  DROP CONSTRAINT IF EXISTS meal_audit_logs_action_check;

ALTER TABLE public.meal_audit_logs
  ADD CONSTRAINT meal_audit_logs_action_check
  CHECK (action IN ('insert', 'update', 'delete', 'reverse', 'restore'));

-- ---------------------------------------------------------------------------
-- 4. Atualiza trigger de auditoria para suprimir UPDATE durante soft-delete
--    (a RPC emite 'reverse' explicitamente e suprime o 'update' duplicado)
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
  v_skip_delete  boolean := COALESCE(current_setting('jer.suppress_meal_audit_delete', true) = 'true', false);
  v_skip_update  boolean := COALESCE(current_setting('jer.suppress_meal_audit_update', true) = 'true', false);
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

-- ---------------------------------------------------------------------------
-- 5. RPC reverse_meal_consumption — soft delete (UPDATE status='cancelado')
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reverse_meal_consumption(
  p_consumption_id uuid,
  p_reason public.meal_consumption_reverse_reason
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role  text := public.get_actor_primary_role(v_actor);
  v_row   public.meal_consumptions%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem estornar consumos' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
    FROM public.meal_consumptions
   WHERE id = p_consumption_id AND status = 'active'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consumo % não encontrado ou já cancelado', p_consumption_id USING ERRCODE = '02000';
  END IF;

  -- Audit explícito 'reverse' com motivo (antes de alterar a linha)
  INSERT INTO public.meal_audit_logs
    (action, consumption_id, meal_window_id, participant_id,
     before_data, after_data, actor_id, actor_role, reason, source)
  VALUES
    ('reverse', v_row.id, v_row.meal_window_id, v_row.participant_id,
     to_jsonb(v_row), NULL, v_actor, v_role, p_reason::text, v_row.method);

  -- Soft delete: suprime o 'update' duplicado do trigger
  PERFORM set_config('jer.suppress_meal_audit_update', 'true', true);
  UPDATE public.meal_consumptions
     SET status               = 'cancelado',
         cancelado_por        = v_actor,
         cancelado_at         = now(),
         cancelamento_motivo  = p_reason::text
   WHERE id = p_consumption_id;
  PERFORM set_config('jer.suppress_meal_audit_update', 'false', true);

  RETURN jsonb_build_object(
    'ok', true,
    'consumption_id', v_row.id,
    'meal_window_id', v_row.meal_window_id,
    'participant_id', v_row.participant_id,
    'reason', p_reason,
    'reversed_at', now(),
    'reversed_by', v_actor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_meal_consumption(uuid, public.meal_consumption_reverse_reason) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_meal_consumption(uuid, public.meal_consumption_reverse_reason) TO authenticated;

COMMENT ON FUNCTION public.reverse_meal_consumption(uuid, public.meal_consumption_reverse_reason) IS
  'Estorno administrativo de consumo por soft-delete (status=cancelado). Apenas admin. Sem limite de tempo. Registra audit "reverse" com motivo enum antes do UPDATE.';

-- ---------------------------------------------------------------------------
-- 6. RPC restore_meal_consumption — restaura um consumo cancelado
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_meal_consumption(
  p_consumption_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role  text := public.get_actor_primary_role(v_actor);
  v_row   public.meal_consumptions%ROWTYPE;
  v_conflict uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem restaurar consumos' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
    FROM public.meal_consumptions
   WHERE id = p_consumption_id AND status = 'cancelado'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consumo % não encontrado ou não está cancelado', p_consumption_id USING ERRCODE = '02000';
  END IF;

  -- Verifica conflito: já existe outro consumo ativo para o mesmo participante/janela?
  SELECT id INTO v_conflict
    FROM public.meal_consumptions
   WHERE meal_window_id = v_row.meal_window_id
     AND participant_id = v_row.participant_id
     AND status = 'active'
     AND id <> p_consumption_id
   LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'Conflito: participante já tem consumo ativo na mesma janela (id=%)', v_conflict USING ERRCODE = '23505';
  END IF;

  -- Audit explícito 'restore' antes de restaurar
  INSERT INTO public.meal_audit_logs
    (action, consumption_id, meal_window_id, participant_id,
     before_data, after_data, actor_id, actor_role, source)
  VALUES
    ('restore', v_row.id, v_row.meal_window_id, v_row.participant_id,
     to_jsonb(v_row), NULL, v_actor, v_role, v_row.method);

  -- Restaura: suprime o 'update' duplicado do trigger
  PERFORM set_config('jer.suppress_meal_audit_update', 'true', true);
  UPDATE public.meal_consumptions
     SET status              = 'active',
         cancelado_por       = NULL,
         cancelado_at        = NULL,
         cancelamento_motivo = NULL
   WHERE id = p_consumption_id;
  PERFORM set_config('jer.suppress_meal_audit_update', 'false', true);

  RETURN jsonb_build_object(
    'ok', true,
    'consumption_id', v_row.id,
    'meal_window_id', v_row.meal_window_id,
    'participant_id', v_row.participant_id,
    'restored_at', now(),
    'restored_by', v_actor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_meal_consumption(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_meal_consumption(uuid) TO authenticated;

COMMENT ON FUNCTION public.restore_meal_consumption(uuid) IS
  'Restaura consumo cancelado (status active). Apenas admin. Falha com conflito se já existe consumo ativo na mesma janela/participante.';

-- ---------------------------------------------------------------------------
-- 7. Storage bucket 'backups' (privado)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backups',
  'backups',
  false,
  52428800,  -- 50 MB
  ARRAY['application/json']
)
ON CONFLICT (id) DO NOTHING;

-- RLS para o bucket: só service_role pode ler/escrever (Edge Functions)
DROP POLICY IF EXISTS "backups service_role only" ON storage.objects;
CREATE POLICY "backups service_role only"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'backups')
  WITH CHECK (bucket_id = 'backups');

-- Admin pode ler os backups
DROP POLICY IF EXISTS "backups admin read" ON storage.objects;
CREATE POLICY "backups admin read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'backups'
    AND public.has_role(auth.uid(), 'admin')
  );

-- ---------------------------------------------------------------------------
-- 8. pg_cron: agendar backup-diario e monitor-health
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_project_url text := current_setting('app.settings.supabase_url', true);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron não disponível — agendamentos devem ser feitos manualmente.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net não disponível — agendamentos de Edge Functions não configurados.';
    RETURN;
  END IF;

  -- Remove versões anteriores (idempotência)
  PERFORM cron.unschedule(jobid)
    FROM cron.job
   WHERE jobname IN ('jer_backup_diario', 'jer_monitor_health');

  -- Backup diário às 23:50
  PERFORM cron.schedule(
    'jer_backup_diario',
    '50 23 * * *',
    format(
      $sql$
        SELECT net.http_post(
          url := %L || '/functions/v1/backup-diario',
          headers := '{"Content-Type":"application/json","Authorization":"Bearer " || current_setting(''app.settings.service_role_key'', true)}'::jsonb,
          body := '{}'::jsonb
        );
      $sql$,
      COALESCE(v_project_url, 'https://dfzjrijdcskncrwaiykr.supabase.co')
    )
  );

  -- Monitor de saúde a cada 5 minutos
  PERFORM cron.schedule(
    'jer_monitor_health',
    '*/5 * * * *',
    format(
      $sql$
        SELECT net.http_post(
          url := %L || '/functions/v1/monitor-health',
          headers := '{"Content-Type":"application/json","Authorization":"Bearer " || current_setting(''app.settings.service_role_key'', true)}'::jsonb,
          body := '{}'::jsonb
        );
      $sql$,
      COALESCE(v_project_url, 'https://dfzjrijdcskncrwaiykr.supabase.co')
    )
  );

  RAISE NOTICE 'pg_cron: jer_backup_diario (23:50) e jer_monitor_health (*/5min) agendados.';
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
