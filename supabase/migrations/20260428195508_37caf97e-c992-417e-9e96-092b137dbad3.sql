-- Add source column to competition_matches
ALTER TABLE public.competition_matches 
ADD COLUMN source TEXT NOT NULL DEFAULT 'complex';

-- Update existing matches to be 'complex'
UPDATE public.competition_matches SET source = 'complex';

-- Make phase_id nullable in competition_matches
ALTER TABLE public.competition_matches ALTER COLUMN phase_id DROP NOT NULL;

-- Add constraint to ensure 'complex' matches still require phase_id
ALTER TABLE public.competition_matches 
ADD CONSTRAINT complex_matches_require_phase 
CHECK (
  (source = 'simple') OR 
  (source = 'complex' AND phase_id IS NOT NULL)
);

-- Add registros_mode_enabled to events
ALTER TABLE public.events 
ADD COLUMN registros_mode_enabled BOOLEAN NOT NULL DEFAULT false;

-- Create an audit table for Registros Mode toggles if it doesn't exist
CREATE TABLE IF NOT EXISTS public.registros_mode_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  old_value BOOLEAN,
  new_value BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE public.registros_mode_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can see logs
CREATE POLICY "Super admins can view registros mode logs" 
ON public.registros_mode_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role::text = 'super_admin'
  )
);

-- Create trigger function for logging event flag changes
CREATE OR REPLACE FUNCTION public.log_registros_mode_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.registros_mode_enabled IS DISTINCT FROM NEW.registros_mode_enabled) THEN
    INSERT INTO public.registros_mode_logs (event_id, user_id, old_value, new_value)
    VALUES (NEW.id, auth.uid(), OLD.registros_mode_enabled, NEW.registros_mode_enabled);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on events table
CREATE TRIGGER tr_log_registros_mode_change
AFTER UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.log_registros_mode_change();

-- Add RLS for Super Admin to update events (ensure they are the only ones)
CREATE POLICY "Super admins can manage all events" 
ON public.events 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role::text = 'super_admin'
  )
);
