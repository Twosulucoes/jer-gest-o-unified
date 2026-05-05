-- Fase D da Normalização (docs/dominio-canonico.md §4, §8)
-- Limpeza pequena:
--   1. DROP COLUMN participants.active_status — redundante com is_active
--      + status, sem callers no código.
--   2. Corrige bug latente nas RPCs `get_participant_counts_by_institution`
--      e `get_present_participant_counts_by_institution`: ambas liam
--      `p.institution_id` de participants, mas essa coluna não existe.
--      institution_id pertence a `delegations` (não a participants).
--      A correção faz o JOIN explícito.

-- ============================================================
-- 1. DROP active_status
-- ============================================================
ALTER TABLE public.participants
  DROP COLUMN IF EXISTS active_status;

-- ============================================================
-- 2a. Fix get_participant_counts_by_institution
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_participant_counts_by_institution(
  p_event_id UUID,
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
    d.institution_id AS id,
    COUNT(*)::BIGINT AS count
  FROM public.participants p
  JOIN public.participant_event_stages pes ON p.id = pes.participant_id
  JOIN public.delegations d ON d.id = p.delegation_id
  WHERE p.event_id = p_event_id
    AND p.is_active = true
    AND (p_stage_id IS NULL OR pes.event_stage_id = p_stage_id)
    AND d.institution_id IS NOT NULL
  GROUP BY d.institution_id;
END;
$$;

-- ============================================================
-- 2b. Fix get_present_participant_counts_by_institution
-- ============================================================
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
    d.institution_id AS id,
    COUNT(*)::BIGINT AS count
  FROM public.participants p
  JOIN public.participant_event_stages pes ON p.id = pes.participant_id
  JOIN public.delegations d ON d.id = p.delegation_id
  WHERE p.event_id = p_event_id
    AND p.is_active = true
    AND p.needs_meals = true
    AND p.credentialed_at IS NOT NULL
    AND p.credentialed_at::date <= p_service_date
    AND (p.left_event_at IS NULL OR p.left_event_at::date > p_service_date)
    AND (p_stage_id IS NULL OR pes.event_stage_id = p_stage_id)
    AND d.institution_id IS NOT NULL
  GROUP BY d.institution_id;
END;
$$;
