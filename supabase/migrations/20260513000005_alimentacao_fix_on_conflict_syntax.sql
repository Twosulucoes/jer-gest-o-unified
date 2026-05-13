-- Corrigir sintaxe ON CONFLICT no RPC record_meal_consumption.
-- ON CONFLICT ON CONSTRAINT só funciona com constraints declarados via
-- ALTER TABLE ... ADD CONSTRAINT. O índice uq_meal_consumptions_active_window
-- é um CREATE UNIQUE INDEX ... WHERE status='active' (partial index),
-- que requer a forma ON CONFLICT (cols) WHERE predicate.
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
  SELECT * INTO v_window
  FROM meal_windows
  WHERE id = p_meal_window_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'WINDOW_NOT_FOUND');
  END IF;

  IF v_window.service_date != v_today THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'WINDOW_WRONG_DATE',
      'window_date', v_window.service_date::text, 'today', v_today::text);
  END IF;

  IF v_time_now < (v_window.start_time::time - interval '15 minutes')
     OR v_time_now > (v_window.end_time::time + interval '15 minutes') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'WINDOW_CLOSED',
      'start', v_window.start_time, 'end', v_window.end_time);
  END IF;

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

  INSERT INTO meal_consumptions (participant_id, meal_window_id, method, registered_by, status)
  VALUES (p_participant_id, p_meal_window_id, p_method, p_registered_by, 'active')
  ON CONFLICT (meal_window_id, participant_id) WHERE (status = 'active')
  DO NOTHING
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
