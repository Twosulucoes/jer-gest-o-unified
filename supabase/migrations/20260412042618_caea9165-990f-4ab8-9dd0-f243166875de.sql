
-- Add active column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Create helper function
CREATE OR REPLACE FUNCTION public.is_admin_or_secretaria()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'secretaria')
      AND p.active = true
  )
$$;

-- Allow admin/secretaria to update any profile
CREATE POLICY "Admin secretaria can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin_or_secretaria())
WITH CHECK (public.is_admin_or_secretaria());

-- Allow admin/secretaria to select all profiles
CREATE POLICY "Admin secretaria can select all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin_or_secretaria());

-- Allow users to select own profile (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can select own profile'
  ) THEN
    CREATE POLICY "Users can select own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());
  END IF;
END
$$;

-- Create a view for admin to list users with profiles
CREATE OR REPLACE VIEW public.admin_users_view AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.avatar_url,
  p.active,
  p.created_at,
  p.updated_at,
  ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.id) as roles
FROM public.profiles p;

-- RLS-safe function to list users (admin only)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  active boolean,
  created_at timestamptz,
  roles text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.full_name,
    p.active,
    p.created_at,
    ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.id)
  FROM public.profiles p
  WHERE public.is_admin_or_secretaria()
  ORDER BY p.created_at DESC
$$;
