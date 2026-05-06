-- ============================================================================
-- ALIMENTAÇÃO — L2: RPCs DE ESTORNO/DUPLICIDADE + HARDENING DO REDEEM + CRON
-- Audit IDs cobertos: C1, C2, C5, H4
-- ----------------------------------------------------------------------------
-- Decisões de produto consolidadas (L2):
--   1a) Estorno SEM limite de tempo
--   1b) Estorno SOMENTE admin
--   1c) Motivo: enum fixo (sem campo livre)
--   2)  Híbrido: pg_cron 15min + checagem on-redeem
--   3)  Bloqueio absoluto cross-stage no redeem_voucher
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Enum dos motivos de estorno
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_consumption_reverse_reason') THEN
    CREATE TYPE public.meal_consumption_reverse_reason AS ENUM (
      'duplicidade',
      'participante_errado',
      'janela_errada',
      'lancamento_acidental',
      'incidente_operacional'
    );
  END IF;
END $$;

COMMENT ON TYPE public.meal_consumption_reverse_reason IS
  'Motivos canônicos de estorno de consumo. Sem texto livre — relatórios agrupam por categoria.';

-- ---------------------------------------------------------------------------
-- 2. Atualiza trigger de auditoria para honrar supressão de DELETE
--    (a RPC reverse_meal_consumption emite 'reverse' explicitamente e
--     suprime o 'delete' duplicado durante a transação)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_meal_consumptions_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role  text := public.get_actor_primary_role(v_actor);
  v_skip_delete boolean := COALESCE(current_setting('jer.suppress_meal_audit_delete', true) = 'true', false);
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.meal_audit_logs
      (action, consumption_id, meal_window_id, participant_id,
       before_data, after_data, actor_id, actor_role, source)
    VALUES
      ('insert', NEW.id, NEW.meal_window_id, NEW.participant_id,
       NULL, to_jsonb(NEW), COALESCE(NEW.registered_by, v_actor), v_role, NEW.method);
    RETURN NEW;

  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.meal_audit_logs
      (action, consumption_id, meal_window_id, participant_id,
       before_data, after_data, actor_id, actor_role, source)
    VALUES
      ('update', NEW.id, NEW.meal_window_id, NEW.participant_id,
       to_jsonb(OLD), to_jsonb(NEW), v_actor, v_role, NEW.method);
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    IF NOT v_skip_delete THEN
      INSERT INTO public.meal_audit_logs
        (action, consumption_id, meal_window_id, participant_id,
         before_data, after_data, actor_id, actor_role, source)
      VALUES
        ('delete', OLD.id, OLD.meal_window_id, OLD.participant_id,
         to_jsonb(OLD), NULL, v_actor, v_role, OLD.method);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC reverse_meal_consumption — estorno admin sem limite de tempo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reverse_meal_consumption(
  p_consumption_id uuid,
  p_reason public.meal_consumption_reverse_reason
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role  text := public.get_actor_primary_role(v_actor);
  v_row   public.meal_consumptions%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem estornar consumos' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.meal_consumptions WHERE id = p_consumption_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consumo % não encontrado', p_consumption_id USING ERRCODE = '02000';
  END IF;

  -- 3a. Audit explícito 'reverse' com motivo
  INSERT INTO public.meal_audit_logs
    (action, consumption_id, meal_window_id, participant_id,
     before_data, after_data, actor_id, actor_role, reason, source)
  VALUES
    ('reverse', v_row.id, v_row.meal_window_id, v_row.participant_id,
     to_jsonb(v_row), NULL, v_actor, v_role, p_reason::text, v_row.method);

  -- 3b. Suprime 'delete' duplicado e remove a linha
  PERFORM set_config('jer.suppress_meal_audit_delete', 'true', true);
  DELETE FROM public.meal_consumptions WHERE id = p_consumption_id;
  PERFORM set_config('jer.suppress_meal_audit_delete', 'false', true);

  RETURN jsonb_build_object(
    'ok', true,
    'consumption_id', v_row.id,
    'meal_window_id', v_row.meal_window_id,
    'participant_id', v_row.participant_id,
    'reason', p_reason,
    'reversed_at', now(),
    'reversed_by', v_actor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_meal_consumption(uuid, public.meal_consumption_reverse_reason) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_meal_consumption(uuid, public.meal_consumption_reverse_reason) TO authenticated;

COMMENT ON FUNCTION public.reverse_meal_consumption(uuid, public.meal_consumption_reverse_reason) IS
  'Estorno administrativo de consumo. Apenas admin. Sem limite de tempo. Registra audit "reverse" com motivo enum antes do hard-delete.';

-- ---------------------------------------------------------------------------
-- 4. RPC get_alimentacao_duplicates — referenciada pelo front, faltava no DB
--    Detecta o mesmo participante consumindo o mesmo meal_type no mesmo dia
--    em janelas distintas (a UNIQUE constraint só bloqueia mesma janela).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_alimentacao_duplicates(
  p_event_id uuid DEFAULT NULL,
  p_event_stage_id uuid DEFAULT NULL,
  p_service_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.has_role(v_actor, 'admin')
    OR public.has_role(v_actor, 'secretaria')
    OR public.has_role(v_actor, 'coordenacao_tecnica')
    OR public.has_role(v_actor, 'alimentacao')
  ) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    SELECT
      mc.id AS consumption_id,
      mc.participant_id,
      mc.meal_window_id,
      mc.consumed_at,
      mw.meal_type_id,
      mw.service_date,
      mw.event_id,
      mw.event_stage_id,
      mt.name AS meal_type_name,
      p.full_name AS participant_name
    FROM public.meal_consumptions mc
    JOIN public.meal_windows mw ON mw.id = mc.meal_window_id
    JOIN public.meal_types  mt ON mt.id = mw.meal_type_id
    JOIN public.participants p ON p.id  = mc.participant_id
    WHERE (p_event_id       IS NULL OR mw.event_id        = p_event_id)
      AND (p_event_stage_id IS NULL OR mw.event_stage_id  = p_event_stage_id)
      AND (p_service_date   IS NULL OR mw.service_date    = p_service_date)
  ),
  grouped AS (
    SELECT
      participant_id,
      participant_name,
      service_date,
      meal_type_id,
      meal_type_name,
      event_id,
      event_stage_id,
      count(*) AS occurrences,
      jsonb_agg(jsonb_build_object(
        'consumption_id', consumption_id,
        'meal_window_id', meal_window_id,
        'consumed_at',    consumed_at
      ) ORDER BY consumed_at) AS records
    FROM base
    GROUP BY participant_id, participant_name, service_date,
             meal_type_id, meal_type_name, event_id, event_stage_id
    HAVING count(*) > 1
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(grouped) ORDER BY service_date DESC, participant_name), '[]'::jsonb)
    INTO v_result
    FROM grouped;

  RETURN jsonb_build_object(
    'duplicates', v_result,
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_alimentacao_duplicates(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_alimentacao_duplicates(uuid, uuid, date) TO authenticated;

COMMENT ON FUNCTION public.get_alimentacao_duplicates(uuid, uuid, date) IS
  'Lista duplicidades de consumo: mesmo participante × mesmo meal_type × mesma data em janelas diferentes. Filtros opcionais por evento/etapa/data.';

-- ---------------------------------------------------------------------------
-- 5. redeem_voucher: hardening cross-stage e cross-event
--    - bloqueio absoluto: a janela contexto (p_context_id) DEVE pertencer ao
--      mesmo event_id e (quando o voucher é targetado) à mesma event_stage_id
--      do target_meal_window_id.
--    - Para vouchers sem target (batch agregado), exige que p_context_id
--      pertença ao mesmo event_id do voucher (evita cross-event).
-- ---------------------------------------------------------------------------
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
    v_reference_time timestamp with time zone;
    v_metadata jsonb := '{}'::jsonb;
    v_ctx_event_id uuid;
    v_ctx_stage_id uuid;
    v_target_stage_id uuid;
BEGIN
    v_reference_time := COALESCE(p_offline_at, now());

    IF p_service_kind NOT IN ('transport','meals','lodging') THEN
        RAISE EXCEPTION 'service_kind inválido' USING ERRCODE = '22023';
    END IF;

    v_allowed := CASE p_service_kind
        WHEN 'transport' THEN public.has_role(v_caller,'transporte') OR public.has_role(v_caller,'admin') OR public.has_role(v_caller,'secretaria') OR public.has_role(v_caller,'super_admin')
        WHEN 'meals'     THEN public.has_role(v_caller,'alimentacao') OR public.has_role(v_caller,'admin') OR public.has_role(v_caller,'secretaria') OR public.has_role(v_caller,'super_admin')
        WHEN 'lodging'   THEN public.has_role(v_caller,'alojamento')  OR public.has_role(v_caller,'admin') OR public.has_role(v_caller,'secretaria') OR public.has_role(v_caller,'super_admin')
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

    -- 2. Validade temporal (com auto-marcação de expirado quando online já passou)
    IF v_voucher.valid_until IS NOT NULL AND v_voucher.valid_until < v_reference_time THEN
        v_metadata := jsonb_build_object('valid_until', v_voucher.valid_until);
        IF now() > v_voucher.valid_until THEN
            UPDATE public.service_vouchers SET status='expired' WHERE id = v_voucher.id;
        END IF;
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at, metadata)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'expired', v_caller, p_is_offline, p_offline_at, v_metadata);
        RETURN jsonb_build_object('ok', false, 'reason', 'expired') || v_metadata;
    END IF;

    IF v_voucher.valid_from > v_reference_time THEN
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'not_yet_valid', v_caller, p_is_offline, p_offline_at);
        RETURN jsonb_build_object('ok', false, 'reason', 'not_yet_valid');
    END IF;

    -- 3. Escopo
    IF (p_service_kind = 'transport' AND NOT v_voucher.scope_transport)
       OR (p_service_kind = 'meals'  AND NOT v_voucher.scope_meals)
       OR (p_service_kind = 'lodging' AND NOT v_voucher.scope_lodging) THEN
        INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at)
        VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'scope_denied', v_caller, p_is_offline, p_offline_at);
        RETURN jsonb_build_object('ok', false, 'reason', 'scope_denied');
    END IF;

    -- 4. INSTÂNCIA (target exato)
    IF (p_service_kind = 'meals'    AND v_voucher.target_meal_window_id IS NOT NULL AND v_voucher.target_meal_window_id <> p_context_id)
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

    -- 4b. NOVO — Bloqueio absoluto cross-event/cross-stage para refeições
    IF p_service_kind = 'meals' AND p_context_id IS NOT NULL THEN
        SELECT mw.event_id, mw.event_stage_id
          INTO v_ctx_event_id, v_ctx_stage_id
          FROM public.meal_windows mw
         WHERE mw.id = p_context_id;

        IF v_ctx_event_id IS NULL THEN
            INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at)
            VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'context_not_found', v_caller, p_is_offline, p_offline_at);
            RETURN jsonb_build_object('ok', false, 'reason', 'context_not_found');
        END IF;

        IF v_ctx_event_id <> v_event_id THEN
            v_metadata := jsonb_build_object('voucher_event_id', v_event_id, 'context_event_id', v_ctx_event_id);
            INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at, metadata)
            VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'wrong_event', v_caller, p_is_offline, p_offline_at, v_metadata);
            RETURN jsonb_build_object('ok', false, 'reason', 'wrong_event') || v_metadata;
        END IF;

        -- Stage check: se voucher é targetado, derivar stage do target_meal_window_id
        IF v_voucher.target_meal_window_id IS NOT NULL THEN
            SELECT mw.event_stage_id INTO v_target_stage_id
              FROM public.meal_windows mw
             WHERE mw.id = v_voucher.target_meal_window_id;

            IF v_target_stage_id IS DISTINCT FROM v_ctx_stage_id THEN
                v_metadata := jsonb_build_object(
                    'voucher_stage_id', v_target_stage_id,
                    'context_stage_id', v_ctx_stage_id
                );
                INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at, metadata)
                VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'wrong_stage', v_caller, p_is_offline, p_offline_at, v_metadata);
                RETURN jsonb_build_object('ok', false, 'reason', 'wrong_stage') || v_metadata;
            END IF;
        END IF;
    END IF;

    -- 5. Consumo prévio (nominal)
    IF v_voucher.voucher_type = 'nominal' THEN
        SELECT u.used_at, p.full_name INTO v_prev_usage
          FROM public.service_voucher_uses u
          JOIN public.profiles p ON p.id = u.used_by
         WHERE u.voucher_id = v_voucher.id
           AND u.service_kind = p_service_kind
           AND u.context_id = p_context_id
         LIMIT 1;
        IF FOUND THEN
            v_metadata := jsonb_build_object(
                'used_at', v_prev_usage.used_at,
                'operator_name', v_prev_usage.full_name
            );
            INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at, metadata)
            VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'refused', 'already_used_here', v_caller, p_is_offline, p_offline_at, v_metadata);
            RETURN jsonb_build_object('ok', false, 'reason', 'already_used_here') || v_metadata;
        END IF;
    END IF;

    -- 6. Efetivar consumo
    INSERT INTO public.service_voucher_uses (voucher_id, service_kind, context_id, used_by, used_at)
    VALUES (v_voucher.id, p_service_kind, p_context_id, v_caller, v_reference_time);

    -- 7. Sucesso
    INSERT INTO public.service_voucher_attempts (event_id, voucher_id, qr_value, service_kind, context_id, outcome, reason, attempted_by, is_offline, offline_at)
    VALUES (v_event_id, v_voucher.id, p_qr_value, p_service_kind, p_context_id, 'success', NULL, v_caller, p_is_offline, p_offline_at);

    -- 8. Nome para retorno
    IF v_voucher.is_nominal THEN
        SELECT full_name INTO v_person_name FROM public.service_eventual_people WHERE id = v_voucher.eventual_person_id;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'voucher_type', v_voucher.voucher_type,
        'person_name', v_person_name,
        'label', v_voucher.label,
        'used_at', v_reference_time
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_voucher(text, text, uuid, boolean, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(text, text, uuid, boolean, timestamp with time zone) TO service_role;

COMMENT ON FUNCTION public.redeem_voucher(text, text, uuid, boolean, timestamp with time zone) IS
  'Resgate de voucher com bloqueio absoluto cross-event/cross-stage para refeições. Reasons: not_found|inactive|expired|not_yet_valid|scope_denied|wrong_instance|context_not_found|wrong_event|wrong_stage|already_used_here.';

-- ---------------------------------------------------------------------------
-- 6. pg_cron: agenda mark_expired_vouchers a cada 15 minutos
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- desagenda versão anterior se existir (idempotência)
    PERFORM cron.unschedule(jobid)
       FROM cron.job
      WHERE jobname = 'jer_mark_expired_vouchers';

    PERFORM cron.schedule(
      'jer_mark_expired_vouchers',
      '*/15 * * * *',
      $cron$ SELECT public.mark_expired_vouchers(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron não está disponível neste banco — mark_expired_vouchers deverá ser chamada manualmente.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
