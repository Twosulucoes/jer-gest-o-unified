-- ============================================================
-- Credenciais — link_external_credential + cancel_external_credential
-- + unique constraint defensiva pra evitar 2 credenciais ativas/participante
-- ============================================================
--
-- Resgate da migration 20260424000004 que ficou no repo mas nunca foi
-- aplicada ao banco. Sintoma reportado: PostgREST 404 ao chamar
-- link_external_credential a partir do CredenciamentoExternoPage e do
-- bulk import.
--
-- Também:
--  - Amplia CHECK de binding_source pra aceitar 'external' (necessário
--    pelos novos INSERTs de credenciais vindas do scanner de pulseira).
--  - Adiciona UNIQUE INDEX (event_id, participant_id) WHERE status='active'
--    em participant_credentials. Sem isso, duplo-clique em "Emitir"
--    cria 2 credenciais ativas pro mesmo participante e
--    resolveQrCredential vira não-determinístico (LIMIT 1).
-- ============================================================

-- 1) Amplia CHECK de binding_source
DO $$ BEGIN
  ALTER TABLE public.participant_credentials DROP CONSTRAINT IF EXISTS participant_credentials_binding_source_check;
  ALTER TABLE public.participant_credentials
    ADD CONSTRAINT participant_credentials_binding_source_check
    CHECK (binding_source = ANY (ARRAY['import','manual','api_sync','external']));
END $$;

-- 2) UNIQUE: 1 credencial ativa por (evento, participante)
CREATE UNIQUE INDEX IF NOT EXISTS uq_participant_credentials_active_per_participant
  ON public.participant_credentials (event_id, participant_id)
  WHERE status = 'active';

COMMENT ON INDEX public.uq_participant_credentials_active_per_participant IS
  'Garante que cada participante tenha no máximo 1 credencial active por evento. Reissue deve revogar a anterior antes de inserir a nova (RPC issue_participant_credential com p_revoke_id).';

-- 3) link_external_credential
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
BEGIN
  IF p_event_id IS NULL OR p_participant_id IS NULL OR p_credential_code IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes' USING ERRCODE = '22023';
  END IF;

  SELECT participant_id INTO v_existing_owner_id
  FROM external_credentials
  WHERE event_id = p_event_id AND credential_code = p_credential_code AND status = 'active'
  LIMIT 1;

  IF FOUND AND v_existing_owner_id IS DISTINCT FROM p_participant_id THEN
    RAISE EXCEPTION 'Credencial já vinculada a outro participante' USING ERRCODE = '23505';
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
END;
$$;

REVOKE ALL ON FUNCTION public.link_external_credential(uuid,uuid,text,uuid,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_external_credential(uuid,uuid,text,uuid,uuid,boolean) TO authenticated;

-- 4) cancel_external_credential
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

  UPDATE participant_credentials
  SET status = 'revoked', is_active = FALSE, revoked_at = v_now
  WHERE participant_id = p_participant_id AND event_id = p_event_id AND status = 'active';

  SELECT COUNT(*) INTO v_remaining_count FROM participant_credentials
  WHERE participant_id = p_participant_id AND event_id = p_event_id AND status = 'active';

  IF v_remaining_count = 0 THEN
    UPDATE participants
    SET status = 'confirmed', credentialed_at = NULL, credentialed_by = NULL
    WHERE id = p_participant_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_external_credential(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_external_credential(uuid,uuid,uuid) TO authenticated;
