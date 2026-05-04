-- ============================================================
-- Auditoria de Competição Fase 4 — RLS canônica (WITH CHECK)
-- ============================================================
-- Auditoria: docs/auditoria-competicao.md (Fase 4)
--
-- O agent original da auditoria reportou "RLS sem WITH CHECK em
-- FOR ALL" como problema das tabelas competition_* / match_*.
-- A inspeção real mostrou que TODAS as policies de competição
-- já têm WITH CHECK. Mas a varredura ampla encontrou 6 policies
-- de OUTRAS tabelas com o gap real:
--
--   1. participants (super_admin)
--   2. lodging_incidents (admin/secretaria)
--   3. event_osc_configs (super_admin)
--   4. operational_evidence (super_admin)
--   5. profiles (super_admin)
--   6. user_roles (super_admin)
--
-- (referee_remuneration_configs e lodging_supervisions também
-- estavam na lista mas já foram corrigidas em #48 e #50.)
--
-- Risco prático sem WITH CHECK em FOR ALL: usuário com a role
-- correta consegue INSERT/UPDATE com valores que NÃO satisfariam
-- a USING expression — viola o invariante "não posso escrever o
-- que não posso ler" e pode esconder dados na propria role.
--
-- Estratégia: para cada policy listada, DROP IF EXISTS + CREATE
-- canônica com WITH CHECK simétrico ao USING. Idempotente.
-- ============================================================

-- 1. participants — super_admin
DROP POLICY IF EXISTS "Super admin can do everything on participants" ON public.participants;
CREATE POLICY "Super admin can do everything on participants"
  ON public.participants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 2. lodging_incidents — admin/secretaria
DROP POLICY IF EXISTS "Admin/Secretaria full access lodging_incidents" ON public.lodging_incidents;
CREATE POLICY "Admin/Secretaria full access lodging_incidents"
  ON public.lodging_incidents FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
  );

-- 3. event_osc_configs — super_admin
DROP POLICY IF EXISTS "Super admin tem acesso total osc_configs" ON public.event_osc_configs;
CREATE POLICY "Super admin tem acesso total osc_configs"
  ON public.event_osc_configs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 4. operational_evidence — super_admin
DROP POLICY IF EXISTS "Super admin tem acesso total evidencias" ON public.operational_evidence;
CREATE POLICY "Super admin tem acesso total evidencias"
  ON public.operational_evidence FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 5. profiles — super_admin
DROP POLICY IF EXISTS "super_admin_all_profiles" ON public.profiles;
CREATE POLICY "super_admin_all_profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 6. user_roles — super_admin
DROP POLICY IF EXISTS "super_admin_all_roles" ON public.user_roles;
CREATE POLICY "super_admin_all_roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
