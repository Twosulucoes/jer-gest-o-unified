-- Create lodging_supervisions table (missing from migration history)
-- Definition recovered from production schema

CREATE SEQUENCE IF NOT EXISTS public.lodging_supervisions_id_seq;

CREATE TABLE IF NOT EXISTS public.lodging_supervisions (
  id                        bigint      NOT NULL DEFAULT nextval('public.lodging_supervisions_id_seq'::regclass),
  event_id                  uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  delegation_id             uuid        NOT NULL REFERENCES public.delegations(id) ON DELETE CASCADE,
  location_id               uuid        REFERENCES public.lodging_locations(id) ON DELETE SET NULL,
  responsible_participant_id uuid       NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  responsible_gender        text,
  started_at                timestamptz NOT NULL DEFAULT now(),
  ended_at                  timestamptz,
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lodging_supervisions_pkey PRIMARY KEY (id)
);

ALTER SEQUENCE public.lodging_supervisions_id_seq OWNED BY public.lodging_supervisions.id;

ALTER TABLE public.lodging_supervisions ENABLE ROW LEVEL SECURITY;
