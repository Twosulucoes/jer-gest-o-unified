-- ============================================================
-- Credenciamento — Hotfix L2
--
-- 1) cancel_external_credential agora só revoga participant_credentials
--    com binding_source='external'. Sem este filtro, num cenário misto
--    (crachá impresso nativo + pulseira externa), cancelar a externa
--    revogava também a credencial nativa.
--
-- 2) link_external_credential e issue_participant_credential agora
--    capturam unique_violation e relançam com mensagem humana baseada
--    no nome da constraint violada. Operador no campo recebe
--    "Use Reemitir" em vez de "duplicate key value violates unique
--    constraint uq_...". O ERRCODE segue 23505 para compatibilidade
--    com clientes que branch por código; o nome da constraint vai
--    no HINT para telemetria.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_external_credential(
  p_event_id       UUID,
  p_participant_id UUID,
  p_cred_id        UUID
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

  UPDATE external_credentials SET status = 'cancelled' WHERE id = p_cred_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credencial externa não encontrada' USING ERRCODE = 'P0002';
  END IF;

  -- Revoga apenas participant_credentials que espelham a credencial externa.
  -- Credenciais nativas (binding_source != 'external') seguem ativas e o
  -- participante segue 'credentialed' enquanto tiver pelo menos uma ativa.
  UPDATE participant_credentials
  SET status = 'revoked', is_active = FALSE, revoked_at = v_now
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

REVOKE ALL ON FUNCTION public.cancel_external_credential(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_external_credential(uuid,uuid,uuid) TO authenticated;


-- ------------------------------------------------------------
-- link_external_credential com tradução de unique_violation
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_external_credential(
  p_event_id         UUID,
  p_participant_id   UUID,
  p_credential_code  TEXT,
  p_user_id          UUID,
  p_replace_id       UUID    DEFAULT NULL,
  p_is_internal_mode BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_now               TIMESTAMPTZ := NOW();
  v_existing_owner_id UUID;
  v_active_cred_id    UUID;
  v_active_cred_code  TEXT;
  v_active_binding    TEXT;
  v_qr_code           TEXT;
  v_constraint        TEXT;
BEGIN
  IF p_event_id IS NULL OR p_participant_id IS NULL OR p_credential_code IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes' USING ERRCODE = '22023';
  END IF;

  SELECT participant_id INTO v_existing_owner_id
  FROM external_credentials
  WHERE event_id = p_event_id AND credential_code = p_credential_code AND status = 'active'
  LIMIT 1;

  IF FOUND AND v_existing_owner_id IS DISTINCT FROM p_participant_id THEN
    RAISE EXCEPTION 'Esta credencial já está vinculada a outro participante. Cancele a vinculação atual antes de transferir.'
      USING ERRCODE = '23505', HINT = 'cross_participant_link';
  END IF;

  IF p_replace_id IS NOT NULL THEN
    UPDATE external_credentials SET status = 'replaced' WHERE id = p_replace_id;
    UPDATE participant_credentials
    SET status = 'reissued', is_active = FALSE, revoked_at = v_now
    WHERE participant_id = p_participant_id AND event_id = p_event_id
      AND binding_source = 'external' AND status = 'active';
  END IF;

  INSERT INTO external_credentials (
    event_id, participant_id, credential_code, status,
    linked_by_user_id, linked_at, notes
  ) VALUES (
    p_event_id, p_participant_id, p_credential_code, 'active',
    p_user_id, v_now,
    CASE WHEN p_is_internal_mode THEN 'internal_code' ELSE 'external_tag' END
  );

  SELECT id, credential_code, binding_source
  INTO v_active_cred_id, v_active_cred_code, v_active_binding
  FROM participant_credentials
  WHERE participant_id = p_participant_id AND event_id = p_event_id AND status = 'active'
  LIMIT 1;

  IF FOUND AND (v_active_cred_code IS DISTINCT FROM p_credential_code OR v_active_binding IS DISTINCT FROM 'external') THEN
    UPDATE participant_credentials
    SET status = 'reissued', is_active = FALSE, revoked_at = v_now
    WHERE id = v_active_cred_id;
    v_active_cred_id := NULL;
  END IF;

  IF v_active_cred_id IS NULL THEN
    -- qr_code_value canônico = mesmo credential_code. Sem prefixo, sem HMAC.
    v_qr_code := p_credential_code;
    INSERT INTO participant_credentials (
      participant_id, event_id, credential_code, qr_code_value,
      status, is_active, binding_source,
      issued_at, activated_at, issued_by, activated_by
    ) VALUES (
      p_participant_id, p_event_id, p_credential_code, v_qr_code,
      'active', TRUE, 'external',
      v_now, v_now, p_user_id, p_user_id
    );
  END IF;

  UPDATE participants
  SET status = 'credentialed', credentialed_at = v_now, credentialed_by = p_user_id
  WHERE id = p_participant_id;

EXCEPTION
  WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IN ('uq_participant_credentials_active_per_participant', 'uq_participant_event_active') THEN
      RAISE EXCEPTION 'Participante já possui credencial ativa neste evento. Use Reemitir.'
        USING ERRCODE = '23505', HINT = v_constraint;
    ELSIF v_constraint = 'uq_external_credentials_active_participant' THEN
      RAISE EXCEPTION 'Participante já possui credencial externa ativa. Cancele ou substitua antes.'
        USING ERRCODE = '23505', HINT = v_constraint;
    ELSIF v_constraint IN ('uq_external_credentials_event_code', 'uq_event_credential') THEN
      RAISE EXCEPTION 'Este código já está em uso por outro participante neste evento.'
        USING ERRCODE = '23505', HINT = v_constraint;
    ELSIF v_constraint = 'uq_credential_qr' THEN
      RAISE EXCEPTION 'Conflito de QR — este código já existe em outro evento. Gere outro.'
        USING ERRCODE = '23505', HINT = v_constraint;
    ELSE
      RAISE; -- relança qualquer outra unique_violation desconhecida
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.link_external_credential(uuid,uuid,text,uuid,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_external_credential(uuid,uuid,text,uuid,uuid,boolean) TO authenticated;


-- ------------------------------------------------------------
-- issue_participant_credential com tradução de unique_violation
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_participant_credential(
  p_event_id        UUID,
  p_participant_id  UUID,
  p_credential_code TEXT,
  p_qr_code_value   TEXT,
  p_user_id         UUID,
  p_binding_source  TEXT DEFAULT 'manual',
  p_revoke_id       UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_now        TIMESTAMPTZ := NOW();
  v_constraint TEXT;
BEGIN
  IF p_event_id IS NULL OR p_participant_id IS NULL OR p_credential_code IS NULL
     OR p_qr_code_value IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes' USING ERRCODE = '22023';
  END IF;

  IF p_revoke_id IS NOT NULL THEN
    UPDATE participant_credentials
    SET status = 'reissued', is_active = FALSE, revoked_at = v_now
    WHERE id = p_revoke_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Credencial a revogar não encontrada' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO participant_credentials (
    participant_id, event_id, credential_code, qr_code_value,
    status, is_active, binding_source,
    issued_at, activated_at, issued_by, activated_by
  ) VALUES (
    p_participant_id, p_event_id, p_credential_code, p_qr_code_value,
    'active', TRUE, p_binding_source,
    v_now, v_now, p_user_id, p_user_id
  );

  UPDATE participants
  SET status = 'credentialed',
      credentialed_at = v_now,
      credentialed_by = p_user_id
  WHERE id = p_participant_id;

EXCEPTION
  WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IN ('uq_participant_credentials_active_per_participant', 'uq_participant_event_active') THEN
      -- Não recuperável por retry de código novo: participante já tem ativa.
      -- Front deve passar p_revoke_id ou pedir Reemitir.
      RAISE EXCEPTION 'Participante já possui credencial ativa. Use Reemitir (revogue a anterior antes).'
        USING ERRCODE = '23505', HINT = v_constraint;
    ELSIF v_constraint = 'uq_event_credential' THEN
      -- Recuperável: caller pode tentar outro credential_code.
      RAISE EXCEPTION 'Código de credencial já existe neste evento. Tente outro código.'
        USING ERRCODE = '23505', HINT = v_constraint;
    ELSIF v_constraint = 'uq_credential_qr' THEN
      -- Recuperável: caller pode tentar outro qr_code_value.
      RAISE EXCEPTION 'QR code já existe (cross-event). Gere outro.'
        USING ERRCODE = '23505', HINT = v_constraint;
    ELSE
      RAISE;
    END IF;
END;
$$;
