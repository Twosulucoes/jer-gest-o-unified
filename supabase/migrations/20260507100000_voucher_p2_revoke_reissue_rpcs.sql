-- ============================================================
-- Vouchers P2 — RPCs canônicas (revoke, revoke_batch, reissue)
-- + revalidação on-update (auditoria etapa Hqy0B-p2)
-- ============================================================
-- Cobre:
--   1. RPC revoke_voucher_v1(p_voucher_id, p_reason) — atomic, com
--      checagem de stage access (RLS já cobre, mas a RPC valida cedo
--      para mensagem clara) e idempotência (segundo call em voucher
--      já revogado retorna noop=true).
--   2. RPC revoke_voucher_batch_v1(p_batch_id, p_reason) — revoga em
--      cascata todos os vouchers ativos do lote em UMA transação.
--   3. RPC reissue_voucher_v1(p_voucher_id, p_reason) — invalida o
--      antigo e cria o novo na mesma transação, com checagem de
--      janela ainda aberta. Lock pessimista do row antigo evita
--      duplo-clique criar 2 reissues.
--   4. Trigger BEFORE UPDATE em service_vouchers que recalcula
--      valid_from/valid_until quando target_*_id ou target_date mudam
--      (defesa em profundidade: hoje a UI não permite editar, mas
--      qualquer manutenção manual via SQL passa a ser segura).
-- ============================================================

-- ============================================================
-- 1. revoke_voucher_v1
-- ============================================================
CREATE OR REPLACE FUNCTION public.revoke_voucher_v1(
  p_voucher_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_voucher public.service_vouchers%ROWTYPE;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Motivo da revogação é obrigatório.' USING ERRCODE = '22023';
  END IF;

  -- Lock pessimista. RLS aplicada (SECURITY INVOKER) — usuário sem
  -- acesso à etapa do voucher recebe NOT FOUND e a RPC retorna erro.
  SELECT * INTO v_voucher
    FROM public.service_vouchers
   WHERE id = p_voucher_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher não encontrado ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  -- Idempotente: se já está revogado, retorna noop=true sem rewrite.
  IF v_voucher.status = 'revoked' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'noop', true,
      'voucher_id', v_voucher.id,
      'status', v_voucher.status,
      'revoke_reason', v_voucher.revoke_reason
    );
  END IF;

  IF v_voucher.status NOT IN ('active', 'expired') THEN
    RAISE EXCEPTION 'Não é possível revogar voucher com status %.', v_voucher.status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.service_vouchers
     SET status = 'revoked',
         revoked_at = now(),
         revoke_reason = btrim(p_reason),
         updated_at = now()
   WHERE id = p_voucher_id;
  -- Trigger log_voucher_status_change registra em service_voucher_audit.

  RETURN jsonb_build_object(
    'ok', true,
    'noop', false,
    'voucher_id', p_voucher_id,
    'status', 'revoked'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_voucher_v1(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.revoke_voucher_v1(uuid, text) IS
  'Revoga voucher individual. Idempotente (revoga já revogado retorna noop). Lock pessimista evita race em duplo-clique. RLS via SECURITY INVOKER. Audit gerado pelo trigger log_voucher_status_change.';

-- ============================================================
-- 2. revoke_voucher_batch_v1
-- ============================================================
CREATE OR REPLACE FUNCTION public.revoke_voucher_batch_v1(
  p_batch_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Motivo da revogação é obrigatório.' USING ERRCODE = '22023';
  END IF;

  WITH updated AS (
    UPDATE public.service_vouchers
       SET status = 'revoked',
           revoked_at = now(),
           revoke_reason = '[Lote] ' || btrim(p_reason),
           updated_at = now()
     WHERE batch_id = p_batch_id
       AND status = 'active'
    RETURNING id
  )
  SELECT count(*)::int INTO v_count FROM updated;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', p_batch_id,
    'revoked_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_voucher_batch_v1(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.revoke_voucher_batch_v1(uuid, text) IS
  'Revoga em cascata todos vouchers ativos do lote em uma transação. Idempotente (re-execução não afeta vouchers já revogados — WHERE status=active). Audit por voucher gerado pelo trigger log_voucher_status_change.';

-- ============================================================
-- 3. reissue_voucher_v1
-- ============================================================
CREATE OR REPLACE FUNCTION public.reissue_voucher_v1(
  p_voucher_id uuid,
  p_reason text,
  p_new_qr text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_old public.service_vouchers%ROWTYPE;
  v_new_id uuid;
  v_existing_reissue uuid;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Motivo da reemissão é obrigatório.' USING ERRCODE = '22023';
  END IF;
  IF p_new_qr IS NULL OR length(btrim(p_new_qr)) = 0 THEN
    RAISE EXCEPTION 'Novo QR é obrigatório.' USING ERRCODE = '22023';
  END IF;

  -- Lock pessimista do voucher original. Race de duplo-clique:
  -- segundo call espera a transação anterior acabar; nesse ponto o
  -- voucher original já está 'revoked' e a checagem abaixo barra.
  SELECT * INTO v_old
    FROM public.service_vouchers
   WHERE id = p_voucher_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher original não encontrado ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  -- Janela ainda aberta? Reemissão não faz sentido para janela fechada.
  IF v_old.valid_until IS NOT NULL AND v_old.valid_until < now() THEN
    RAISE EXCEPTION 'Janela do voucher original já fechou — emita um voucher novo na janela atual.'
      USING ERRCODE = '22023';
  END IF;

  -- Já existe um reissue ativo deste voucher? Idempotência defensiva.
  SELECT id INTO v_existing_reissue
    FROM public.service_vouchers
   WHERE replaces_voucher_id = p_voucher_id
     AND status = 'active'
   LIMIT 1;

  IF v_existing_reissue IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'noop', true,
      'old_voucher_id', p_voucher_id,
      'new_voucher_id', v_existing_reissue,
      'message', 'Reemissão já efetuada anteriormente.'
    );
  END IF;

  -- Caso de borda: voucher já revogado por outro motivo. Recusa.
  IF v_old.status <> 'active' THEN
    RAISE EXCEPTION 'Voucher original não está ativo (status=%).', v_old.status
      USING ERRCODE = '22023';
  END IF;

  -- 1. Invalida antigo (trigger gera audit).
  UPDATE public.service_vouchers
     SET status = 'revoked',
         revoked_at = now(),
         revoke_reason = '[Reemissão] ' || btrim(p_reason),
         updated_at = now()
   WHERE id = p_voucher_id;

  -- 2. Cria novo. Trigger derive_voucher_validity recalcula validade
  -- a partir da janela-alvo (valid_from/valid_until = NULL para forçar).
  INSERT INTO public.service_vouchers (
    event_id, event_stage_id, participant_id, eventual_person_id,
    qr_code_value, status, voucher_type, is_nominal, label,
    scope_meals, scope_transport, scope_lodging,
    target_meal_window_id, target_trip_id, target_facility_id, target_date,
    max_uses, replaces_voucher_id, reissued_at, notes
  ) VALUES (
    v_old.event_id, v_old.event_stage_id, v_old.participant_id, v_old.eventual_person_id,
    btrim(p_new_qr), 'active', v_old.voucher_type, v_old.is_nominal, v_old.label,
    v_old.scope_meals, v_old.scope_transport, v_old.scope_lodging,
    v_old.target_meal_window_id, v_old.target_trip_id, v_old.target_facility_id, v_old.target_date,
    v_old.max_uses, v_old.id, now(),
    'Reemissão de ' || v_old.qr_code_value || '. Motivo: ' || btrim(p_reason)
  ) RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'ok', true,
    'noop', false,
    'old_voucher_id', p_voucher_id,
    'new_voucher_id', v_new_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reissue_voucher_v1(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.reissue_voucher_v1(uuid, text, text) IS
  'Reemite voucher: revoga o antigo e cria novo (mesma janela/escopo) em UMA transação. Lock pessimista + checagem de reissue ativo previnem duplicação por duplo-clique. Audit do antigo gerado pelo trigger log_voucher_status_change.';

-- ============================================================
-- 4. Trigger BEFORE UPDATE em service_vouchers — revalida validade
-- quando target_*_id ou target_date mudam.
-- ============================================================
CREATE OR REPLACE FUNCTION public.revalidate_voucher_validity_on_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_service_date date;
  v_start_time   time;
  v_end_time     time;
  v_scheduled    timestamptz;
  v_arrived      timestamptz;
  v_target_changed boolean;
BEGIN
  -- Só dispara quando target ou target_date mudam.
  v_target_changed :=
    NEW.target_meal_window_id IS DISTINCT FROM OLD.target_meal_window_id
    OR NEW.target_trip_id     IS DISTINCT FROM OLD.target_trip_id
    OR NEW.target_facility_id IS DISTINCT FROM OLD.target_facility_id
    OR NEW.target_date        IS DISTINCT FROM OLD.target_date;

  IF NOT v_target_changed THEN
    RETURN NEW;
  END IF;

  -- Limpa as validades atuais para forçar a derivação abaixo.
  NEW.valid_from := NULL;
  NEW.valid_until := NULL;

  IF NEW.target_meal_window_id IS NOT NULL THEN
    SELECT service_date, start_time, end_time
      INTO v_service_date, v_start_time, v_end_time
      FROM public.meal_windows
     WHERE id = NEW.target_meal_window_id;

    IF v_service_date IS NOT NULL AND v_start_time IS NOT NULL THEN
      NEW.valid_from := (v_service_date::text || ' ' || v_start_time::text)::timestamptz;
    END IF;
    IF v_service_date IS NOT NULL AND v_end_time IS NOT NULL THEN
      NEW.valid_until := (v_service_date::text || ' ' || v_end_time::text)::timestamptz;
      IF v_end_time < v_start_time THEN
        NEW.valid_until := NEW.valid_until + interval '1 day';
      END IF;
    END IF;
    IF NEW.target_date IS NULL THEN
      NEW.target_date := v_service_date;
    END IF;

  ELSIF NEW.target_trip_id IS NOT NULL THEN
    SELECT scheduled_at, arrived_at INTO v_scheduled, v_arrived
      FROM public.transport_trips WHERE id = NEW.target_trip_id;
    NEW.valid_from := v_scheduled;
    NEW.valid_until := COALESCE(v_arrived, v_scheduled + interval '12 hours');
    IF NEW.target_date IS NULL AND v_scheduled IS NOT NULL THEN
      NEW.target_date := v_scheduled::date;
    END IF;

  ELSIF NEW.target_facility_id IS NOT NULL THEN
    IF NEW.target_date IS NULL THEN
      RAISE EXCEPTION 'Voucher de alojamento exige target_date.' USING ERRCODE = '22023';
    END IF;
    NEW.valid_from := NEW.target_date::timestamptz;
    NEW.valid_until := (NEW.target_date + interval '1 day')::timestamptz;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revalidate_voucher_validity ON public.service_vouchers;
CREATE TRIGGER trg_revalidate_voucher_validity
  BEFORE UPDATE OF target_meal_window_id, target_trip_id, target_facility_id, target_date
  ON public.service_vouchers
  FOR EACH ROW
  EXECUTE FUNCTION public.revalidate_voucher_validity_on_update();

COMMENT ON FUNCTION public.revalidate_voucher_validity_on_update() IS
  'Defesa em profundidade: se target_*_id ou target_date mudarem em UPDATE, recalcula valid_from/valid_until da nova janela-alvo. Não há UI que permita isso hoje, mas qualquer manutenção manual via SQL fica segura.';

NOTIFY pgrst, 'reload schema';
