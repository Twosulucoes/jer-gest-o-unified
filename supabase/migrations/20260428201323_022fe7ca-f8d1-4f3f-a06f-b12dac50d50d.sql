-- Tabela para configuração híbrida do convênio por evento
CREATE TABLE IF NOT EXISTS public.event_osc_configs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,
    grantor_name TEXT, -- Órgão Concedente
    contract_number TEXT, -- Número do Convênio
    contract_year TEXT, -- Ano do Convênio
    osc_name TEXT, -- Nome da OSC
    osc_cnpj TEXT, -- CNPJ da OSC
    osc_address TEXT, -- Endereço da OSC
    validity_start DATE, -- Início da vigência
    validity_end DATE, -- Fim da vigência
    responsible_name TEXT, -- Responsável pela OSC
    summary_model TEXT, -- Modelo de resumo executivo
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.event_osc_configs ENABLE ROW LEVEL SECURITY;

-- Políticas para event_osc_configs (usando user_roles)
CREATE POLICY "Configurações OSC são visíveis por admin, secretaria e coordenação"
ON public.event_osc_configs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text IN ('admin', 'secretaria', 'coordenacao_tecnica', 'super_admin')
    )
);

CREATE POLICY "Apenas admin, secretaria e super_admin editam configurações OSC"
ON public.event_osc_configs
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text IN ('admin', 'secretaria', 'super_admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text IN ('admin', 'secretaria', 'super_admin')
    )
);

-- Extensão de operational_evidence para metadados OSC
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operational_evidence' AND column_name = 'match_id') THEN
        ALTER TABLE public.operational_evidence ADD COLUMN match_id UUID REFERENCES public.competition_matches(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operational_evidence' AND column_name = 'osc_category') THEN
        ALTER TABLE public.operational_evidence ADD COLUMN osc_category TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operational_evidence' AND column_name = 'photo_at') THEN
        ALTER TABLE public.operational_evidence ADD COLUMN photo_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operational_evidence' AND column_name = 'location_name') THEN
        ALTER TABLE public.operational_evidence ADD COLUMN location_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operational_evidence' AND column_name = 'caption') THEN
        ALTER TABLE public.operational_evidence ADD COLUMN caption TEXT;
    END IF;
END $$;

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_operational_evidence_match_id ON public.operational_evidence(match_id);

-- Trigger para updated_at em event_osc_configs
CREATE TRIGGER update_event_osc_configs_updated_at
BEFORE UPDATE ON public.event_osc_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
