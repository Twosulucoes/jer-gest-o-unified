-- Sumarização por Perfil
CREATE OR REPLACE FUNCTION public.get_participant_counts_by_profile(p_event_id UUID, p_stage_id UUID DEFAULT NULL)
RETURNS TABLE (type TEXT, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.category_slug as type, -- Usando category_slug como proxy para tipo de participante se profile_type não existir
        COUNT(*)::BIGINT as count
    FROM public.participants p
    JOIN public.participant_event_stages pes ON p.id = pes.participant_id
    WHERE p.event_id = p_event_id
      AND p.is_active = true
      AND (p_stage_id IS NULL OR pes.event_stage_id = p_stage_id)
    GROUP BY p.category_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sumarização por Delegação
CREATE OR REPLACE FUNCTION public.get_participant_counts_by_delegation(p_event_id UUID, p_stage_id UUID DEFAULT NULL)
RETURNS TABLE (id UUID, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.delegation_id as id,
        COUNT(*)::BIGINT as count
    FROM public.participants p
    JOIN public.participant_event_stages pes ON p.id = pes.participant_id
    WHERE p.event_id = p_event_id
      AND p.is_active = true
      AND (p_stage_id IS NULL OR pes.event_stage_id = p_stage_id)
      AND p.delegation_id IS NOT NULL
    GROUP BY p.delegation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sumarização por Instituição
CREATE OR REPLACE FUNCTION public.get_participant_counts_by_institution(p_event_id UUID, p_stage_id UUID DEFAULT NULL)
RETURNS TABLE (id UUID, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.institution_id as id,
        COUNT(*)::BIGINT as count
    FROM public.participants p
    JOIN public.participant_event_stages pes ON p.id = pes.participant_id
    WHERE p.event_id = p_event_id
      AND p.is_active = true
      AND (p_stage_id IS NULL OR pes.event_stage_id = p_stage_id)
      AND p.institution_id IS NOT NULL
    GROUP BY p.institution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
