CREATE TABLE public.meal_window_patterns (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    event_stage_id UUID REFERENCES public.event_stages(id) ON DELETE CASCADE,
    meal_type_id UUID NOT NULL REFERENCES public.meal_types(id) ON DELETE CASCADE,
    label TEXT,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    meal_window_location_id UUID REFERENCES public.meal_locations(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.meal_window_patterns ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin full access patterns" 
ON public.meal_window_patterns FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria manage patterns" 
ON public.meal_window_patterns FOR ALL 
USING (has_role(auth.uid(), 'secretaria'::app_role))
WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Alimentacao read patterns" 
ON public.meal_window_patterns FOR SELECT 
USING (has_role(auth.uid(), 'alimentacao'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_meal_window_patterns_updated_at
BEFORE UPDATE ON public.meal_window_patterns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();