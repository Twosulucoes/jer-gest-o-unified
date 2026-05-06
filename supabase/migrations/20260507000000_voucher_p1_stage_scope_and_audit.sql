-- ============================================================
-- Vouchers P1 — escopo por etapa, audit trigger e denormalização
-- (auditoria etapa Hqy0B-p1)
-- ============================================================
-- Cobre:
--   1. Denormaliza event_stage_id em service_voucher_batches (+backfill).
--   2. Denormaliza event_stage_id em service_voucher_attempts (+backfill).
--   3. Trigger que registra revoke/reissue/expire em service_voucher_audit.
--   4. Endurece RLS de vouchers/batches/uses/attempts/audit por etapa
--      via check_user_stage_access().
--   5. Trigger que força issuer_id = auth.uid() no audit (anti-spoof).
-- ============================================================

-- ============================================================
-- 1. service_voucher_batches.event_stage_id
-- ============================================================
ALTER TABLE public.service_voucher_batches
  ADD COLUMN IF NOT EXISTS event_stage_id UUID REFERENCES public.event_stages(id);

-- Backfill: deriva do primeiro voucher do lote (todos vouchers do mesmo lote
-- nascem com event_stage_id idêntico via wizard).
UPDATE public.service_voucher_batches b
SET event_stage_id = sub.event_stage_id
FROM (
  SELECT batch_id, MIN(event_stage_id) AS event_stage_id
  FROM public.service_vouchers
  WHERE batch_id IS NOT NULL
  GROUP BY batch_id
) sub
WHERE b.id = sub.batch_id
  AND b.event_stage_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_voucher_batches_event_stage_id
  ON public.service_voucher_batches (event_stage_id);

COMMENT ON COLUMN public.service_voucher_batches.event_stage_id IS
  'Etapa do evento à qual o lote pertence. Denormalizado dos vouchers do lote para simplificar filtros e RLS por etapa.';

-- ============================================================
-- 2. service_voucher_attempts.event_stage_id
-- ============================================================
ALTER TABLE public.service_voucher_attempts
  ADD COLUMN IF NOT EXISTS event_stage_id UUID REFERENCES public.event_stages(id);

UPDATE public.service_voucher_attempts a
SET event_stage_id = v.event_stage_id
FROM public.service_vouchers v
WHERE a.voucher_id = v.id
  AND a.event_stage_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_voucher_attempts_event_stage_id
  ON public.service_voucher_attempts (event_stage_id);

COMMENT ON COLUMN public.service_voucher_attempts.event_stage_id IS
  'Etapa do evento. Denormalizado do voucher (via voucher_id) para filtros rápidos na auditoria.';

-- Trigger BEFORE INSERT: preenche event_stage_id automaticamente quando o
-- caller informa voucher_id mas não event_stage_id (fallback defensivo).
CREATE OR REPLACE FUNCTION public.fill_attempt_event_stage_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.event_stage_id IS NULL AND NEW.voucher_id IS NOT NULL THEN
    SELECT event_stage_id INTO NEW.event_stage_id
    FROM public.service_vouchers
    WHERE id = NEW.voucher_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_attempt_event_stage_id ON public.service_voucher_attempts;
CREATE TRIGGER trg_fill_attempt_event_stage_id
  BEFORE INSERT ON public.service_voucher_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_attempt_event_stage_id();

COMMENT ON FUNCTION public.fill_attempt_event_stage_id() IS
  'Preenche service_voucher_attempts.event_stage_id derivando de service_vouchers via voucher_id quando não fornecido pelo caller.';

-- ============================================================
-- 3. Audit trigger — revoke/reissue/expire em service_vouchers
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_voucher_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_type text;
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_event_type := CASE
    WHEN NEW.status = 'revoked' AND NEW.replaces_voucher_id IS NULL THEN 'revoke'
    WHEN NEW.status = 'expired' THEN 'expire'
    WHEN NEW.status = 'active' AND OLD.status = 'revoked' THEN 'unrevoke'
    ELSE 'status_change_' || NEW.status
  END;

  INSERT INTO public.service_voucher_audit (
    event_id, issuer_id, voucher_type, payload, status, error_message
  ) VALUES (
    NEW.event_id,
    v_actor,
    NEW.voucher_type,
    jsonb_build_object(
      'event_type', v_event_type,
      'voucher_id', NEW.id,
      'event_stage_id', NEW.event_stage_id,
      'qr_code_value', NEW.qr_code_value,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'revoke_reason', NEW.revoke_reason,
      'replaces_voucher_id', NEW.replaces_voucher_id,
      'reissued_at', NEW.reissued_at
    ),
    'success',
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_voucher_status_change ON public.service_vouchers;
CREATE TRIGGER trg_log_voucher_status_change
  AFTER UPDATE OF status ON public.service_vouchers
  FOR EACH ROW
  EXECUTE FUNCTION public.log_voucher_status_change();

COMMENT ON FUNCTION public.log_voucher_status_change() IS
  'Registra em service_voucher_audit toda mudança de status de service_vouchers (revoke, expire, unrevoke). Usado para reconstituição completa do histórico do voucher.';

-- ============================================================
-- 4. Trigger anti-spoof: força issuer_id = auth.uid() em audit
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_audit_issuer_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.issuer_id := auth.uid();
  END IF;
  -- Em contextos sem auth.uid() (cron, security definer), preserva o
  -- valor passado pelo caller para que triggers internos consigam logar.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_audit_issuer_id ON public.service_voucher_audit;
CREATE TRIGGER trg_enforce_audit_issuer_id
  BEFORE INSERT ON public.service_voucher_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_audit_issuer_id();

-- Atualiza policy de INSERT para tolerar inserts via trigger (SECURITY
-- DEFINER) sem permitir spoof — o trigger acima já força issuer_id.
DROP POLICY IF EXISTS "System can insert audit logs" ON public.service_voucher_audit;
CREATE POLICY "Audit log insert (trigger or self)" ON public.service_voucher_audit
  FOR INSERT TO authenticated
  WITH CHECK (
    issuer_id = auth.uid() OR issuer_id IS NULL
  );

-- ============================================================
-- 5. RLS — service_vouchers por etapa
-- ============================================================
DROP POLICY IF EXISTS "vouchers_read_admin_ops" ON public.service_vouchers;
DROP POLICY IF EXISTS "vouchers_write_admin" ON public.service_vouchers;
DROP POLICY IF EXISTS "Admins and secretaria can manage service vouchers" ON public.service_vouchers;
DROP POLICY IF EXISTS "Operacional roles can view service vouchers" ON public.service_vouchers;

-- Manage (FOR ALL): admin/secretaria/super_admin restritos à etapa acessível.
CREATE POLICY "Vouchers — manage by admin/secretaria/super_admin (stage)"
  ON public.service_vouchers FOR ALL TO authenticated
  USING (
    public.check_user_stage_access(event_stage_id)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  )
  WITH CHECK (
    public.check_user_stage_access(event_stage_id)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );

-- Read by operacional/coordenacao_tecnica restrito à etapa.
CREATE POLICY "Vouchers — read by operacional (stage)"
  ON public.service_vouchers FOR SELECT TO authenticated
  USING (
    public.check_user_stage_access(event_stage_id)
    AND (
      public.has_role(auth.uid(), 'transporte'::public.app_role)
      OR public.has_role(auth.uid(), 'alimentacao'::public.app_role)
      OR public.has_role(auth.uid(), 'alojamento'::public.app_role)
      OR public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role)
    )
  );

-- ============================================================
-- 6. RLS — service_voucher_batches por etapa
-- ============================================================
DROP POLICY IF EXISTS "Admins and secretaria can manage voucher batches" ON public.service_voucher_batches;
DROP POLICY IF EXISTS "Operacional roles can view voucher batches" ON public.service_voucher_batches;
DROP POLICY IF EXISTS "Escrita de lotes por admin e secretaria" ON public.service_voucher_batches;
DROP POLICY IF EXISTS "Leitura de lotes por perfis autorizados" ON public.service_voucher_batches;

-- Lotes legados podem ter event_stage_id NULL — admin/secretaria/super_admin
-- conseguem visualizá-los (bypass via check_user_stage_access(NULL) = false,
-- então tratamos NULL explicitamente no USING).
CREATE POLICY "Batches — manage by admin/secretaria/super_admin (stage)"
  ON public.service_voucher_batches FOR ALL TO authenticated
  USING (
    (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
    AND (event_stage_id IS NULL OR public.check_user_stage_access(event_stage_id))
  )
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
    -- Novos lotes precisam de event_stage_id válido.
    AND public.check_user_stage_access(event_stage_id)
  );

CREATE POLICY "Batches — read by operacional (stage)"
  ON public.service_voucher_batches FOR SELECT TO authenticated
  USING (
    public.check_user_stage_access(event_stage_id)
    AND (
      public.has_role(auth.uid(), 'transporte'::public.app_role)
      OR public.has_role(auth.uid(), 'alimentacao'::public.app_role)
      OR public.has_role(auth.uid(), 'alojamento'::public.app_role)
      OR public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role)
    )
  );

-- ============================================================
-- 7. RLS — service_voucher_uses
-- (uses é gravado pela RPC SECURITY DEFINER; SELECT por roles operacionais
-- via voucher → stage. Mantém leitura ampla, mas exigindo acesso ao voucher.)
-- ============================================================
DROP POLICY IF EXISTS "voucher_uses_read" ON public.service_voucher_uses;

CREATE POLICY "Uses — read scoped by voucher stage"
  ON public.service_voucher_uses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_vouchers v
      WHERE v.id = service_voucher_uses.voucher_id
        AND public.check_user_stage_access(v.event_stage_id)
    )
  );

-- ============================================================
-- 8. RLS — service_voucher_attempts (auditoria operacional)
-- ============================================================
DROP POLICY IF EXISTS "Leitura de tentativas por perfis autorizados" ON public.service_voucher_attempts;

CREATE POLICY "Attempts — read by admin/secretaria/coord/operacional (stage)"
  ON public.service_voucher_attempts FOR SELECT TO authenticated
  USING (
    -- event_stage_id pode ser NULL para attempts antigas; admin global vê tudo.
    (event_stage_id IS NULL AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
    ))
    OR public.check_user_stage_access(event_stage_id)
  );

NOTIFY pgrst, 'reload schema';
