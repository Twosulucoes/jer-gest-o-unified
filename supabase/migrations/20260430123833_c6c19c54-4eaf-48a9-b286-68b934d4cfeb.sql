CREATE TABLE public.osc_generated_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  prompt_type TEXT NOT NULL,
  template_id UUID REFERENCES public.osc_accountability_templates(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.osc_generated_reports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view reports for events they can access" 
ON public.osc_generated_reports 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_id
  )
);

CREATE POLICY "Users can insert their own generated reports" 
ON public.osc_generated_reports 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports" 
ON public.osc_generated_reports 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports" 
ON public.osc_generated_reports 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_osc_generated_reports_updated_at
BEFORE UPDATE ON public.osc_generated_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
