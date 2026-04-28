-- Add tracking columns for referee workflow in Phase 4
ALTER TABLE public.match_user_assignments 
ADD COLUMN IF NOT EXISTS acceptance_status TEXT DEFAULT 'pending' CHECK (acceptance_status IN ('pending', 'confirmed', 'unavailable')),
ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reported_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS indisponibility_reason TEXT;

-- Index for performance in coordination panel queries
CREATE INDEX IF NOT EXISTS idx_mua_acceptance_status ON public.match_user_assignments(acceptance_status) WHERE acceptance_status = 'unavailable';

-- Helper function for coordination alerts
CREATE OR REPLACE FUNCTION public.get_unhandled_referee_indisponibilities(p_etapa_id UUID)
RETURNS TABLE (
    assignment_id UUID,
    match_id UUID,
    referee_name TEXT,
    reason TEXT,
    reported_at TIMESTAMP WITH TIME ZONE,
    match_time TIMESTAMP WITH TIME ZONE,
    is_critical BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mua.id,
        mua.match_id,
        p.nome_completo,
        mua.indisponibility_reason,
        mua.reported_at,
        m.horario,
        (mua.reported_at > (m.horario - INTERVAL '30 minutes')) as is_critical
    FROM public.match_user_assignments mua
    JOIN public.matches m ON mua.match_id = m.id
    JOIN public.perfis p ON mua.user_id = p.id
    WHERE m.etapa_id = p_etapa_id
      AND mua.acceptance_status = 'unavailable'
    ORDER BY is_critical DESC, mua.reported_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS to allow referees to update their own assignments
-- (Assuming referees have a role or we identify them by their presence in the table)
CREATE POLICY "Referees can update their own assignment status"
ON public.match_user_assignments
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);