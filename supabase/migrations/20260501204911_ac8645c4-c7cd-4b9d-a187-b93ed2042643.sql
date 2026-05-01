-- Helper function to check if a user has access to a specific stage
CREATE OR REPLACE FUNCTION public.check_user_stage_access(target_stage_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    -- 1. Se for admin, acesso total
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN app_roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.role = 'admin'
    ) INTO is_admin;

    IF is_admin THEN
        RETURN TRUE;
    END IF;

    -- 2. Se não for admin, verifica se está associado à etapa
    RETURN EXISTS (
        SELECT 1 FROM public.user_stage_assignments
        WHERE user_id = auth.uid() AND event_stage_id = target_stage_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reinforce RLS on Alojamento Tables
ALTER TABLE public.lodging_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Stage restricted access lodging_locations" ON public.lodging_locations;
CREATE POLICY "Stage restricted access lodging_locations" 
ON public.lodging_locations 
FOR ALL 
USING (check_user_stage_access(event_stage_id));

ALTER TABLE public.lodging_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Stage restricted access lodging_units" ON public.lodging_units;
CREATE POLICY "Stage restricted access lodging_units" 
ON public.lodging_units 
FOR ALL 
USING (check_user_stage_access(event_stage_id));

ALTER TABLE public.lodging_occupancies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Stage restricted access lodging_occupancies" ON public.lodging_occupancies;
CREATE POLICY "Stage restricted access lodging_occupancies" 
ON public.lodging_occupancies 
FOR ALL 
USING (check_user_stage_access(event_stage_id));

-- Reinforce RLS on Alimentação Tables
ALTER TABLE public.meal_windows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Stage restricted access meal_windows" ON public.meal_windows;
CREATE POLICY "Stage restricted access meal_windows" 
ON public.meal_windows 
FOR ALL 
USING (check_user_stage_access(event_stage_id));

ALTER TABLE public.meal_consumptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Stage restricted access meal_consumptions" ON public.meal_consumptions;
CREATE POLICY "Stage restricted access meal_consumptions" 
ON public.meal_consumptions 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.meal_windows mw 
        WHERE mw.id = meal_consumptions.meal_window_id 
        AND check_user_stage_access(mw.event_stage_id)
    )
);

-- Reinforce RLS on Registros/Participantes
ALTER TABLE public.participant_event_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Stage restricted access participant_event_stages" ON public.participant_event_stages;
CREATE POLICY "Stage restricted access participant_event_stages" 
ON public.participant_event_stages 
FOR ALL 
USING (check_user_stage_access(event_stage_id));

-- Incidents
ALTER TABLE public.meal_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Stage restricted access meal_incidents" ON public.meal_incidents;
CREATE POLICY "Stage restricted access meal_incidents" 
ON public.meal_incidents 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.meal_windows mw 
        WHERE mw.id = meal_incidents.meal_window_id 
        AND check_user_stage_access(mw.event_stage_id)
    )
);

ALTER TABLE public.lodging_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Stage restricted access lodging_incidents" ON public.lodging_incidents;
CREATE POLICY "Stage restricted access lodging_incidents" 
ON public.lodging_incidents 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.lodging_locations ll 
        WHERE ll.id = lodging_incidents.location_id 
        AND check_user_stage_access(ll.event_stage_id)
    )
);
