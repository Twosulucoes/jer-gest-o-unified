-- ============================================================
-- Vouchers — fix timezone na derivação de valid_from/valid_until
-- ============================================================
-- Bug: a sessão Postgres roda em UTC, mas meal_windows.start_time/
-- end_time e lodging target_date representam horário de Brasília
-- (frontend e operadores trabalham em America/Sao_Paulo). A versão
-- anterior do trigger fazia
--   (service_date::text || ' ' || end_time::text)::timestamptz
-- que é interpretado como UTC. Resultado: uma janela que termina
-- 14:00 BRT virava 14:00 UTC (= 11:00 BRT), e a checagem
-- valid_until < now() barrava a emissão de vouchers válidos com a
-- mensagem "janela já encerrada".
--
-- Correção: cast explícito como timestamp (sem TZ) e depois
-- AT TIME ZONE 'America/Sao_Paulo' para obter o timestamptz
-- correto independentemente da TZ da sessão.
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
  v_tz           text := 'America/Sao_Paulo';
BEGIN
  IF NEW.target_meal_window_id IS NOT NULL THEN
    SELECT service_date, start_time, end_time
      INTO v_service_date, v_start_time, v_end_time
      FROM public.meal_windows
      WHERE id = NEW.target_meal_window_id;

    IF v_service_date IS NOT NULL AND v_start_time IS NOT NULL THEN
      v_derived_from := (v_service_date::text || ' ' || v_start_time::text)::timestamp
                         AT TIME ZONE v_tz;
    END IF;
    IF v_service_date IS NOT NULL AND v_end_time IS NOT NULL THEN
      v_derived_to := (v_service_date::text || ' ' || v_end_time::text)::timestamp
                       AT TIME ZONE v_tz;
      -- Janela atravessando meia-noite (end_time < start_time) → +1 dia.
      IF v_end_time < v_start_time THEN
        v_derived_to := v_derived_to + interval '1 day';
      END IF;
    END IF;

    IF NEW.target_date IS NULL THEN
      NEW.target_date := v_service_date;
    END IF;

  ELSIF NEW.target_trip_id IS NOT NULL THEN
    SELECT scheduled_at, arrived_at
      INTO v_scheduled, v_arrived
      FROM public.transport_trips
      WHERE id = NEW.target_trip_id;

    -- transport_trips.scheduled_at já é timestamptz (TZ-aware), nada
    -- a converter — só derivar target_date no fuso local.
    v_derived_from := v_scheduled;
    v_derived_to   := COALESCE(v_arrived, v_scheduled + interval '12 hours');

    IF NEW.target_date IS NULL AND v_scheduled IS NOT NULL THEN
      NEW.target_date := (v_scheduled AT TIME ZONE v_tz)::date;
    END IF;

  ELSIF NEW.target_facility_id IS NOT NULL THEN
    -- Lodging não tem horário no schema → exige target_date explícito.
    IF NEW.target_date IS NULL THEN
      RAISE EXCEPTION 'Voucher de alojamento exige target_date (válido somente neste dia).'
        USING ERRCODE = '22023';
    END IF;
    v_target_date := NEW.target_date;
    -- 00:00 → 00:00 do dia seguinte, no fuso local de Brasília.
    v_derived_from := (v_target_date::text || ' 00:00:00')::timestamp
                       AT TIME ZONE v_tz;
    v_derived_to   := ((v_target_date + 1)::text || ' 00:00:00')::timestamp
                       AT TIME ZONE v_tz;
  END IF;

  IF NEW.valid_from IS NULL AND v_derived_from IS NOT NULL THEN
    NEW.valid_from := v_derived_from;
  END IF;
  IF NEW.valid_until IS NULL AND v_derived_to IS NOT NULL THEN
    NEW.valid_until := v_derived_to;
  END IF;

  IF NEW.valid_until IS NOT NULL AND NEW.valid_until < now() THEN
    RAISE EXCEPTION 'Não é possível emitir voucher para janela já encerrada (valid_until % < now()).', NEW.valid_until
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.derive_voucher_validity() IS
  'Deriva valid_from/valid_until do voucher a partir da janela alvo. Horários de meal_windows e datas de lodging são interpretados em America/Sao_Paulo (operadores trabalham em horário local). Corrige bug em que sessão UTC tornava janelas válidas em "encerradas".';

-- ============================================================
-- Backfill: vouchers ativos cujo valid_until/valid_from foram
-- gravados com a interpretação UTC errada. Recalcula a partir da
-- janela/instância de origem usando a mesma lógica do trigger.
-- ============================================================
DO $$
DECLARE
  v_tz text := 'America/Sao_Paulo';
BEGIN
  -- Meals: recomputa valid_from/valid_until a partir de meal_windows.
  UPDATE public.service_vouchers v
  SET valid_from = (mw.service_date::text || ' ' || mw.start_time::text)::timestamp
                    AT TIME ZONE v_tz,
      valid_until = CASE
        WHEN mw.end_time < mw.start_time THEN
          (mw.service_date::text || ' ' || mw.end_time::text)::timestamp
            AT TIME ZONE v_tz + interval '1 day'
        ELSE
          (mw.service_date::text || ' ' || mw.end_time::text)::timestamp
            AT TIME ZONE v_tz
      END,
      updated_at = now()
  FROM public.meal_windows mw
  WHERE v.target_meal_window_id = mw.id
    AND v.status = 'active';

  -- Lodging: recomputa a partir de target_date (00:00 a 00:00 do
  -- dia seguinte, em horário local).
  UPDATE public.service_vouchers v
  SET valid_from = (v.target_date::text || ' 00:00:00')::timestamp AT TIME ZONE v_tz,
      valid_until = ((v.target_date + 1)::text || ' 00:00:00')::timestamp AT TIME ZONE v_tz,
      updated_at = now()
  WHERE v.target_facility_id IS NOT NULL
    AND v.target_date IS NOT NULL
    AND v.status = 'active';
END $$;

NOTIFY pgrst, 'reload schema';
