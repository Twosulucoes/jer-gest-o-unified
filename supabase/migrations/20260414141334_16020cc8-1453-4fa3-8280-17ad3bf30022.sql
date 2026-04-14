-- P0-1: Prevent double meal consumption per person per window
ALTER TABLE public.meal_consumptions
  ADD CONSTRAINT uq_meal_consumptions_window_participant
  UNIQUE (meal_window_id, participant_id);

-- P1-2: Add pdf_url column to official_bulletins for PDF attachment
ALTER TABLE public.official_bulletins
  ADD COLUMN IF NOT EXISTS pdf_url text;