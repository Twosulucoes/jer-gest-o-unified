-- ============================================================
-- Vouchers P4 — emissão transacional + realtime publication
-- (auditoria etapa Hqy0B-p4)
-- ============================================================
-- Cobre:
--   1. Garante service_vouchers em supabase_realtime publication
--      (canal usado no frontend para auto-refresh em multi-operador).
--   2. RPC issue_voucher_v1 — emissão individual atomic com
--      validação central (vouchers nominais exigem holder, scope
--      coerente com service_type, etc).
--   3. RPC issue_voucher_batch_v1 — emissão em lote atomic. Se
--      qualquer um dos vouchers falhar, ROLLBACK do batch inteiro.
--      Elimina o cenário hoje possível de "batch criado mas
--      0 vouchers" se o segundo INSERT falhar.
-- ============================================================

-- ============================================================
-- 1. Realtime publication
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Adiciona tabelas ao publication se ainda não estiverem.
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'service_vouchers'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.service_vouchers;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'service_voucher_attempts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.service_voucher_attempts;
    END IF;
  ELSE
    RAISE NOTICE 'Publication supabase_realtime não encontrada — realtime indisponível neste banco.';
  END IF;
END $$;

-- ============================================================
-- 2. issue_voucher_v1 — emissão individual atomic
-- ============================================================
CREATE OR REPLACE FUNCTION public.issue_voucher_v1(
  p_event_id uuid,
  p_event_stage_id uuid,
  p_service_type text,        -- 'meals' | 'transport' | 'lodging'
  p_instance_id uuid,         -- target_meal_window_id | target_trip_id | target_facility_id
  p_target_date date,         -- obrigatório p/ lodging; opcional p/ meals/transport (deriva)
  p_is_nominal boolean,
  p_eventual_person_id uuid,  -- obrigatório se p_is_nominal=true
  p_label text,               -- útil p/ aggregate; opcional p/ nominal
  p_qr_code text              -- gerado pelo client (genQrValue)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_voucher_id uuid;
BEGIN
  IF p_service_type NOT IN ('meals', 'transport', 'lodging') THEN
    RAISE EXCEPTION 'service_type inválido: %', p_service_type USING ERRCODE = '22023';
  END IF;
  IF p_instance_id IS NULL THEN
    RAISE EXCEPTION 'Instância (janela/viagem/local) é obrigatória.' USING ERRCODE = '22023';
  END IF;
  IF p_event_stage_id IS NULL THEN
    RAISE EXCEPTION 'Etapa é obrigatória.' USING ERRCODE = '22023';
  END IF;
  IF p_is_nominal AND p_eventual_person_id IS NULL THEN
    RAISE EXCEPTION 'Voucher nominal exige eventual_person_id.' USING ERRCODE = '22023';
  END IF;
  IF p_qr_code IS NULL OR length(btrim(p_qr_code)) = 0 THEN
    RAISE EXCEPTION 'QR code é obrigatório.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.service_vouchers (
    event_id, event_stage_id,
    voucher_type, is_nominal,
    eventual_person_id,
    qr_code_value, status,
    label,
    scope_meals, scope_transport, scope_lodging,
    target_meal_window_id, target_trip_id, target_facility_id, target_date
  ) VALUES (
    p_event_id, p_event_stage_id,
    CASE WHEN p_is_nominal THEN 'nominal' ELSE 'aggregate' END,
    p_is_nominal,
    CASE WHEN p_is_nominal THEN p_eventual_person_id ELSE NULL END,
    btrim(p_qr_code), 'active',
    p_label,
    p_service_type = 'meals',
    p_service_type = 'transport',
    p_service_type = 'lodging',
    CASE WHEN p_service_type = 'meals' THEN p_instance_id ELSE NULL END,
    CASE WHEN p_service_type = 'transport' THEN p_instance_id ELSE NULL END,
    CASE WHEN p_service_type = 'lodging' THEN p_instance_id ELSE NULL END,
    p_target_date
  ) RETURNING id INTO v_voucher_id;
  -- Trigger derive_voucher_validity preenche valid_from/valid_until
  -- e recusa lodging sem target_date.

  RETURN jsonb_build_object('ok', true, 'voucher_id', v_voucher_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_voucher_v1(uuid, uuid, text, uuid, date, boolean, uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.issue_voucher_v1(uuid, uuid, text, uuid, date, boolean, uuid, text, text) IS
  'Emite voucher individual em uma transação. Validação central (nominal exige holder, scope coerente, etc.). RLS via SECURITY INVOKER. Trigger derive_voucher_validity preenche validity.';

-- ============================================================
-- 3. issue_voucher_batch_v1 — emissão em lote atomic
-- ============================================================
CREATE OR REPLACE FUNCTION public.issue_voucher_batch_v1(
  p_event_id uuid,
  p_event_stage_id uuid,
  p_service_type text,
  p_instance_id uuid,
  p_target_date date,
  p_quantity integer,
  p_label text,
  p_qr_codes text[]            -- array de QR codes gerados pelo client
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

  -- 1. Cria o registro do lote (com event_stage_id do P1).
  INSERT INTO public.service_voucher_batches (
    event_id, event_stage_id,
    label, service_type, quantity,
    target_meal_window_id, target_trip_id, target_facility_id, target_date
  ) VALUES (
    p_event_id, p_event_stage_id,
    p_label, p_service_type, p_quantity,
    CASE WHEN p_service_type = 'meals' THEN p_instance_id ELSE NULL END,
    CASE WHEN p_service_type = 'transport' THEN p_instance_id ELSE NULL END,
    CASE WHEN p_service_type = 'lodging' THEN p_instance_id ELSE NULL END,
    p_target_date
  ) RETURNING id INTO v_batch_id;

  -- 2. Cria N vouchers anônimos. Se qualquer um falhar (trigger
  -- derive_voucher_validity recusa lodging sem target_date, conflito
  -- de QR único, etc.), ROLLBACK do batch inteiro — sem órfão.
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
      CASE WHEN p_service_type = 'meals' THEN p_instance_id ELSE NULL END,
      CASE WHEN p_service_type = 'transport' THEN p_instance_id ELSE NULL END,
      CASE WHEN p_service_type = 'lodging' THEN p_instance_id ELSE NULL END,
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
  'Emite lote de vouchers anônimos atomicamente. Se qualquer voucher falhar, ROLLBACK do batch — sem registros órfãos. RLS via SECURITY INVOKER.';

-- ============================================================
-- 4. Audit trigger AFTER INSERT em service_vouchers
-- (cobre emissão via RPC ou INSERT direto)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_voucher_creation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.service_voucher_audit (
    event_id, issuer_id, voucher_type, payload, status, error_message
  ) VALUES (
    NEW.event_id,
    auth.uid(),
    NEW.voucher_type,
    jsonb_build_object(
      'event_type', CASE WHEN NEW.replaces_voucher_id IS NOT NULL THEN 'reissue' ELSE 'issue' END,
      'voucher_id', NEW.id,
      'event_stage_id', NEW.event_stage_id,
      'qr_code_value', NEW.qr_code_value,
      'is_nominal', NEW.is_nominal,
      'eventual_person_id', NEW.eventual_person_id,
      'batch_id', NEW.batch_id,
      'scope_meals', NEW.scope_meals,
      'scope_transport', NEW.scope_transport,
      'scope_lodging', NEW.scope_lodging,
      'target_meal_window_id', NEW.target_meal_window_id,
      'target_trip_id', NEW.target_trip_id,
      'target_facility_id', NEW.target_facility_id,
      'target_date', NEW.target_date,
      'replaces_voucher_id', NEW.replaces_voucher_id
    ),
    'success',
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_voucher_creation ON public.service_vouchers;
CREATE TRIGGER trg_log_voucher_creation
  AFTER INSERT ON public.service_vouchers
  FOR EACH ROW
  EXECUTE FUNCTION public.log_voucher_creation();

COMMENT ON FUNCTION public.log_voucher_creation() IS
  'Registra em service_voucher_audit toda criação de voucher (issue ou reissue, distinguidos pela presença de replaces_voucher_id). Mantém trilha completa após migração para RPCs issue_voucher_*_v1.';

NOTIFY pgrst, 'reload schema';
