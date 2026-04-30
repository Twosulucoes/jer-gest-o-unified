-- Garantir que secretaria e coordenacao_tecnica possam ver perfis
DROP POLICY IF EXISTS "secretaria_select_profiles" ON public.profiles;
CREATE POLICY "secretaria_select_profiles" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (has_role(auth.uid(), 'secretaria'::app_role) OR has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

DROP POLICY IF EXISTS "secretaria_update_profiles" ON public.profiles;
CREATE POLICY "secretaria_update_profiles" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (has_role(auth.uid(), 'secretaria'::app_role) OR has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role) OR has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- Garantir que secretaria e coordenacao_tecnica possam ver e gerenciar user_roles
DROP POLICY IF EXISTS "secretaria_select_user_roles" ON public.user_roles;
CREATE POLICY "secretaria_select_user_roles" 
ON public.user_roles FOR SELECT 
TO authenticated 
USING (has_role(auth.uid(), 'secretaria'::app_role) OR has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

DROP POLICY IF EXISTS "secretaria_manage_user_roles" ON public.user_roles;
CREATE POLICY "secretaria_manage_user_roles" 
ON public.user_roles FOR ALL 
TO authenticated 
USING (has_role(auth.uid(), 'secretaria'::app_role) OR has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role) OR has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- Garantir que secretaria possa gerenciar match_user_assignments
DROP POLICY IF EXISTS "secretaria_manage_assignments" ON public.match_user_assignments;
CREATE POLICY "secretaria_manage_assignments" 
ON public.match_user_assignments FOR ALL 
TO authenticated 
USING (has_role(auth.uid(), 'secretaria'::app_role))
WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

-- Garantir que super_admin tenha bypass total (backup policy)
DROP POLICY IF EXISTS "super_admin_all_profiles" ON public.profiles;
CREATE POLICY "super_admin_all_profiles" ON public.profiles FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "super_admin_all_roles" ON public.user_roles;
CREATE POLICY "super_admin_all_roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));
