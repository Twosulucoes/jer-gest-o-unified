-- Add expanded result fields to competition_match_results
ALTER TABLE public.competition_match_results
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS time_ms bigint,
  ADD COLUMN IF NOT EXISTS distance_cm bigint,
  ADD COLUMN IF NOT EXISTS points numeric(10,3),
  ADD COLUMN IF NOT EXISTS penalty_notes text;

-- Add check constraint for outcome values
ALTER TABLE public.competition_match_results
  ADD CONSTRAINT chk_outcome_values CHECK (
    outcome IS NULL OR outcome IN (
      'win', 'loss', 'draw',
      'wo_win', 'wo_loss',
      'dsq', 'dns', 'dnf',
      'cancelled'
    )
  );

-- Add check constraints for numeric fields
ALTER TABLE public.competition_match_results
  ADD CONSTRAINT chk_time_ms_positive CHECK (time_ms IS NULL OR time_ms >= 0);

ALTER TABLE public.competition_match_results
  ADD CONSTRAINT chk_distance_cm_positive CHECK (distance_cm IS NULL OR distance_cm >= 0);

ALTER TABLE public.competition_match_results
  ADD CONSTRAINT chk_points_positive CHECK (points IS NULL OR points >= 0);