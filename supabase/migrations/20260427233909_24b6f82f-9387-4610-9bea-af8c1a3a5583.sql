-- Garantir coluna event_stage_id em competition_matches
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='competition_matches' AND column_name='event_stage_id') THEN
        ALTER TABLE public.competition_matches ADD COLUMN event_stage_id UUID REFERENCES public.event_stages(id);
    END IF;
END $$;

-- Tabela de configuração de remuneração
CREATE TABLE IF NOT EXISTS public.referee_remuneration_configs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_stage_id UUID NOT NULL REFERENCES public.event_stages(id) ON DELETE CASCADE,
    sport_id UUID NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
    remuneration_type TEXT NOT NULL CHECK (remuneration_type IN ('daily', 'per_match')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(event_stage_id, sport_id)
);

-- Habilitar RLS
ALTER TABLE public.referee_remuneration_configs ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Admin full access to remuneration configs"
ON public.referee_remuneration_configs
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
);

CREATE POLICY "Others read-only access to remuneration configs"
ON public.referee_remuneration_configs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('secretaria', 'coordenacao_tecnica', 'coordenador_modalidade')
    )
);

-- Trigger para updated_at (assumindo que update_updated_at_column existe)
DROP TRIGGER IF EXISTS update_referee_remuneration_configs_updated_at ON public.referee_remuneration_configs;
CREATE TRIGGER update_referee_remuneration_configs_updated_at
BEFORE UPDATE ON public.referee_remuneration_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- View para consolidar designações cumpridas (fulfilled)
CREATE OR REPLACE VIEW public.vw_fulfilled_referee_assignments AS
SELECT 
    mua.*,
    cm.match_date,
    cm.event_stage_id,
    se.sport_id,
    COALESCE(rrc.remuneration_type, 'per_match') as remuneration_type,
    (
        EXISTS (SELECT 1 FROM public.competition_match_results cmr WHERE cmr.match_id = mua.match_id) OR
        EXISTS (SELECT 1 FROM public.match_events me WHERE me.match_id = mua.match_id) OR
        EXISTS (SELECT 1 FROM public.match_scores ms WHERE ms.match_id = mua.match_id)
    ) as is_fulfilled
FROM public.match_user_assignments mua
JOIN public.competition_matches cm ON mua.match_id = cm.id
JOIN public.sport_events se ON cm.sport_event_id = se.id
LEFT JOIN public.referee_remuneration_configs rrc ON cm.event_stage_id = rrc.event_stage_id AND se.sport_id = rrc.sport_id;
