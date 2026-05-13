-- Helper function: returns participant IDs that do NOT have an active credential
-- Used by the admin Participantes page QR status filter.
CREATE OR REPLACE FUNCTION admin_get_participants_sem_qr(p_event_id uuid)
RETURNS TABLE (participant_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM participants p
  WHERE p.event_id = p_event_id
    AND NOT EXISTS (
      SELECT 1 FROM participant_credentials pc
      WHERE pc.participant_id = p.id
        AND pc.event_id = p_event_id
        AND pc.status = 'active'
    );
$$;

GRANT EXECUTE ON FUNCTION admin_get_participants_sem_qr(uuid) TO authenticated;
