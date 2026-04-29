-- 1. Adicionar campo JSONB para placar de sets em competition_match_results
ALTER TABLE public.competition_match_results 
ADD COLUMN IF NOT EXISTS sets_score_json JSONB;

COMMENT ON COLUMN public.competition_match_results.sets_score_json IS 'Estrutura: {sets_a: number[], sets_b: number[], total_sets: [number, number]}';

-- 2. Criar tabela para gestão de inferências de família (Processo de Auditoria)
CREATE TABLE IF NOT EXISTS public.sport_family_inferences (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    sport_event_rule_id UUID NOT NULL REFERENCES public.sport_event_rules(id) ON DELETE CASCADE,
    inferred_family TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, applied, skipped
    applied_at TIMESTAMP WITH TIME ZONE,
    applied_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.sport_family_inferences ENABLE ROW LEVEL SECURITY;

-- Políticas simplificadas (Usuário autenticado) - O controle fino de Super Admin é feito no Frontend
CREATE POLICY "Authenticated users can manage inferences" 
ON public.sport_family_inferences 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- 3. Trigger para updated_at em sport_family_inferences
CREATE TRIGGER update_sport_family_inferences_updated_at
BEFORE UPDATE ON public.sport_family_inferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
