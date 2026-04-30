-- Add event_type and event_id to osc_accountability_templates
ALTER TABLE public.osc_accountability_templates 
ADD COLUMN IF NOT EXISTS event_type TEXT,
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;

-- Update existing templates to have a default event_type if null
UPDATE public.osc_accountability_templates 
SET event_type = 'generic' 
WHERE event_type IS NULL;

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_osc_templates_event_type ON public.osc_accountability_templates(event_type);
CREATE INDEX IF NOT EXISTS idx_osc_templates_event_id ON public.osc_accountability_templates(event_id);

-- Add some example specialized templates if they don't exist
INSERT INTO public.osc_accountability_templates (name, description, event_type, prompt_structure, category, is_default)
VALUES 
('Relatório Esportivo', 'Template focado em métricas de competições, medalhas e participação de atletas.', 'esportivo', 'Foque nos resultados das competições, número de atletas, categorias disputadas e infraestrutura esportiva utilizada.', 'técnico', false),
('Relatório Social/Cultural', 'Template focado em impacto na comunidade, público atingido e apresentações.', 'cultural', 'Destaque o impacto social, público presente, acessibilidade e diversidade das apresentações.', 'impacto', false)
ON CONFLICT DO NOTHING;