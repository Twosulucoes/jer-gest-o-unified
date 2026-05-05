-- ============================================================
-- Vouchers — invariante canônico (1 evento × etapa × dia × janela)
-- ============================================================
-- Premissas confirmadas com o usuário:
--   1. Voucher é APENAS para participantes ocasionais (não credenciados).
--      Atletas/comissão/staff usam credentials, não vouchers.
--   2. Cada voucher pertence a UM evento × UMA etapa × UM dia × UMA janela
--      específica (meal_window OU trip OU facility).
--   3. Lotes nascem grudados a uma janela. Quando a janela fecha,
--      vouchers não usados perdem o valor (status='expired').
--
-- Esta migration entrega:
--   A. CHECK de exatamente 1 escopo true.
--   B. CHECK de coerência escopo ↔ target_*_id.
--   C. Trigger BEFORE INSERT que deriva valid_from/valid_until da
--      janela-alvo (meal_window: service_date+start_time/end_time;
--      trip: scheduled_at/arrived_at; facility: target_date).
--   D. Função mark_expired_vouchers() para job/cron.
--   E. COMMENT ON TABLE formalizando o invariante.
-- ============================================================

-- ============================================================
-- A. CHECK: exatamente 1 escopo true.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_vouchers_exactly_one_scope') THEN
    ALTER TABLE public.service_vouchers
      ADD CONSTRAINT service_vouchers_exactly_one_scope
      CHECK (
        (scope_meals::int + scope_transport::int + scope_lodging::int) = 1
      ) NOT VALID;
  END IF;
END $$;

-- Validação preguiçosa: se houver linhas legadas com 0 ou 2+ escopos
-- true, a constraint fica NOT VALID; novos INSERTs continuam enforce.
DO $$
BEGIN
  ALTER TABLE public.service_vouchers VALIDATE CONSTRAINT service_vouchers_exactly_one_scope;
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'Linhas legadas em service_vouchers violam exactly_one_scope — constraint mantido NOT VALID.';
END $$;

-- ============================================================
-- B. CHECK: escopo bate com target_*_id correspondente.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_vouchers_scope_target_match') THEN
    ALTER TABLE public.service_vouchers
      ADD CONSTRAINT service_vouchers_scope_target_match
      CHECK (
        (scope_meals     = TRUE  AND target_meal_window_id IS NOT NULL AND target_trip_id IS NULL     AND target_facility_id IS NULL)
        OR
        (scope_transport = TRUE  AND target_trip_id        IS NOT NULL AND target_meal_window_id IS NULL AND target_facility_id IS NULL)
        OR
        (scope_lodging   = TRUE  AND target_facility_id    IS NOT NULL AND target_meal_window_id IS NULL AND target_trip_id     IS NULL)
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.service_vouchers VALIDATE CONSTRAINT service_vouchers_scope_target_match;
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'Linhas legadas em service_vouchers violam scope_target_match — constraint mantido NOT VALID.';
END $$;

-- ============================================================
-- C. Trigger: deriva valid_from/valid_until da janela-alvo.
-- ============================================================
CREATE OR REPLACE FUNCTION public.derive_voucher_validity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_service_date date;
  v_start_time   time;
  v_end_time     time;
  v_scheduled    timestamptz;
  v_arrived      timestamptz;
  v_target_date  date;
  v_derived_from timestamptz;
  v_derived_to   timestamptz;
BEGIN
  -- Meals: derive de service_date + start_time/end_time da janela.
  IF NEW.target_meal_window_id IS NOT NULL THEN
    SELECT service_date, start_time, end_time
      INTO v_service_date, v_start_time, v_end_time
      FROM public.meal_windows
      WHERE id = NEW.target_meal_window_id;

    IF v_service_date IS NOT NULL AND v_start_time IS NOT NULL THEN
      v_derived_from := (v_service_date::text || ' ' || v_start_time::text)::timestamptz;
    END IF;
    IF v_service_date IS NOT NULL AND v_end_time IS NOT NULL THEN
      v_derived_to := (v_service_date::text || ' ' || v_end_time::text)::timestamptz;
    END IF;

    -- target_date opcional: se vier null, usa service_date.
    IF NEW.target_date IS NULL THEN
      NEW.target_date := v_service_date;
    END IF;

  -- Transport: derive de scheduled_at (e arrived_at se houver).
  ELSIF NEW.target_trip_id IS NOT NULL THEN
    SELECT scheduled_at, arrived_at
      INTO v_scheduled, v_arrived
      FROM public.transport_trips
      WHERE id = NEW.target_trip_id;

    v_derived_from := v_scheduled;
    -- Sem arrived_at, assume janela de 12h (viagem máxima razoável).
    v_derived_to   := COALESCE(v_arrived, v_scheduled + interval '12 hours');

    IF NEW.target_date IS NULL AND v_scheduled IS NOT NULL THEN
      NEW.target_date := v_scheduled::date;
    END IF;

  -- Lodging: derive do target_date passado pelo caller (sem times no schema).
  ELSIF NEW.target_facility_id IS NOT NULL THEN
    v_target_date := NEW.target_date;
    IF v_target_date IS NOT NULL THEN
      v_derived_from := v_target_date::timestamptz;
      v_derived_to   := (v_target_date + interval '1 day')::timestamptz;
    END IF;
  END IF;

  -- Aplica os derivados SOMENTE quando o caller não preencheu.
  IF NEW.valid_from IS NULL AND v_derived_from IS NOT NULL THEN
    NEW.valid_from := v_derived_from;
  END IF;
  IF NEW.valid_until IS NULL AND v_derived_to IS NOT NULL THEN
    NEW.valid_until := v_derived_to;
  END IF;

  -- Recusa emitir voucher já vencido (janela fechou antes da emissão).
  IF NEW.valid_until IS NOT NULL AND NEW.valid_until < now() THEN
    RAISE EXCEPTION 'Não é possível emitir voucher para janela já encerrada (valid_until % < now()).', NEW.valid_until
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_derive_voucher_validity ON public.service_vouchers;
CREATE TRIGGER trg_derive_voucher_validity
  BEFORE INSERT ON public.service_vouchers
  FOR EACH ROW
  EXECUTE FUNCTION public.derive_voucher_validity();

-- ============================================================
-- D. Função para expirar vouchers cujas janelas já fecharam.
--    Pode ser chamada por job (pg_cron) ou manualmente.
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_expired_vouchers()
RETURNS TABLE (expired_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.service_vouchers
    SET status = 'expired',
        updated_at = now()
    WHERE status = 'active'
      AND valid_until IS NOT NULL
      AND valid_until < now()
    RETURNING id
  )
  SELECT count(*)::int INTO v_count FROM updated;

  RETURN QUERY SELECT v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_expired_vouchers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_expired_vouchers() TO authenticated;

-- ============================================================
-- E. Documentação canônica.
-- ============================================================
COMMENT ON TABLE public.service_vouchers IS
  'Vouchers para participantes OCASIONAIS (não credenciados). Atletas/comissão/staff usam participant_credentials, NÃO vouchers. Invariante: 1 voucher = 1 evento × 1 etapa × 1 dia × 1 janela (meal_window | trip | facility). Lotes nascem grudados a uma janela. Quando a janela fecha, vouchers não usados viram status=expired (via mark_expired_vouchers ou trigger BEFORE INSERT que recusa emissão pós-janela). participant_id é resíduo histórico — novos vouchers devem usar eventual_person_id quando nominal, ou nenhum holder quando agregado em batch.';

COMMENT ON COLUMN public.service_vouchers.participant_id IS
  'DEPRECATED. Voucher é para eventuais (eventual_person_id) ou batch agregado (sem holder). Atletas/staff credenciados não recebem voucher — usam credentials.';

COMMENT ON FUNCTION public.derive_voucher_validity() IS
  'Trigger BEFORE INSERT em service_vouchers: deriva valid_from/valid_until da janela-alvo se não passados, e recusa emissão para janela já fechada.';

COMMENT ON FUNCTION public.mark_expired_vouchers() IS
  'Marca como expired todos os vouchers ativos cuja janela já fechou (valid_until < now()). Idempotente. Pode ser agendada via pg_cron ou chamada manualmente.';
