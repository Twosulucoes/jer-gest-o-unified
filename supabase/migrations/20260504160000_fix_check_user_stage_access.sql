-- ============================================================
-- Fix: check_user_stage_access usa has_role() (não app_roles)
-- ============================================================
-- A função check_user_stage_access (criada em 20260501204911 e
-- redefinida algumas vezes) faz JOIN com a tabela `app_roles`,
-- que NÃO EXISTE neste banco. O modelo canônico é:
--
--   public.user_roles (user_id, role app_role)   -- enum direto
--   public.has_role(user_id, role) → bool
--
-- A versão antiga errava silenciosamente em algumas chamadas e
-- ativamente em outras (ex.: insert/update em lodging_locations
-- caía em policy que invocava esta função, retornando erro de
-- relação inexistente "app_roles").
--
-- Esta migração reescreve a função usando has_role() e mantém a
-- semântica original:
--   - admin/super_admin/secretaria: acesso total a qualquer etapa
--   - outros perfis: precisam de entrada em user_stage_assignments
--
-- Tabelas/RLS afetadas (não recriadas — apenas a função muda):
--   lodging_locations, lodging_units, lodging_occupancies,
--   meal_windows, meal_consumptions, participant_event_stages,
--   meal_incidents, lodging_incidents
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_user_stage_access(target_stage_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF target_stage_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Perfis com acesso amplo bypassam o filtro de etapa.
    IF public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
       OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
       OR public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role)
    THEN
        RETURN TRUE;
    END IF;

    -- Demais perfis: precisam de atribuição explícita à etapa.
    RETURN EXISTS (
        SELECT 1
        FROM public.user_stage_assignments
        WHERE user_id = auth.uid()
          AND event_stage_id = target_stage_id
    );
END;
$$;

COMMENT ON FUNCTION public.check_user_stage_access(UUID) IS
  'Retorna TRUE se o usuário tem acesso à etapa: admin/super_admin/secretaria/coordenacao_tecnica bypassam; demais perfis precisam de entrada em user_stage_assignments. Reescrita para usar o padrão canônico has_role() (a versão antiga referenciava a tabela app_roles, que não existe neste banco).';
