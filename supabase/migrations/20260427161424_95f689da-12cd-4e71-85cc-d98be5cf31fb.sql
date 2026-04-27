
-- Create bulletin_documents table
CREATE TABLE public.bulletin_documents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES public.event_stages(id) ON DELETE CASCADE,
    bulletin_type TEXT NOT NULL CHECK (bulletin_type IN ('daily', 'final')),
    reference_date DATE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    generated_by UUID REFERENCES auth.users(id),
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    generation_trigger TEXT NOT NULL CHECK (generation_trigger IN ('automatic_after_publish', 'manual')),
    version INTEGER NOT NULL DEFAULT 1,
    is_current BOOLEAN NOT NULL DEFAULT true,
    summary JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bulletin_documents ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_bulletin_documents_event_id ON public.bulletin_documents(event_id);
CREATE INDEX idx_bulletin_documents_stage_id ON public.bulletin_documents(stage_id);
CREATE INDEX idx_bulletin_documents_type_current ON public.bulletin_documents(bulletin_type, is_current);

-- Create function to update updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_bulletin_documents_updated_at
BEFORE UPDATE ON public.bulletin_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create policies for bulletin_documents
CREATE POLICY "Leitura permitida para perfis autorizados" 
ON public.bulletin_documents 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'secretaria', 'coordenacao_tecnica', 'delegacao')
    )
);

CREATE POLICY "Escrita permitida apenas para admin e secretaria" 
ON public.bulletin_documents 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'secretaria')
    )
);

-- Storage configuration
INSERT INTO storage.buckets (id, name, public) VALUES ('bulletins', 'bulletins', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Leitura de boletins para perfis autorizados"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'bulletins' AND
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'secretaria', 'coordenacao_tecnica', 'delegacao')
    )
);

CREATE POLICY "Escrita de boletins para admin e secretaria"
ON storage.objects FOR ALL
USING (
    bucket_id = 'bulletins' AND
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'secretaria')
    )
);

-- Table for generation logs (PASSO 9)
CREATE TABLE public.bulletin_generation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES public.event_stages(id) ON DELETE CASCADE,
    bulletin_type TEXT NOT NULL,
    attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
    error_message TEXT,
    triggered_by UUID REFERENCES auth.users(id),
    metadata JSONB
);

ALTER TABLE public.bulletin_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Logs visíveis para admin" 
ON public.bulletin_generation_logs 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
);
