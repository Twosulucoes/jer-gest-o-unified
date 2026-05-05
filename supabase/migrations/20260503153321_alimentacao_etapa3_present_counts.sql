-- Etapa 3 da Auditoria do Módulo de Alimentação
-- RPCs de "presentes na data" para alimentar a Previsão de Demanda.
--
-- Diferença para get_participant_counts_by_*:
--   * só conta quem realmente está apto a consumir refeição na data:
--     - is_active = true
--     - needs_meals = true
--     - credentialed_at IS NOT NULL e <= fim do dia de serviço (chegou)
--     - left_event_at IS NULL OR p_service_date < left_event_at::date
--       (não saiu antes da janela)
--
-- O retorno mantém o mesmo formato das funções legadas para que a UI
-- (AlimentacaoPrevisaoPage) consiga trocar a fonte de dados sem mexer
-- no loop de cálculo de elegibilidade.

CREATE OR REPLACE FUNCTION public.get_present_participant_counts_by_profile(
  p_event_id UUID,
  p_service_date DATE,
  p_stage_id UUID DEFAULT NULL
)
RETURNS TABLE (type TEXT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.category_slug AS type,
    COUNT(*)::BIGINT AS count
  FROM public.participants p
  JOIN public.participant_event_stages pes ON p.id = pes.participant_id
  WHERE p.event_id = p_event_id
    AND p.is_active = true
    AND p.needs_meals = true
    AND p.credentialed_at IS NOT NULL
    AND p.credentialed_at::date <= p_service_date
    AND (p.left_event_at IS NULL OR p.left_event_at::date > p_service_date)
    AND (p_stage_id IS NULL OR pes.event_stage_id = p_stage_id)
  GROUP BY p.category_slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_present_participant_counts_by_delegation(
  p_event_id UUID,
  p_service_date DATE,
  p_stage_id UUID DEFAULT NULL
)
RETURNS TABLE (id UUID, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.delegation_id AS id,
    COUNT(*)::BIGINT AS count
  FROM public.participants p
  JOIN public.participant_event_stages pes ON p.id = pes.participant_id
  WHERE p.event_id = p_event_id
    AND p.is_active = true
    AND p.needs_meals = true
    AND p.credentialed_at IS NOT NULL
    AND p.credentialed_at::date <= p_service_date
    AND (p.left_event_at IS NULL OR p.left_event_at::date > p_service_date)
    AND (p_stage_id IS NULL OR pes.event_stage_id = p_stage_id)
    AND p.delegation_id IS NOT NULL
  GROUP BY p.delegation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_present_participant_counts_by_institution(
  p_event_id UUID,
  p_service_date DATE,
  p_stage_id UUID DEFAULT NULL
)
RETURNS TABLE (id UUID, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.institution_id AS id,
    COUNT(*)::BIGINT AS count
  FROM public.participants p
  JOIN public.participant_event_stages pes ON p.id = pes.participant_id
  WHERE p.event_id = p_event_id
    AND p.is_active = true
    AND p.needs_meals = true
    AND p.credentialed_at IS NOT NULL
    AND p.credentialed_at::date <= p_service_date
    AND (p.left_event_at IS NULL OR p.left_event_at::date > p_service_date)
    AND (p_stage_id IS NULL OR pes.event_stage_id = p_stage_id)
    AND p.institution_id IS NOT NULL
  GROUP BY p.institution_id;
END;
$$;
