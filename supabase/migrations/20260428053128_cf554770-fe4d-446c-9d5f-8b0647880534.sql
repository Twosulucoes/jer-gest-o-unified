CREATE TYPE public.meal_incident_type AS ENUM (
  'NOT_ELIGIBLE',
  'OUTSIDE_WINDOW',
  'DUPLICATE',
  'VOUCHER_INVALID',
  'VOUCHER_REVOKED',
  'VOUCHER_EXPIRED',
  'VOUCHER_ALREADY_USED',
  'OTHER'
);

CREATE TABLE public.meal_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
  meal_window_id UUID NOT NULL REFERENCES public.meal_windows(id) ON DELETE CASCADE,
  incident_type public.meal_incident_type NOT NULL,
  incident_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  registered_by UUID NOT NULL REFERENCES auth.users(id),
  device_info JSONB,
  is_offline BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meal_incidents ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin/Coord/Secretaria can view all incidents"
  ON public.meal_incidents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role::text IN ('admin', 'coordenacao', 'secretaria')
    )
  );

CREATE POLICY "Food operators can insert incidents"
  ON public.meal_incidents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role::text IN ('admin', 'coordenacao', 'secretaria', 'alimentacao')
    )
  );

-- Function to record incident
CREATE OR REPLACE FUNCTION public.record_meal_incident(
  p_meal_window_id UUID,
  p_incident_type public.meal_incident_type,
  p_participant_id UUID DEFAULT NULL,
  p_is_offline BOOLEAN DEFAULT FALSE,
  p_incident_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_device_info JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_incident_id UUID;
BEGIN
  INSERT INTO public.meal_incidents (
    meal_window_id,
    incident_type,
    participant_id,
    is_offline,
    incident_at,
    registered_by,
    device_info
  ) VALUES (
    p_meal_window_id,
    p_incident_type,
    p_participant_id,
    p_is_offline,
    COALESCE(p_incident_at, now()),
    auth.uid(),
    p_device_info
  ) RETURNING id INTO v_incident_id;
  
  RETURN v_incident_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;