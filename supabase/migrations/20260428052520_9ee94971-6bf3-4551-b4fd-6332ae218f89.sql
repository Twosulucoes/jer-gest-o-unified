ALTER TABLE public.meal_windows 
ADD COLUMN capacity INTEGER;

COMMENT ON COLUMN public.meal_windows.capacity IS 'Physical or contractual capacity limit for this meal window.';