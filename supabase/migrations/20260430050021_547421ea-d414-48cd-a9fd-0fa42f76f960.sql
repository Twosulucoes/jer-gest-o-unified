-- Corrigindo políticas da tabela people
DROP POLICY IF EXISTS "Admin full access people" ON public.people;
CREATE POLICY "Admin full access people" 
ON public.people 
FOR ALL 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Corrigindo políticas da tabela profiles
DROP POLICY IF EXISTS "profiles_select_authenticated_except_super" ON public.profiles;
CREATE POLICY "profiles_select_admin" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Corrigindo políticas da tabela user_roles para garantir que admins possam ler todos os roles
DROP POLICY IF EXISTS "user_roles_select_authenticated_except_super" ON public.user_roles;
CREATE POLICY "user_roles_select_admin" 
ON public.user_roles 
FOR SELECT 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role));
