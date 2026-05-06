-- =============================================================================
-- Separar cancel_reason (chave enum) de cancel_note (texto livre)
-- Corrige violação do CHECK external_credentials_cancel_reason_check que
-- ocorria quando o front concatenava label + nota em cancel_reason.
-- =============================================================================

-- 1. Adiciona coluna de nota opcional
ALTER TABLE public.external_credentials
  ADD COLUMN IF NOT EXISTS cancel_note TEXT;

-- 2. Recria RPC com p_note separado (DROP da assinatura anterior antes)
DROP FUNCTION IF EXISTS public.cancel_external_credential(uuid,uuid,uuid,uuid,text);

CREATE OR REPLACE FUNCTION public.cancel_external_credential(
  p_event_id       UUID,
  p_participant_id UUID,
  p_cred_id        UUID,
  p_user_id        UUID    DEFAULT NULL,
  p_reason         TEXT    DEFAULT NULL,
  p_note           TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_now              TIMESTAMPTZ := NOW();
  v_caller           UUID := auth.uid();
  v_remaining_count  INT;
  v_revoke_reason    TEXT;
BEGIN
  IF v_caller IS NULL OR NOT public.can_credenciar(v_caller) THEN
    RAISE EXCEPTION 'Acesso negado: perfil sem permissão para cancelar credenciais.'
      USING ERRCODE = '42501';
  END IF;
  p_user_id := v_caller;

  IF p_event_id IS NULL OR p_participant_id IS NULL OR p_cred_id IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes' USING ERRCODE = '22023';
  END IF;

  -- cancel_reason armazena apenas a chave (satisfaz CHECK constraint)
  -- cancel_note armazena o texto livre opcional
  UPDATE external_credentials
  SET status        = 'cancelled',
      cancelled_by  = p_user_id,
      cancelled_at  = v_now,
      cancel_reason = p_reason,
      cancel_note   = NULLIF(btrim(COALESCE(p_note, '')), '')
  WHERE id = p_cred_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credencial externa não encontrada' USING ERRCODE = 'P0002';
  END IF;

  -- revoke_reason em participant_credentials não tem CHECK: pode armazenar texto rico
  v_revoke_reason := p_reason;
  IF p_note IS NOT NULL AND btrim(p_note) <> '' THEN
    v_revoke_reason := p_reason || ': ' || btrim(p_note);
  END IF;

  UPDATE participant_credentials
  SET status        = 'revoked',
      revoked_at    = v_now,
      revoked_by    = p_user_id,
      revoke_reason = v_revoke_reason
  WHERE participant_id  = p_participant_id
    AND event_id        = p_event_id
    AND status          = 'active'
    AND binding_source  = 'external';

  SELECT COUNT(*) INTO v_remaining_count
  FROM participant_credentials
  WHERE participant_id = p_participant_id
    AND event_id       = p_event_id
    AND status         = 'active';

  IF v_remaining_count = 0 THEN
    UPDATE participants
    SET status          = 'confirmed',
        credentialed_at = NULL,
        credentialed_by = NULL
    WHERE id = p_participant_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_external_credential(uuid,uuid,uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_external_credential(uuid,uuid,uuid,uuid,text,text) TO authenticated;
