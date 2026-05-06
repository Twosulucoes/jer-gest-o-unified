-- ============================================================
-- Credenciamento — C5a: idempotência por chave nas RPCs de vinculação
--
-- Operador no campo (PWA) em zona de wifi instável: clica vincular,
-- request sai, network engasga, cliente assume que falhou e re-envia.
-- Sem idempotência, 2 RPCs concorrentes para o mesmo evento — a
-- segunda cai em uq_external_credentials_event_code com 23505,
-- toast vermelho e operador acha que sistema travou.
--
-- Solução: cliente gera UUID v4 por intenção (idempotency_key),
-- guarda na fila offline (IndexedDB — C5b), e re-envia até ter
-- ACK. RPC checa a chave: se já foi processada com sucesso, retorna
-- no-op; senão, processa e registra.
--
-- Escopo MVP: link_external_credential (superfície PWA). issue/cancel
-- ficam para depois — admin tem wifi bom e dedupe local de scanner
-- (L1) já cobre.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rpc_idempotency_log (
  idempotency_key TEXT        PRIMARY KEY,
  rpc_name        TEXT        NOT NULL,
  actor_user_id   UUID,
  params_summary  JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpc_idem_log_created
  ON public.rpc_idempotency_log (created_at);

ALTER TABLE public.rpc_idempotency_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rpc_idem_select" ON public.rpc_idempotency_log;
CREATE POLICY "rpc_idem_select"
  ON public.rpc_idempotency_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaria') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  );

COMMENT ON TABLE public.rpc_idempotency_log IS
  'Log de chaves de idempotência consumidas pelas RPCs de credenciamento. '
  'Append-only via SECURITY DEFINER. Retenção sugerida: 7 dias (cron à parte).';


-- ------------------------------------------------------------
-- link_external_credential com p_idempotency_key
--
-- Comportamento:
--  - p_idempotency_key NULL → comportamento legado, sem dedupe.
--  - chave já registrada → RETURN no-op (cliente reenviou após ACK perdido).
--  - chave nova → processa normalmente; registra ao final, dentro da
--    mesma transação. Se a transação falha, o registro é desfeito,
--    permitindo retry com a mesma chave.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_external_credential(
  p_event_id         UUID,
  p_participant_id   UUID,
  p_credential_code  TEXT,
  p_user_id          UUID,
  p_replace_id       UUID    DEFAULT NULL,
  p_is_internal_mode BOOLEAN DEFAULT FALSE,
  p_idempotency_key  TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_now               TIMESTAMPTZ := NOW();
  v_caller            UUID := auth.uid();
  v_existing_owner_id UUID;
  v_active_cred_id    UUID;
  v_active_cred_code  TEXT;
  v_active_binding    TEXT;
  v_qr_code           TEXT;
  v_constraint        TEXT;
BEGIN
  IF v_caller IS NULL OR NOT public.can_credenciar(v_caller) THEN
    RAISE EXCEPTION 'Acesso negado: perfil sem permissão para vincular credenciais.'
      USING ERRCODE = '42501';
  END IF;
  p_user_id := v_caller;

  -- Idempotência: se a chave já está registrada, no-op (cliente
  -- reenviou após ACK perdido). Sem chave, comportamento legado.
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM 1 FROM public.rpc_idempotency_log
      WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  IF p_event_id IS NULL OR p_participant_id IS NULL OR p_credential_code IS NULL THEN
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
    SET status = 'reissued', revoked_at = v_now
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
    SET status = 'reissued', revoked_at = v_now
    WHERE id = v_active_cred_id;
    v_active_cred_id := NULL;
  END IF;

  IF v_active_cred_id IS NULL THEN
    v_qr_code := p_credential_code;
    INSERT INTO participant_credentials (
      participant_id, event_id, credential_code, qr_code_value,
      status, binding_source,
      issued_at, activated_at, issued_by, activated_by
    ) VALUES (
      p_participant_id, p_event_id, p_credential_code, v_qr_code,
      'active', 'external',
      v_now, v_now, p_user_id, p_user_id
    );
  END IF;

  UPDATE participants
  SET status = 'credentialed', credentialed_at = v_now, credentialed_by = p_user_id
  WHERE id = p_participant_id;

  -- Registra a chave consumida. Mesma transação: se algum dos passos
  -- acima falhar, o registro é desfeito junto e o cliente pode tentar
  -- de novo com a mesma chave sem ficar bloqueado.
  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency_log
      (idempotency_key, rpc_name, actor_user_id, params_summary)
    VALUES (
      p_idempotency_key,
      'link_external_credential',
      v_caller,
      jsonb_build_object(
        'event_id', p_event_id,
        'participant_id', p_participant_id,
        'credential_code', p_credential_code,
        'replace_id', p_replace_id,
        'is_internal_mode', p_is_internal_mode
      )
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

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
      RAISE;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.link_external_credential(uuid,uuid,text,uuid,uuid,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_external_credential(uuid,uuid,text,uuid,uuid,boolean,text) TO authenticated;
