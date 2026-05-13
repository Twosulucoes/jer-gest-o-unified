-- RPC idempotente com validação server-side completa +
-- trigger de elegibilidade (re-aplicar — estava em migration mas não criado em pg_trigger).

-- ─── Função check_meal_consumption_eligibility ───────────────────────
CREATE OR REPLACE FUNCTION public.check_meal_consumption_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_active       boolean;
  v_needs_meals     boolean;
  v_credentialed_at timestamptz;
BEGIN
  SELECT is_active, needs_meals, credentialed_at
    INTO v_is_active, v_needs_meals, v_credentialed_at
    FROM public.participants
    WHERE id = NEW.participant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE  = 'Participante não encontrado para registro de consumo.';
  END IF;

  IF v_is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE  = 'Participante inativo; consumo bloqueado.';
  END IF;

  IF v_needs_meals IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE  = 'Participante sem alimentação; consumo bloqueado.';
  END IF;

  IF v_credentialed_at IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE  = 'Participante sem credencial ativa; consumo bloqueado.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ck_meal_consumption_eligibility ON public.meal_consumptions;
CREATE TRIGGER ck_meal_consumption_eligibility
  BEFORE INSERT ON public.meal_consumptions
  FOR EACH ROW EXECUTE FUNCTION public.check_meal_consumption_eligibility();

-- ─── RPC record_meal_consumption ─────────────────────────────────────
-- Substitui INSERT direto do frontend. Valida:
--   1. Janela existe e está ativa
--   2. Data = hoje (fuso Roraima UTC-4)
--   3. Horário dentro da janela (±15 min de tolerância)
--   4. Regras de eligibility (participant_type / delegation / institution)
--   5. ON CONFLICT idempotente — duplicata vira reason=ALREADY_REGISTERED
CREATE OR REPLACE FUNCTION public.record_meal_consumption(
  p_participant_id uuid,
  p_meal_window_id uuid,
  p_method         text    DEFAULT 'qr',
  p_registered_by  uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window         RECORD;
  v_now_local      timestamptz := (now() AT TIME ZONE 'America/Boa_Vista');
  v_today          date        := v_now_local::date;
  v_time_now       time        := v_now_local::time;
  v_has_rules      boolean;
  v_eligible       boolean;
  v_consumption_id uuid;
BEGIN
  -- 1. Janela ativa existe?
  SELECT * INTO v_window
  FROM meal_windows
  WHERE id = p_meal_window_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'WINDOW_NOT_FOUND');
  END IF;

  -- 2. Data = hoje (Roraima)
  IF v_window.service_date != v_today THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'WINDOW_WRONG_DATE',
      'window_date', v_window.service_date::text, 'today', v_today::text);
  END IF;

  -- 3. Horário ±15 min de tolerância
  IF v_time_now < (v_window.start_time::time - interval '15 minutes')
     OR v_time_now > (v_window.end_time::time + interval '15 minutes') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'WINDOW_CLOSED',
      'start', v_window.start_time, 'end', v_window.end_time);
  END IF;

  -- 4. Regras de eligibility (se definidas para esta janela)
  SELECT EXISTS(
    SELECT 1 FROM meal_window_eligibility WHERE meal_window_id = p_meal_window_id
  ) INTO v_has_rules;

  IF v_has_rules THEN
    SELECT EXISTS (
      SELECT 1 FROM meal_window_eligibility mwe
      WHERE mwe.meal_window_id = p_meal_window_id
        AND (
          (mwe.eligibility_type = 'participant_type'
           AND mwe.participant_type_value = (
             SELECT participant_type::text FROM participants WHERE id = p_participant_id
           ))
          OR
          (mwe.eligibility_type = 'delegation'
           AND mwe.reference_id = (
             SELECT delegation_id FROM participants WHERE id = p_participant_id
           ))
          OR
          (mwe.eligibility_type = 'institution'
           AND mwe.reference_id = (
             SELECT d.institution_id
             FROM participants p2
             JOIN delegations d ON d.id = p2.delegation_id
             WHERE p2.id = p_participant_id
           ))
        )
    ) INTO v_eligible;

    IF NOT v_eligible THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'NOT_ELIGIBLE');
    END IF;
  END IF;

  -- 5. INSERT idempotente
  INSERT INTO meal_consumptions (participant_id, meal_window_id, method, registered_by, status)
  VALUES (p_participant_id, p_meal_window_id, p_method, p_registered_by, 'active')
  ON CONFLICT ON CONSTRAINT uq_meal_consumptions_active_window DO NOTHING
  RETURNING id INTO v_consumption_id;

  IF v_consumption_id IS NULL THEN
    SELECT id INTO v_consumption_id
    FROM meal_consumptions
    WHERE participant_id = p_participant_id
      AND meal_window_id = p_meal_window_id
      AND status = 'active';
    RETURN jsonb_build_object('ok', false, 'reason', 'ALREADY_REGISTERED', 'id', v_consumption_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_consumption_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_meal_consumption FROM anon;
GRANT EXECUTE ON FUNCTION public.record_meal_consumption TO authenticated;
