-- 1. Função utilitária
CREATE OR REPLACE FUNCTION public.is_protected_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

-- 2. PROFILES — esconder super_admins
-- Remove policies antigas de SELECT que possam estar muito abertas
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- Próprio perfil sempre visível
CREATE POLICY "profiles_select_self"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Super admin vê todos
CREATE POLICY "profiles_select_super_admin"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Demais autenticados veem todos os perfis EXCETO super_admins
CREATE POLICY "profiles_select_authenticated_except_super"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (NOT public.is_protected_user(id));

-- Bloquear UPDATE de super_admin por quem não é super_admin
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND cmd='UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id AND NOT public.is_protected_user(id))
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_super_admin"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 3. USER_ROLES — esconder linhas de super_admins
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='user_roles' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
  END LOOP;
END $$;

-- Próprias roles
CREATE POLICY "user_roles_select_self"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Super admin vê tudo
CREATE POLICY "user_roles_select_super_admin"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Demais autenticados veem todas EXCETO de super_admins
CREATE POLICY "user_roles_select_authenticated_except_super"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (NOT public.is_protected_user(user_id));

-- 4. AUDIT_EVENTS — ocultar ações do super_admin
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='audit_events' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_events', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "audit_events_select_super_admin"
  ON public.audit_events FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "audit_events_select_others"
  ON public.audit_events FOR SELECT
  TO authenticated
  USING (
    NOT public.has_role(auth.uid(), 'super_admin')
    AND (created_by IS NULL OR NOT public.is_protected_user(created_by))
  );