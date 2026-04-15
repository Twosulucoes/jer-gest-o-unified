
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS coach_name TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS coach_phone TEXT;
