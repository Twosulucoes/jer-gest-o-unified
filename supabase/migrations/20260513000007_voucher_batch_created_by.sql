-- ============================================================
-- Vouchers — rastreio de operador na emissão de lotes
-- ============================================================
-- Cobre:
--   1. Adiciona created_by (UUID → profiles) em service_voucher_batches.
--   2. Backfill via service_voucher_audit (primeiro issuer do lote).
--   3. Atualiza issue_voucher_batch_v1 para gravar created_by = auth.uid().
-- ============================================================

-- 1. Coluna created_by no lote
ALTER TABLE public.service_voucher_batches
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_service_voucher_batches_created_by
  ON public.service_voucher_batches (created_by);

COMMENT ON COLUMN public.service_voucher_batches.created_by IS
  'Operador que emitiu o lote. Preenchido pela RPC issue_voucher_batch_v1 com auth.uid().';

-- 2. Backfill: busca o primeiro issuer_id no service_voucher_audit para o batch.
--    Funciona apenas para lotes criados após a instalação dos triggers de audit (p4).
UPDATE public.service_voucher_batches b
SET created_by = sub.issuer_id
FROM (
  SELECT DISTINCT ON ((payload->>'batch_id')::uuid)
    (payload->>'batch_id')::uuid AS batch_id,
    issuer_id
  FROM public.service_voucher_audit
  WHERE payload->>'batch_id' IS NOT NULL
  ORDER BY (payload->>'batch_id')::uuid, created_at ASC
) sub
WHERE b.id = sub.batch_id
  AND b.created_by IS NULL
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = sub.issuer_id);

-- 3. Atualiza issue_voucher_batch_v1 para gravar created_by
CREATE OR REPLACE FUNCTION public.issue_voucher_batch_v1(
  p_event_id uuid,
  p_event_stage_id uuid,
  p_service_type text,
  p_instance_id uuid,
  p_target_date date,
  p_quantity integer,
  p_label text,
  p_qr_codes text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_batch_id uuid;
  v_qr text;
BEGIN
  IF p_service_type NOT IN ('meals', 'transport', 'lodging') THEN
    RAISE EXCEPTION 'service_type inválido: %', p_service_type USING ERRCODE = '22023';
  END IF;
  IF p_instance_id IS NULL THEN
    RAISE EXCEPTION 'Instância é obrigatória.' USING ERRCODE = '22023';
  END IF;
  IF p_event_stage_id IS NULL THEN
    RAISE EXCEPTION 'Etapa é obrigatória.' USING ERRCODE = '22023';
  END IF;
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero.' USING ERRCODE = '22023';
  END IF;
  IF p_qr_codes IS NULL OR array_length(p_qr_codes, 1) <> p_quantity THEN
    RAISE EXCEPTION 'Quantidade de QRs (%) não bate com p_quantity (%).',
      COALESCE(array_length(p_qr_codes, 1), 0), p_quantity
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.service_voucher_batches (
    event_id, event_stage_id,
    label, service_type, quantity,
    target_meal_window_id, target_trip_id, target_facility_id, target_date,
    created_by
  ) VALUES (
    p_event_id, p_event_stage_id,
    p_label, p_service_type, p_quantity,
    CASE WHEN p_service_type = 'meals'     THEN p_instance_id ELSE NULL END,
    CASE WHEN p_service_type = 'transport' THEN p_instance_id ELSE NULL END,
    CASE WHEN p_service_type = 'lodging'   THEN p_instance_id ELSE NULL END,
    p_target_date,
    auth.uid()
  ) RETURNING id INTO v_batch_id;

  FOREACH v_qr IN ARRAY p_qr_codes LOOP
    INSERT INTO public.service_vouchers (
      event_id, event_stage_id, batch_id,
      voucher_type, is_nominal,
      qr_code_value, status,
      scope_meals, scope_transport, scope_lodging,
      target_meal_window_id, target_trip_id, target_facility_id, target_date
    ) VALUES (
      p_event_id, p_event_stage_id, v_batch_id,
      'aggregate', false,
      btrim(v_qr), 'active',
      p_service_type = 'meals',
      p_service_type = 'transport',
      p_service_type = 'lodging',
      CASE WHEN p_service_type = 'meals'     THEN p_instance_id ELSE NULL END,
      CASE WHEN p_service_type = 'transport' THEN p_instance_id ELSE NULL END,
      CASE WHEN p_service_type = 'lodging'   THEN p_instance_id ELSE NULL END,
      p_target_date
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch_id,
    'created_count', p_quantity
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_voucher_batch_v1(uuid, uuid, text, uuid, date, integer, text, text[]) TO authenticated;

COMMENT ON FUNCTION public.issue_voucher_batch_v1(uuid, uuid, text, uuid, date, integer, text, text[]) IS
  'Emite lote de vouchers anônimos atomicamente. Grava created_by=auth.uid() no lote. Se qualquer voucher falhar, ROLLBACK do batch — sem registros órfãos.';

NOTIFY pgrst, 'reload schema';
