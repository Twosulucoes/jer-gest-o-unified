-- Create PWA Telemetry table
CREATE TABLE IF NOT EXISTS public.pwa_telemetry (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    stage_id UUID REFERENCES public.event_stages(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    path TEXT,
    target_path TEXT,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.pwa_telemetry ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own telemetry" 
ON public.pwa_telemetry 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all telemetry" 
ON public.pwa_telemetry 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- Index for performance
CREATE INDEX idx_pwa_telemetry_user_id ON public.pwa_telemetry(user_id);
CREATE INDEX idx_pwa_telemetry_created_at ON public.pwa_telemetry(created_at);
CREATE INDEX idx_pwa_telemetry_action ON public.pwa_telemetry(action);
