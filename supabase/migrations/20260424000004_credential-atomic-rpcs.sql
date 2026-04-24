-- link_external_credential
-- Links an external credential code to a participant atomically.
-- All operations (replace old, insert new external_credential, sync participant_credentials,
-- update participant status) run inside a single transaction — any failure rolls everything back.
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

  -- Reject if code already active for a DIFFERENT participant in this event
  SELECT participant_id INTO v_existing_owner_id
  FROM external_credentials
  WHERE event_id = p_event_id
    AND credential_code = p_credential_code
    AND status = 'active'
  LIMIT 1;

  IF FOUND AND v_existing_owner_id IS DISTINCT FROM p_participant_id THEN
    RAISE EXCEPTION 'Credencial já vinculada a outro participante' USING ERRCODE = '23505';
  END IF;

  -- Mark old external credential as replaced (when re-linking)
  IF p_replace_id IS NOT NULL THEN
    UPDATE external_credentials
    SET status = 'replaced'
    WHERE id = p_replace_id;

    UPDATE participant_credentials
    SET status = 'reissued', is_active = FALSE, revoked_at = v_now
    WHERE participant_id = p_participant_id
      AND event_id = p_event_id
      AND binding_source = 'external'
      AND status = 'active';
  END IF;

  -- Insert new external credential
  INSERT INTO external_credentials (
    event_id, participant_id, credential_code, status,
    linked_by_user_id, linked_at, notes
  ) VALUES (
    p_event_id, p_participant_id, p_credential_code, 'active',
    p_user_id, v_now,
    CASE WHEN p_is_internal_mode THEN 'internal_code' ELSE 'external_tag' END
  );

  -- Revoke current active participant_credential if it diverges from the new code
  SELECT id, credential_code, binding_source
  INTO v_active_cred_id, v_active_cred_code, v_active_binding
  FROM participant_credentials
  WHERE participant_id = p_participant_id
    AND event_id = p_event_id
    AND status = 'active'
  LIMIT 1;

  IF FOUND AND (
    v_active_cred_code IS DISTINCT FROM p_credential_code
    OR v_active_binding IS DISTINCT FROM 'external'
  ) THEN
    UPDATE participant_credentials
    SET status = 'reissued', is_active = FALSE, revoked_at = v_now
    WHERE id = v_active_cred_id;

    v_active_cred_id := NULL;
  END IF;

  -- Create participant_credential synced to the external code
  IF v_active_cred_id IS NULL THEN
    v_qr_code := 'jer:' || p_event_id::TEXT || ':' || p_participant_id::TEXT || ':' || p_credential_code;

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

  -- Mark participant as credentialed
  UPDATE participants
  SET status = 'credentialed',
      credentialed_at = v_now,
      credentialed_by = p_user_id
  WHERE id = p_participant_id;
END;
$$;


-- cancel_external_credential
-- Cancels an external credential and syncs participant state atomically.
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

  UPDATE external_credentials
  SET status = 'cancelled'
  WHERE id = p_cred_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credencial externa não encontrada' USING ERRCODE = 'P0002';
  END IF;

  -- Revoke all active participant_credentials for this participant/event
  UPDATE participant_credentials
  SET status = 'revoked', is_active = FALSE, revoked_at = v_now
  WHERE participant_id = p_participant_id
    AND event_id = p_event_id
    AND status = 'active';

  -- Only reset participant status if no other active credentials remain
  SELECT COUNT(*) INTO v_remaining_count
  FROM participant_credentials
  WHERE participant_id = p_participant_id
    AND event_id = p_event_id
    AND status = 'active';

  IF v_remaining_count = 0 THEN
    UPDATE participants
    SET status = 'confirmed',
        credentialed_at = NULL,
        credentialed_by = NULL
    WHERE id = p_participant_id;
  END IF;
END;
$$;


-- issue_participant_credential
-- Issues or reissues an internal participant credential atomically.
-- When p_revoke_id is supplied the old credential is revoked before the new one is created,
-- guaranteeing the participant is never left without a credential on partial failure.
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
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_event_id IS NULL OR p_participant_id IS NULL OR p_credential_code IS NULL
     OR p_qr_code_value IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes' USING ERRCODE = '22023';
  END IF;

  -- Revoke old credential before issuing new one (reissue scenario)
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
END;
$$;
