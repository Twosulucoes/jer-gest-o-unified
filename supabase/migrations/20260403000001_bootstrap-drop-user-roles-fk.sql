-- Remove FK user_roles→profiles so admin seed inserts work without auth users in preview.
-- Also insert admin profile as safety net.
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.profiles'::regclass AND contype = 'f'
  LOOP
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

INSERT INTO public.profiles (id, full_name)
VALUES ('5a096804-3eca-47a6-9e4e-e131ef99a3f0', 'Fabiano Vieira')
ON CONFLICT (id) DO NOTHING;
