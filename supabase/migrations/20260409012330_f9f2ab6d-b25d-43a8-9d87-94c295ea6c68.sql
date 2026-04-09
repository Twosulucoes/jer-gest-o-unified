-- Drop the absolute unique constraint
ALTER TABLE public.participant_credentials DROP CONSTRAINT uq_participant_event;

-- Add partial unique index: only one ACTIVE credential per participant+event
CREATE UNIQUE INDEX uq_participant_event_active
  ON public.participant_credentials (participant_id, event_id)
  WHERE status = 'active';

-- Allow 'reissued' status
ALTER TABLE public.participant_credentials DROP CONSTRAINT participant_credentials_status_check;
ALTER TABLE public.participant_credentials ADD CONSTRAINT participant_credentials_status_check
  CHECK (status = ANY (ARRAY['pending', 'active', 'suspended', 'revoked', 'reissued']));