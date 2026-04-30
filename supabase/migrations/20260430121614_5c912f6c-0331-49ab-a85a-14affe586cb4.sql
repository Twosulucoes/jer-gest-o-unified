-- Create table for OSC specific records
CREATE TABLE public.osc_registros (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'doacao_alimento', 'refeicao_extra', 'ocorrencia_gestao'
    description TEXT,
    value_numeric NUMERIC, -- e.g. kg of food, quantity of meals
    unit TEXT, -- 'kg', 'unidades', etc.
    status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'aprovado', 'rejeitado'
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    recorded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.osc_registros ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "OSC registros are viewable by admins and staff" 
ON public.osc_registros FOR SELECT 
USING (
  auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'secretaria', 'super_admin', 'coordenacao_tecnica'))
);

CREATE POLICY "Admins can insert OSC registros" 
ON public.osc_registros FOR INSERT 
WITH CHECK (
  auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'secretaria', 'super_admin', 'coordenacao_tecnica'))
);

CREATE POLICY "Admins can update OSC registros" 
ON public.osc_registros FOR UPDATE 
USING (
  auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'secretaria', 'super_admin', 'coordenacao_tecnica'))
);

CREATE POLICY "Admins can delete OSC registros" 
ON public.osc_registros FOR DELETE 
USING (
  auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'secretaria', 'super_admin', 'coordenacao_tecnica'))
);

-- Trigger for updated_at
CREATE TRIGGER update_osc_registros_updated_at
BEFORE UPDATE ON public.osc_registros
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();