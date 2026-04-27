
-- Create operational_evidence table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.operational_evidence (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    module TEXT NOT NULL,
    evidence_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    reference_table TEXT,
    reference_id UUID,
    uploaded_by UUID REFERENCES auth.users(id),
    reviewed_by UUID REFERENCES auth.users(id),
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.operational_evidence ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_operational_evidence_event_id ON public.operational_evidence(event_id);
CREATE INDEX idx_operational_evidence_module ON public.operational_evidence(module);

-- Create policies
CREATE POLICY "Leitura permitida para perfis autorizados (evidencias)" 
ON public.operational_evidence 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'secretaria', 'coordenacao_tecnica', 'alimentacao', 'alojamento', 'transporte')
    )
);

CREATE POLICY "Escrita permitida para admin e secretaria (evidencias)" 
ON public.operational_evidence 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'secretaria')
    )
);

-- Trigger for updated_at
CREATE TRIGGER update_operational_evidence_updated_at
BEFORE UPDATE ON public.operational_evidence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
