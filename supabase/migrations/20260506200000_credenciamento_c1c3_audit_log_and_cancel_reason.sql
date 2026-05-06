-- ============================================================
-- Credenciamento — C1+C3: audit_log + motivo de cancelamento
--
-- C3) Adiciona colunas para registrar QUEM cancelou/revogou e POR QUÊ:
--     - external_credentials.cancelled_by, cancelled_at, cancel_reason
--     - participant_credentials.revoked_by, revoke_reason
--     RPC cancel_external_credential agora exige p_user_id e aceita
--     p_reason; preenche essas colunas para que o trigger de audit
--     capture o ator + motivo.
--
-- C1) Cria credential_audit_log (append-only) e triggers AFTER
--     INSERT/UPDATE em participant_credentials e external_credentials
--     que registram cada transição de estado:
--       - native:    issued | reissued | revoked
--       - external:  linked | replaced | cancelled | lost
--     Captura before_state e after_state como JSONB para reconstrução
--     completa do histórico de uma credencial.
--
-- Compatibilidade: as novas colunas têm DEFAULT NULL — registros
-- antigos seguem válidos. As triggers só registram transições
-- explícitas; UPDATEs neutros (ex.: updated_at) não geram log.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Colunas de motivo/ator
-- ------------------------------------------------------------
ALTER TABLE public.external_credentials
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

ALTER TABLE public.participant_credentials
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revoke_reason TEXT;

-- ------------------------------------------------------------
-- 2) Tabela credential_audit_log (append-only)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credential_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL,
  participant_id  UUID,
  credential_kind TEXT NOT NULL CHECK (credential_kind IN ('native', 'external')),
  credential_id   UUID NOT NULL,
  action          TEXT NOT NULL CHECK (action IN (
                    'issued', 'reissued', 'revoked',
                    'linked', 'replaced', 'cancelled', 'lost'
                  )),
  actor_user_id   UUID,
  reason          TEXT,
  before_state    JSONB,
  after_state     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cred_audit_log_event
  ON public.credential_audit_log (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cred_audit_log_participant
  ON public.credential_audit_log (participant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cred_audit_log_credential
  ON public.credential_audit_log (credential_kind, credential_id, created_at DESC);

ALTER TABLE public.credential_audit_log ENABLE ROW LEVEL SECURITY;

-- Append-only: ninguém faz INSERT/UPDATE/DELETE direto. SELECT por
-- perfis administrativos/coordenação. INSERT vem só dos triggers
-- SECURITY DEFINER abaixo.
DROP POLICY IF EXISTS "credential_audit_log_select" ON public.credential_audit_log;
CREATE POLICY "credential_audit_log_select"
  ON public.credential_audit_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaria') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  );

-- ------------------------------------------------------------
-- 3) Trigger: participant_credentials → audit_log
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_audit_participant_credentials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_action TEXT;
  v_actor  UUID;
  v_reason TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Toda inserção é uma emissão. Reissue é representado como
    -- UPDATE da credencial anterior (status active → reissued)
    -- + INSERT da nova; o registro 'reissued' vem pelo UPDATE.
    v_action := 'issued';
    v_actor  := NEW.issued_by;
    v_reason := NULL;

    INSERT INTO public.credential_audit_log
      (event_id, participant_id, credential_kind, credential_id,
       action, actor_user_id, reason, before_state, after_state)
    VALUES
      (NEW.event_id, NEW.participant_id, 'native', NEW.id,
       v_action, v_actor, v_reason, NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Só registra transições de status que importam.
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'reissued' THEN
        v_action := 'reissued';
      ELSIF NEW.status = 'revoked' THEN
        v_action := 'revoked';
      ELSE
        -- Outras transições (ex.: pending → active) não geram entrada
        -- separada — o INSERT já cobriu.
        RETURN NEW;
      END IF;

      v_actor  := COALESCE(NEW.revoked_by, NEW.issued_by);
      v_reason := NEW.revoke_reason;

      INSERT INTO public.credential_audit_log
        (event_id, participant_id, credential_kind, credential_id,
         action, actor_user_id, reason, before_state, after_state)
      VALUES
        (NEW.event_id, NEW.participant_id, 'native', NEW.id,
         v_action, v_actor, v_reason, to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_participant_credentials ON public.participant_credentials;
CREATE TRIGGER audit_participant_credentials
  AFTER INSERT OR UPDATE ON public.participant_credentials
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_participant_credentials();

-- ------------------------------------------------------------
-- 4) Trigger: external_credentials → audit_log
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_audit_external_credentials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_action TEXT;
  v_actor  UUID;
  v_reason TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'linked';
    v_actor  := NEW.linked_by_user_id;
    v_reason := NULL;

    INSERT INTO public.credential_audit_log
      (event_id, participant_id, credential_kind, credential_id,
       action, actor_user_id, reason, before_state, after_state)
    VALUES
      (NEW.event_id, NEW.participant_id, 'external', NEW.id,
       v_action, v_actor, v_reason, NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'cancelled' THEN
        v_action := 'cancelled';
        v_actor  := NEW.cancelled_by;
        v_reason := NEW.cancel_reason;
      ELSIF NEW.status = 'replaced' THEN
        v_action := 'replaced';
        v_actor  := NEW.cancelled_by; -- pode ser null; replace é via RPC
        v_reason := NEW.cancel_reason;
      ELSIF NEW.status = 'lost' THEN
        v_action := 'lost';
        v_actor  := NEW.cancelled_by;
        v_reason := NEW.cancel_reason;
      ELSE
        RETURN NEW;
      END IF;

      INSERT INTO public.credential_audit_log
        (event_id, participant_id, credential_kind, credential_id,
         action, actor_user_id, reason, before_state, after_state)
      VALUES
        (NEW.event_id, NEW.participant_id, 'external', NEW.id,
         v_action, v_actor, v_reason, to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_external_credentials ON public.external_credentials;
CREATE TRIGGER audit_external_credentials
  AFTER INSERT OR UPDATE ON public.external_credentials
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_external_credentials();

-- ------------------------------------------------------------
-- 5) RPC cancel_external_credential agora aceita user_id e reason
--
-- Drop da assinatura antiga (3 args) antes de criar a nova (5 args)
-- — sem isso, Postgres trata como overload e callers antigos com 3
-- args resolvem para a versão sem audit.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.cancel_external_credential(uuid,uuid,uuid);

CREATE OR REPLACE FUNCTION public.cancel_external_credential(
  p_event_id       UUID,
  p_participant_id UUID,
  p_cred_id        UUID,
  p_user_id        UUID    DEFAULT NULL,
  p_reason         TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_now              TIMESTAMPTZ := NOW();
  v_remaining_count  INT;
BEGIN
  IF p_event_id IS NULL OR p_participant_id IS NULL OR p_cred_id IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes' USING ERRCODE = '22023';
  END IF;

  UPDATE external_credentials
  SET status = 'cancelled',
      cancelled_by = p_user_id,
      cancelled_at = v_now,
      cancel_reason = p_reason
  WHERE id = p_cred_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credencial externa não encontrada' USING ERRCODE = 'P0002';
  END IF;

  -- Revoga apenas participant_credentials espelho da externa.
  -- Crachás nativos seguem ativos.
  UPDATE participant_credentials
  SET status = 'revoked',
      is_active = FALSE,
      revoked_at = v_now,
      revoked_by = p_user_id,
      revoke_reason = p_reason
  WHERE participant_id = p_participant_id
    AND event_id = p_event_id
    AND status = 'active'
    AND binding_source = 'external';

  SELECT COUNT(*) INTO v_remaining_count
  FROM participant_credentials
  WHERE participant_id = p_participant_id
    AND event_id = p_event_id
    AND status = 'active';

  IF v_remaining_count = 0 THEN
    UPDATE participants
    SET status = 'confirmed', credentialed_at = NULL, credentialed_by = NULL
    WHERE id = p_participant_id;
  END IF;
END;
$$;

-- Mantém a assinatura antiga 3-args para clientes ainda não atualizados.
-- A nova com 5 args é a canônica.
REVOKE ALL ON FUNCTION public.cancel_external_credential(uuid,uuid,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_external_credential(uuid,uuid,uuid,uuid,text) TO authenticated;
