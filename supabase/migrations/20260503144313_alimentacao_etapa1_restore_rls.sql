-- Etapa 1 da Auditoria do Módulo de Alimentação
-- Restaura a RLS estrita de meal_windows e meal_locations.
--
-- Contexto:
--   * 20260503022158 introduziu políticas baseadas em (auth.jwt() ->> 'role')
--     que NÃO funciona neste sistema — os perfis vivem em public.user_roles
--     e a checagem canônica é via has_role(auth.uid(), <role>). Por isso, a
--     política travava até o admin.
--   * 20260503022945 aplicou um hotfix permissivo USING (true) para
--     desbloquear a operação, abrindo CRUD de meal_windows/meal_locations
--     para qualquer usuário autenticado (incluindo perfis sem privilégio
--     como delegacao e transporte). Quebra a matriz documentada em
--     docs/02-modelo-de-acesso-e-perfis.md.
--
-- Esta migration:
--   1. Remove as políticas quebradas/permissivas das duas tabelas.
--   2. Recria políticas usando has_role(auth.uid(), <role>), padrão já
--      empregado nas demais tabelas do módulo (ver 20260408213705).
--   3. Mantém a política "Stage restricted access meal_windows" definida em
--      20260501204911, que continua válida e independente.

-- =====================================================================
-- meal_windows
-- =====================================================================

ALTER TABLE public.meal_windows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users on meal_windows" ON public.meal_windows;
DROP POLICY IF EXISTS "Admins and Secretaria full access meal_windows" ON public.meal_windows;
-- Políticas legadas que serão substituídas pelas novas com nomenclatura padronizada.
DROP POLICY IF EXISTS "Admin full access meal_windows" ON public.meal_windows;
DROP POLICY IF EXISTS "Secretaria can manage meal_windows" ON public.meal_windows;
DROP POLICY IF EXISTS "Alimentacao can read meal_windows" ON public.meal_windows;
DROP POLICY IF EXISTS "Coordenacao tecnica can read meal_windows" ON public.meal_windows;

CREATE POLICY "meal_windows admin full access"
  ON public.meal_windows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "meal_windows secretaria full access"
  ON public.meal_windows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));

CREATE POLICY "meal_windows alimentacao read"
  ON public.meal_windows FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alimentacao'::public.app_role));

CREATE POLICY "meal_windows coordenacao_tecnica read"
  ON public.meal_windows FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));

-- =====================================================================
-- meal_locations
-- =====================================================================

ALTER TABLE public.meal_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users on meal_locations" ON public.meal_locations;
DROP POLICY IF EXISTS "Enable read for all authenticated users" ON public.meal_locations;
DROP POLICY IF EXISTS "Enable insert for admins and secretaria" ON public.meal_locations;
DROP POLICY IF EXISTS "Enable update for admins and secretaria" ON public.meal_locations;
DROP POLICY IF EXISTS "Enable delete for admins and secretaria" ON public.meal_locations;
DROP POLICY IF EXISTS "Admins can manage meal_locations" ON public.meal_locations;
DROP POLICY IF EXISTS "Authenticated users can read meal_locations" ON public.meal_locations;

CREATE POLICY "meal_locations admin full access"
  ON public.meal_locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "meal_locations secretaria full access"
  ON public.meal_locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));

-- Leitura para perfis operacionais que precisam exibir o nome do refeitório
-- (PWA de Alimentação faz JOIN meal_locations!meal_window_location_id).
CREATE POLICY "meal_locations alimentacao read"
  ON public.meal_locations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alimentacao'::public.app_role));

CREATE POLICY "meal_locations coordenacao_tecnica read"
  ON public.meal_locations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));
