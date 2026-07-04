-- Cria RPC record_transport_boarding para centralizar o registro de embarque
-- e incluir verificação de inscrição na etapa.
-- Substitui os inserts diretos em transport_passengers no PWA e no sync offline.
--
-- Retornos:
--   { ok: true,  id: uuid }                         → embarque registrado
--   { ok: true,  reason: 'ALREADY_BOARDED', id }    → já embarcou (idempotente)
--   { ok: false, reason: 'TRIP_NOT_FOUND' }         → viagem inexistente
--   { ok: false, reason: 'NOT_ENROLLED_IN_STAGE' }  → participante não inscrito na etapa
CREATE OR REPLACE FUNCTION public.record_transport_boarding(
  p_trip_id        uuid,
  p_participant_id uuid,
  p_boarded_by     uuid         DEFAULT NULL,
  p_is_manual      boolean      DEFAULT false,
  p_boarded_at     timestamptz  DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip       RECORD;
  v_existing   RECORD;
  v_new_id     uuid;
BEGIN
  SELECT id, event_stage_id INTO v_trip
  FROM transport_trips
  WHERE id = p_trip_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'TRIP_NOT_FOUND');
  END IF;

  -- Bloqueia embarque se a viagem pertence a uma etapa e o participante
  -- não está inscrito nessa etapa.
  IF v_trip.event_stage_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM participant_event_stages
      WHERE participant_id = p_participant_id
        AND event_stage_id = v_trip.event_stage_id
        AND status = 'active'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'NOT_ENROLLED_IN_STAGE');
    END IF;
  END IF;

  -- Verifica se já existe registro para trip + participante
  SELECT id, status INTO v_existing
  FROM transport_passengers
  WHERE trip_id = p_trip_id AND participant_id = p_participant_id
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.status = 'boarded' THEN
      RETURN jsonb_build_object('ok', true, 'reason', 'ALREADY_BOARDED', 'id', v_existing.id);
    END IF;
    UPDATE transport_passengers
    SET status      = 'boarded',
        boarded_at  = p_boarded_at,
        boarded_by  = p_boarded_by
    WHERE id = v_existing.id;
    RETURN jsonb_build_object('ok', true, 'id', v_existing.id);
  END IF;

  INSERT INTO transport_passengers (trip_id, participant_id, status, boarded_at, boarded_by)
  VALUES (p_trip_id, p_participant_id, 'boarded', p_boarded_at, p_boarded_by)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'id', v_new_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_transport_boarding FROM anon;
GRANT EXECUTE ON FUNCTION public.record_transport_boarding TO authenticated;
