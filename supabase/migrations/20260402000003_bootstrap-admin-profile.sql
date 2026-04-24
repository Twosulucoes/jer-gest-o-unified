-- Remove FK from profiles to auth.users so preview branch works without seeded auth users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Insert admin profile so subsequent migrations can reference it
INSERT INTO public.profiles (id, full_name)
VALUES ('5a096804-3eca-47a6-9e4e-e131ef99a3f0', 'Fabiano Vieira')
ON CONFLICT (id) DO NOTHING;
