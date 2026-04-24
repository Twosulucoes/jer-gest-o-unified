-- Bootstrap: sports, categories, venues, disciplinary_cases
-- These tables were pre-existing in production but never captured in migrations.
-- Note: venues is created without event_stage_id (added later via ALTER TABLE in 20260420194547).

CREATE TABLE IF NOT EXISTS public.sports (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  slug           text        NOT NULL,
  is_collective  boolean     NOT NULL DEFAULT false,
  is_paralympic  boolean     NOT NULL DEFAULT false,
  match_config   jsonb       NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, slug)
);

CREATE TABLE IF NOT EXISTS public.categories (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  slug            text        NOT NULL,
  gender_scope    text        NOT NULL DEFAULT 'mixed',
  min_birth_year  integer,
  max_birth_year  integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, slug)
);

-- venues: event_stage_id column is added later by migration 20260420194547
CREATE TABLE IF NOT EXISTS public.venues (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  venue_type  text        NOT NULL DEFAULT 'generic',
  address     text,
  city        text,
  is_active   boolean     NOT NULL DEFAULT true,
  seed_tag    text,
  seed_batch_id text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.disciplinary_cases (
  id                         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id                   uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  case_type                  text        NOT NULL,
  status                     text        NOT NULL DEFAULT 'open',
  opened_at                  timestamptz NOT NULL DEFAULT now(),
  target_participant_id      uuid,
  target_delegation_id       uuid,
  complainant_participant_id uuid,
  source_match_id            uuid,
  source_incident_id         uuid,
  facts                      text,
  evidence_notes             text,
  decision_summary           text,
  minutes_after_event        integer,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);
