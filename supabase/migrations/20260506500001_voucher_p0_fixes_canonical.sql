-- ============================================================
-- Vouchers — correções P0 (auditoria, etapa Hqy0B)
-- ============================================================
-- Cobre:
--   B2. Trigger derive_voucher_validity recusa lodging sem target_date.
--   B3. redeem_voucher restaura enforce de uso único, max_uses e current_uses
--       para QUALQUER tipo de voucher (nominal e aggregate) quando context_id
--       é informado, e trata context_id NULL como wrong_instance se o voucher
--       tiver target_*_id.
--   B4. Mesma RPC: ausência de context_id em voucher com target → wrong_instance
--       (em vez de aceitar silenciosamente).
--   B5. Clamp de p_offline_at: rejeita futuro; rejeita janela mais velha que
--       24h da hora atual; sempre exige valid_until > now() - tolerância.
-- ============================================================

-- ============================================================
-- B2. Trigger: lodging EXIGE target_date.
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

    v_derived_from := v_scheduled;
    v_derived_to   := COALESCE(v_arrived, v_scheduled + interval '12 hours');

    IF NEW.target_date IS NULL AND v_scheduled IS NOT NULL THEN
      NEW.target_date := v_scheduled::date;
    END IF;

  ELSIF NEW.target_facility_id IS NOT NULL THEN
    -- Lodging não tem horário no schema → exige target_date explícito.
    IF NEW.target_date IS NULL THEN
      RAISE EXCEPTION 'Voucher de alojamento exige target_date (válido somente neste dia).'
        USING ERRCODE = '22023';
    END IF;
    v_target_date := NEW.target_date;
    v_derived_from := v_target_date::timestamptz;
    v_derived_to   := (v_target_date + interval '1 day')::timestamptz;
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

-- ============================================================
-- B3 + B4 + B5. redeem_voucher canônico.
-- ============================================================
CREATE OR REPLACE FUNCTION public.redeem_voucher(
    p_qr_value text,
    p_service_kind text,
    p_context_id uuid DEFAULT NULL,
    p_is_offline boolean DEFAULT false,
    p_offline_at timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_voucher public.service_vouchers%ROWTYPE;
    v_caller uuid := auth.uid();
    v_allowed boolean;
    v_person_name text;
    v_event_id uuid;
    v_prev_usage record;
    v_reference_time timestamptz;
    v_metadata jsonb := '{}'::jsonb;
    v_offline_tolerance interval := interval '24 hours';
    v_has_target boolean;
BEGIN
    -- ---------------------------------------------------------
    -- Clamp de p_offline_at (B5): nunca aceitar futuro nem
    -- timestamp mais antigo que a tolerância (24h por padrão).
    -- Se inválido, força v_reference_time = now() (pior caso para
    -- o operador, melhor caso para a integridade do voucher).
    -- ---------------------------------------------------------
    IF p_is_offline AND p_offline_at IS NOT NULL THEN
        IF p_offline_at > now() THEN
            -- Clock futuro: ignora o offline_at e usa now().
            v_reference_time := now();
        ELSIF p_offline_at < now() - v_offline_tolerance THEN
            -- Leitura offline mais velha que 24h: rejeita explicitamente.
            INSERT INTO public.service_voucher_attempts
              (qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at)
              VALUES (p_qr_value, p_service_kind, p_context_id, 'refused', 'offline_too_old', v_caller, p_is_offline, p_offline_at);
            RETURN jsonb_build_object('ok', false, 'reason', 'offline_too_old');
        ELSE
            v_reference_time := p_offline_at;
        END IF;
    ELSE
        v_reference_time := now();
    END IF;

    IF p_service_kind NOT IN ('transport','meals','lodging') THEN
        RAISE EXCEPTION 'service_kind inválido' USING ERRCODE = '22023';
    END IF;

    v_allowed := CASE p_service_kind
        WHEN 'transport' THEN public.has_role(v_caller,'transporte') OR public.has_role(v_caller,'admin') OR public.has_role(v_caller,'secretaria') OR public.has_role(v_caller,'super_admin')
        WHEN 'meals'     THEN public.has_role(v_caller,'alimentacao') OR public.has_role(v_caller,'admin') OR public.has_role(v_caller,'secretaria') OR public.has_role(v_caller,'super_admin')
        WHEN 'lodging'   THEN public.has_role(v_caller,'alojamento') OR public.has_role(v_caller,'admin') OR public.has_role(v_caller,'secretaria') OR public.has_role(v_caller,'super_admin')
    END;

    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Sem permissão para validar este serviço' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_voucher FROM public.service_vouchers
    WHERE qr_code_value = p_qr_value FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.service_voucher_attempts (qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at)
        VALUES (p_qr_value, p_service_kind, p_context_id, 'refused', 'not_found', v_caller, p_is_offline, p_offline_at);
        RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;

    v_event_id := v_voucher.event_id;

    -- 1. Status
    IF v_voucher.status <> 'active' THEN
        v_metadata := jsonb_build_object('status', v_voucher.status);
        IF v_voucher.status = 'revoked' THEN
            v_metadata := v_metadata || jsonb_build_object('revocation_reason', v_voucher.revoke_reason);
        END IF;
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at, metadata)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'inactive', v_caller, p_is_offline, p_offline_at, v_metadata);
        RETURN jsonb_build_object('ok', false, 'reason', 'inactive') || v_metadata;
    END IF;

    -- 2. Validade temporal — usa v_reference_time (clamp já aplicado).
    IF v_voucher.valid_until IS NOT NULL AND v_voucher.valid_until < v_reference_time THEN
        v_metadata := jsonb_build_object('valid_until', v_voucher.valid_until);
        IF now() > v_voucher.valid_until THEN
            UPDATE public.service_vouchers SET status='expired', updated_at = now() WHERE id = v_voucher.id;
        END IF;
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at, metadata)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'expired', v_caller, p_is_offline, p_offline_at, v_metadata);
        RETURN jsonb_build_object('ok', false, 'reason', 'expired') || v_metadata;
    END IF;

    -- Defesa em profundidade: vouchers SEM valid_until são suspeitos
    -- (deveriam vir derivados pelo trigger). Recusa para não permitir
    -- vouchers eternos em produção.
    IF v_voucher.valid_until IS NULL THEN
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'missing_validity', v_caller, p_is_offline, p_offline_at);
        RETURN jsonb_build_object('ok', false, 'reason', 'missing_validity');
    END IF;

    IF v_voucher.valid_from IS NOT NULL AND v_voucher.valid_from > v_reference_time THEN
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'not_yet_valid', v_caller, p_is_offline, p_offline_at);
        RETURN jsonb_build_object('ok', false, 'reason', 'not_yet_valid');
    END IF;

    -- 3. Escopo
    IF (p_service_kind = 'transport' AND NOT v_voucher.scope_transport)
       OR (p_service_kind = 'meals'   AND NOT v_voucher.scope_meals)
       OR (p_service_kind = 'lodging' AND NOT v_voucher.scope_lodging) THEN
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'scope_denied', v_caller, p_is_offline, p_offline_at);
        RETURN jsonb_build_object('ok', false, 'reason', 'scope_denied');
    END IF;

    -- 4. Instância (B4): se o voucher tem target_*_id e o caller não passou
    -- p_context_id ou passou um diferente, é wrong_instance — NÃO mais aceita
    -- silenciosamente quando p_context_id é NULL.
    v_has_target := (
        (p_service_kind = 'meals'     AND v_voucher.target_meal_window_id IS NOT NULL) OR
        (p_service_kind = 'transport' AND v_voucher.target_trip_id IS NOT NULL)        OR
        (p_service_kind = 'lodging'   AND v_voucher.target_facility_id IS NOT NULL)
    );

    IF v_has_target AND p_context_id IS NULL THEN
        v_metadata := jsonb_build_object(
            'correct_instance', COALESCE(v_voucher.target_meal_window_id::text, v_voucher.target_trip_id::text, v_voucher.target_facility_id::text),
            'attempted_instance', NULL
        );
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at, metadata)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'wrong_instance', v_caller, p_is_offline, p_offline_at, v_metadata);
        RETURN jsonb_build_object('ok', false, 'reason', 'wrong_instance') || v_metadata;
    END IF;

    IF (p_service_kind = 'meals'     AND v_voucher.target_meal_window_id IS NOT NULL AND v_voucher.target_meal_window_id <> p_context_id)
       OR (p_service_kind = 'transport' AND v_voucher.target_trip_id        IS NOT NULL AND v_voucher.target_trip_id        <> p_context_id)
       OR (p_service_kind = 'lodging'   AND v_voucher.target_facility_id    IS NOT NULL AND v_voucher.target_facility_id    <> p_context_id) THEN
        v_metadata := jsonb_build_object(
            'correct_instance', COALESCE(v_voucher.target_meal_window_id::text, v_voucher.target_trip_id::text, v_voucher.target_facility_id::text),
            'attempted_instance', p_context_id::text
        );
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at, metadata)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'wrong_instance', v_caller, p_is_offline, p_offline_at, v_metadata);
        RETURN jsonb_build_object('ok', false, 'reason', 'wrong_instance') || v_metadata;
    END IF;

    -- 5. Consumo prévio (B3): aplica a TODOS os tipos quando há context_id.
    -- Voucher canônico = 1 evento × 1 etapa × 1 dia × 1 janela; cada QR
    -- aceita 1 consumo na sua janela. Aggregate (lote) é um QR distinto por
    -- pessoa, então 1 consumo cada.
    IF p_context_id IS NOT NULL THEN
        SELECT u.used_at, p.full_name AS operator_name
          INTO v_prev_usage
          FROM public.service_voucher_uses u
          LEFT JOIN public.profiles p ON p.id = u.used_by
         WHERE u.voucher_id = v_voucher.id
           AND u.service_kind = p_service_kind
           AND u.context_id = p_context_id
         LIMIT 1;

        IF FOUND THEN
            v_metadata := jsonb_build_object(
                'used_at', v_prev_usage.used_at,
                'operator_name', v_prev_usage.operator_name
            );
            INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at, metadata)
            VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'already_used_here', v_caller, p_is_offline, p_offline_at, v_metadata);
            RETURN jsonb_build_object('ok', false, 'reason', 'already_used_here') || v_metadata;
        END IF;
    END IF;

    -- 6. max_uses (B3): se o voucher define teto, respeita.
    IF v_voucher.max_uses IS NOT NULL AND v_voucher.current_uses >= v_voucher.max_uses THEN
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'max_uses_reached', v_caller, p_is_offline, p_offline_at);
        RETURN jsonb_build_object('ok', false, 'reason', 'max_uses_reached');
    END IF;

    -- 7. Efetiva consumo + incrementa current_uses.
    INSERT INTO public.service_voucher_uses (voucher_id, service_kind, context_id, used_by, used_at)
    VALUES (v_voucher.id, p_service_kind, p_context_id, v_caller, v_reference_time);

    UPDATE public.service_vouchers
       SET current_uses = current_uses + 1,
           updated_at = now()
     WHERE id = v_voucher.id;

    INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at)
    VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'success', NULL, v_caller, p_is_offline, p_offline_at);

    IF v_voucher.is_nominal THEN
        IF v_voucher.eventual_person_id IS NOT NULL THEN
            SELECT full_name INTO v_person_name FROM public.service_eventual_people WHERE id = v_voucher.eventual_person_id;
        ELSIF v_voucher.participant_id IS NOT NULL THEN
            SELECT pe.full_name INTO v_person_name
              FROM public.participants pa
              JOIN public.people pe ON pe.id = pa.person_id
             WHERE pa.id = v_voucher.participant_id;
        END IF;
    ELSE
        v_person_name := v_voucher.label;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'voucher_type', v_voucher.voucher_type,
        'person_name', v_person_name,
        'label', v_voucher.label,
        'used_at', v_reference_time,
        'remaining_uses', CASE WHEN v_voucher.max_uses IS NULL THEN NULL ELSE v_voucher.max_uses - (v_voucher.current_uses + 1) END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_voucher(text, text, uuid, boolean, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(text, text, uuid, boolean, timestamp with time zone) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION public.redeem_voucher(text, text, uuid, boolean, timestamp with time zone) IS
  'Resgate canônico de voucher: 1 evento × 1 etapa × 1 dia × 1 janela. Recusa: not_found, inactive, expired, missing_validity, not_yet_valid, scope_denied, wrong_instance (incl. context_id NULL com voucher target), already_used_here, max_uses_reached, offline_too_old. Clamp de p_offline_at: futuro vira now(); >24h é offline_too_old. Atualiza current_uses no sucesso.';
