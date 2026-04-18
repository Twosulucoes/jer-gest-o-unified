-- Atribuição operacional de local padrão por pesquisador
ALTER TABLE public.pesquisa_researchers
  ADD COLUMN IF NOT EXISTS assigned_location text;

CREATE OR REPLACE FUNCTION public.pesquisa_login_with_pin(p_pin text, p_device_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_researcher record;
  v_event record;
  v_session_id uuid;
  v_expires_at timestamptz;
BEGIN
  SELECT r.id, r.name, r.event_id, r.pin_hash, r.assigned_location
  INTO v_researcher
  FROM pesquisa_researchers r
  WHERE r.active = true AND pesquisa_verify_pin(p_pin, r.pin_hash)
  LIMIT 1;

  IF v_researcher IS NULL THEN
    RETURN json_build_object('error', 'PIN_INVALID');
  END IF;

  SELECT e.id, e.name, e.location, e.event_date
  INTO v_event
  FROM pesquisa_events e
  WHERE e.id = v_researcher.event_id AND e.active = true;

  IF v_event IS NULL THEN
    RETURN json_build_object('error', 'EVENT_INACTIVE');
  END IF;

  v_expires_at := now() + interval '24 hours';
  INSERT INTO pesquisa_sessions (researcher_id, event_id, device_id, expires_at)
  VALUES (v_researcher.id, v_researcher.event_id, p_device_id, v_expires_at)
  RETURNING id INTO v_session_id;

  UPDATE pesquisa_researchers SET last_login_at = now() WHERE id = v_researcher.id;

  RETURN json_build_object(
    'session_id', v_session_id,
    'expires_at', v_expires_at,
    'researcher', json_build_object(
      'id', v_researcher.id,
      'name', v_researcher.name,
      'event_id', v_researcher.event_id,
      'assigned_location', v_researcher.assigned_location
    ),
    'event', json_build_object('id', v_event.id, 'name', v_event.name, 'location', v_event.location, 'event_date', v_event.event_date)
  );
END;
$$;
