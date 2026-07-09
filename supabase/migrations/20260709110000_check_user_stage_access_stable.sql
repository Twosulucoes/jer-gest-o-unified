-- Performance: check_user_stage_access marcada como STABLE
-- =====================================================================
-- A função (redefinida em 20260504160000) é usada em policies RLS de
-- meal_windows, meal_consumptions, lodging_locations, lodging_units,
-- lodging_occupancies, participant_event_stages, meal_incidents e
-- lodging_incidents. Por não ter volatilidade declarada, o Postgres a
-- trata como VOLATILE (padrão do PL/pgSQL), impedindo o cache do
-- resultado por argumento dentro da mesma consulta e a otimização do
-- plano — em tabelas com muitas linhas (ex.: meal_consumptions em
-- etapas grandes), a função é reavaliada linha a linha sem cache.
--
-- A função só faz leituras (has_role/EXISTS em user_stage_assignments),
-- não escreve nada, então é seguro marcá-la STABLE (mesmo resultado
-- para os mesmos argumentos dentro de uma única instrução). A lógica
-- de acesso não muda — apenas a anotação de volatilidade.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.check_user_stage_access(target_stage_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
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
  'Retorna TRUE se o usuário tem acesso à etapa: admin/super_admin/secretaria/coordenacao_tecnica bypassam; demais perfis precisam de entrada em user_stage_assignments. STABLE (só leitura) para permitir cache do resultado por argumento dentro da mesma consulta.';
