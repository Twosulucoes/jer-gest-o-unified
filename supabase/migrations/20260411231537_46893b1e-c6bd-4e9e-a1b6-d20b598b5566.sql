
DO $$
DECLARE
  v_event_id uuid := 'ee66d634-8d2e-489c-9f8c-b07297dcd710';
  v_participant record;
  v_credential_code text;
  v_qr_code_value text;
  v_count int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.events
    WHERE id = v_event_id
  ) THEN
    RAISE NOTICE 'Skipping seed because event % not found', v_event_id;
    RETURN;
  END IF;
FOR v_participant IN
    SELECT p.id as participant_id
    FROM participants p
    LEFT JOIN participant_credentials pc 
      ON pc.participant_id = p.id 
      AND pc.event_id = p.event_id 
      AND pc.status = 'active'
    WHERE p.event_id = v_event_id
      AND p.participant_type IN ('athlete', 'coach', 'head_of_delegation', 'staff')
      AND pc.id IS NULL
  LOOP
    v_credential_code := 'JER-' || upper(to_hex(extract(epoch from clock_timestamp())::bigint)) || '-' || upper(substr(md5(random()::text), 1, 4));
    v_qr_code_value := 'jer:' || v_event_id || ':' || v_participant.participant_id || ':' || v_credential_code;

    INSERT INTO participant_credentials (
      event_id, participant_id, credential_code, qr_code_value,
      status, binding_source, external_system,
      issued_at, activated_at
    ) VALUES (
      v_event_id, v_participant.participant_id, v_credential_code, v_qr_code_value,
      'active', 'manual', 'jer_gestao',
      now(), now()
    );

    UPDATE participants SET status = 'credentialed' WHERE id = v_participant.participant_id;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Credenciais emitidas: %', v_count;
END;
$$;

