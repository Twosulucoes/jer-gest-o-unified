
-- Create enum for incident module (if not exists)
DO $$ BEGIN
  CREATE TYPE public.incident_module AS ENUM ('transporte', 'alimentacao', 'alojamento', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create enum for incident status (if not exists)
DO $$ BEGIN
  CREATE TYPE public.incident_status AS ENUM ('pending', 'in_progress', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create table
CREATE TABLE IF NOT EXISTS public.operational_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  module incident_module NOT NULL DEFAULT 'outro',
  reference_id UUID,
  reference_label TEXT,
  reported_by_user_id UUID NOT NULL,
  reporter_name TEXT,
  reporter_phone TEXT,
  incident_description TEXT NOT NULL,
  incident_status incident_status NOT NULL DEFAULT 'pending',
  admin_response TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_operational_incidents_event ON public.operational_incidents(event_id);
CREATE INDEX IF NOT EXISTS idx_operational_incidents_module ON public.operational_incidents(module);
CREATE INDEX IF NOT EXISTS idx_operational_incidents_status ON public.operational_incidents(incident_status);
CREATE INDEX IF NOT EXISTS idx_operational_incidents_reporter ON public.operational_incidents(reported_by_user_id);

-- Enable RLS
ALTER TABLE public.operational_incidents ENABLE ROW LEVEL SECURITY;

-- Admin/secretaria/coordenacao_tecnica can view all incidents
CREATE POLICY "Admins can view all incidents"
ON public.operational_incidents
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'secretaria')
  OR public.has_role(auth.uid(), 'coordenacao_tecnica')
);

-- Operators can view their own incidents
CREATE POLICY "Operators can view own incidents"
ON public.operational_incidents
FOR SELECT
TO authenticated
USING (reported_by_user_id = auth.uid());

-- Authenticated users can insert incidents
CREATE POLICY "Users can create incidents"
ON public.operational_incidents
FOR INSERT
TO authenticated
WITH CHECK (reported_by_user_id = auth.uid());

-- Admin/secretaria can update incidents
CREATE POLICY "Admins can update incidents"
ON public.operational_incidents
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'secretaria')
);

-- Trigger for updated_at
CREATE TRIGGER update_operational_incidents_updated_at
BEFORE UPDATE ON public.operational_incidents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
