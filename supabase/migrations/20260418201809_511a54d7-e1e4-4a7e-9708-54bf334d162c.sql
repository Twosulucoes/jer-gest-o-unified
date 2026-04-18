CREATE OR REPLACE FUNCTION public.rpc_validate_sport_event_quorum(p_event_id uuid, p_sport_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rules jsonb;
  v_is_collective boolean;
  v_min_individual int;
  v_min_categoria int;
  v_required int;
  v_current int;
  v_team_min int;
BEGIN
  SELECT ser.rules, s.is_collective, ser.team_min_size
    INTO v_rules, v_is_collective, v_team_min
  FROM sport_event_rules ser
  JOIN sport_events se ON se.id = ser.sport_event_id
  JOIN sports s ON s.id = se.sport_id
  WHERE ser.sport_event_id = p_sport_event_id AND ser.event_id = p_event_id
    AND ser.is_active = true
  LIMIT 1;

  IF v_rules IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'current', 0, 'required', 0,
      'reason', 'NO_RULES_DEFINED', 'is_collective', v_is_collective);
  END IF;

  v_min_individual := COALESCE((v_rules->>'minimo_participantes')::int, NULL);
  v_min_categoria  := COALESCE((v_rules->>'minimo_para_categoria')::int, NULL);

  IF v_is_collective THEN
    v_required := COALESCE(v_team_min, 2);
    SELECT COUNT(*) INTO v_current
    FROM teams t
    WHERE t.event_id = p_event_id
      AND t.sport_event_id = p_sport_event_id
      AND COALESCE(t.status, 'active') <> 'inactive';
  ELSE
    v_required := COALESCE(v_min_categoria, v_min_individual, 1);
    SELECT COUNT(*) INTO v_current
    FROM participant_sport_events pse
    WHERE pse.sport_event_id = p_sport_event_id
      AND pse.status = 'apto';
  END IF;

  RETURN jsonb_build_object(
    'ok', v_current >= v_required,
    'current', v_current,
    'required', v_required,
    'is_collective', v_is_collective,
    'reason', CASE WHEN v_current < v_required THEN 'QUORUM_NOT_MET' ELSE 'OK' END
  );
END;
$function$;