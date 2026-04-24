-- Bootstrap: foundational objects that pre-existed in production but were never
-- captured in migration files. Required before any other migration runs.

-- app_role enum (subsequent migrations use ADD VALUE IF NOT EXISTS safely)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'admin',
    'secretaria',
    'transporte',
    'alimentacao',
    'coordenacao_tecnica',
    'delegacao',
    'alojamento',
    'arbitragem',
    'cde',
    'coordenador_modalidade',
    'mesario',
    'super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- events table
CREATE TABLE IF NOT EXISTS public.events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  slug         text        NOT NULL UNIQUE,
  year         integer     NOT NULL,
  status       text        NOT NULL DEFAULT 'draft',
  start_date   date,
  end_date     date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- profiles table (no FK to auth.users: preview branch has no auth users seeded)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid        PRIMARY KEY,
  full_name  text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_role_key ON public.user_roles (user_id, role);

-- has_role: checks if user has a given role (super_admin bypasses all)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = _role OR role = 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_protected_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;
