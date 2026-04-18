-- Add draft/publish control columns to competition_phases
ALTER TABLE public.competition_phases
  ADD COLUMN IF NOT EXISTS disputes_published_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS disputes_published_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS disputes_unpublished_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS disputes_updated_at timestamptz DEFAULT NULL;

-- Index for quick lookup of published phases
CREATE INDEX IF NOT EXISTS idx_competition_phases_published
  ON public.competition_phases (sport_event_id)
  WHERE disputes_published_at IS NOT NULL;