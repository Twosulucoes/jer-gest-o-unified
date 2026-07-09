-- ============================================================
-- ENTREGA DE MATERIAL — registra tentativa de entrega duplicada
-- ============================================================
-- record_material_delivery() e record_material_delivery_unlinked() já
-- bloqueavam a reentrega (idempotência via UNIQUE parcial / ON CONFLICT),
-- mas a tentativa em si não ficava registrada em lugar nenhum — o operador
-- só via um alerta na tela (MaterialScanPage) e nada era gravado no banco.
--
-- Reaproveita a tabela genérica de auditoria já existente (audit_events,
-- usada por usePwaAudit) em vez de criar uma tabela nova: cada tentativa de
-- reentrega vira uma linha com action='duplicate_delivery_attempt'.

CREATE OR REPLACE FUNCTION public.record_material_delivery(
  p_participant_id uuid,
  p_kit_id         uuid,
  p_method         text DEFAULT 'qr_scan',
  p_delivered_by   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kit         RECORD;
  v_delivery_id uuid;
BEGIN
  -- 1. Kit existe e está ativo?
  SELECT * INTO v_kit
  FROM material_kits
  WHERE id = p_kit_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'KIT_NOT_FOUND');
  END IF;

  -- 2. INSERT idempotente — sintaxe para partial unique index.
  INSERT INTO material_deliveries (participant_id, kit_id, method, delivered_by, status)
  VALUES (p_participant_id, p_kit_id, p_method, p_delivered_by, 'active')
  ON CONFLICT (kit_id, participant_id) WHERE (status = 'active')
  DO NOTHING
  RETURNING id INTO v_delivery_id;

  IF v_delivery_id IS NULL THEN
    SELECT id INTO v_delivery_id
    FROM material_deliveries
    WHERE participant_id = p_participant_id
      AND kit_id = p_kit_id
      AND status = 'active';

    -- Registra a tentativa de reentrega (não bloqueia o fluxo se falhar).
    BEGIN
      INSERT INTO audit_events (table_name, record_id, action, payload, created_by)
      VALUES (
        'material_deliveries',
        v_delivery_id::text,
        'duplicate_delivery_attempt',
        jsonb_build_object(
          'kit_id', p_kit_id,
          'participant_id', p_participant_id,
          'method', p_method,
          'existing_delivery_id', v_delivery_id
        ),
        COALESCE(p_delivered_by, auth.uid())
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN jsonb_build_object('ok', false, 'reason', 'ALREADY_DELIVERED', 'id', v_delivery_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_delivery_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_material_delivery_unlinked(
  p_qr_code      text,
  p_kit_id       uuid,
  p_method       text DEFAULT 'qr_scan',
  p_delivered_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kit      RECORD;
  v_id       uuid;
  v_existing uuid;
BEGIN
  SELECT * INTO v_kit
  FROM material_kits
  WHERE id = p_kit_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'KIT_NOT_FOUND');
  END IF;

  INSERT INTO material_deliveries_unlinked (qr_code, kit_id, method, delivered_by)
  VALUES (p_qr_code, p_kit_id, p_method, p_delivered_by)
  ON CONFLICT (qr_code, kit_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_existing
    FROM material_deliveries_unlinked
    WHERE qr_code = p_qr_code AND kit_id = p_kit_id;

    -- Registra a tentativa de reentrega (não bloqueia o fluxo se falhar).
    BEGIN
      INSERT INTO audit_events (table_name, record_id, action, payload, created_by)
      VALUES (
        'material_deliveries_unlinked',
        v_existing::text,
        'duplicate_delivery_attempt',
        jsonb_build_object(
          'kit_id', p_kit_id,
          'qr_code', p_qr_code,
          'method', p_method,
          'existing_delivery_id', v_existing
        ),
        COALESCE(p_delivered_by, auth.uid())
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN jsonb_build_object('ok', false, 'reason', 'ALREADY_DELIVERED');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_material_delivery FROM anon;
GRANT EXECUTE ON FUNCTION public.record_material_delivery TO authenticated;
REVOKE ALL ON FUNCTION public.record_material_delivery_unlinked FROM anon;
GRANT EXECUTE ON FUNCTION public.record_material_delivery_unlinked TO authenticated;

-- ─── Leitura das tentativas na tela de Entrega de Material ────────────
-- audit_events já permite leitura para 'admin' (policy "Admin can read
-- audit"). Esta policy adicional (permissiva, soma com a de admin) libera
-- secretaria/coordenação técnica/material para ver SÓ as linhas de
-- duplicate_delivery_attempt — nenhum outro tipo de evento de auditoria
-- (pwa_access, scope_violation etc.) fica visível para esses perfis.
CREATE POLICY "Material roles can read duplicate delivery attempts" ON public.audit_events
  FOR SELECT TO authenticated
  USING (
    action = 'duplicate_delivery_attempt'
    AND (
      has_role(auth.uid(), 'secretaria')
      OR has_role(auth.uid(), 'coordenacao_tecnica')
      OR has_role(auth.uid(), 'material')
    )
  );
