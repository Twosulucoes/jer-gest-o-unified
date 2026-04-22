-- Update has_role to include super_admin hierarchy
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND (role = _role OR role = 'super_admin')
  )
$function$;

-- Ensure events are viewable by ALL authenticated users (it's safe metadata)
-- This prevents the "No events found" error on refresh for roles like coordinator or admin
DROP POLICY IF EXISTS "Alimentacao can read events" ON public.events;
DROP POLICY IF EXISTS "Coordenacao tecnica can read events" ON public.events;
DROP POLICY IF EXISTS "Delegacao can read events" ON public.events;
DROP POLICY IF EXISTS "Secretaria can read events" ON public.events;
DROP POLICY IF EXISTS "Transporte can read events" ON public.events;
DROP POLICY IF EXISTS "Admin full access events" ON public.events;

CREATE POLICY "Allow all authenticated users to read events" 
ON public.events FOR SELECT 
TO authenticated 
USING (true);

-- Also allow all authenticated users to read event stages (base data)
DROP POLICY IF EXISTS "Alimentacao can read event_stages" ON public.event_stages;
DROP POLICY IF EXISTS "Coordenacao tecnica can read event_stages" ON public.event_stages;
DROP POLICY IF EXISTS "Delegacao can read event_stages" ON public.event_stages;
DROP POLICY IF EXISTS "Secretaria can read event_stages" ON public.event_stages;
DROP POLICY IF EXISTS "Transporte can read event_stages" ON public.event_stages;
DROP POLICY IF EXISTS "Admin full access event_stages" ON public.event_stages;

CREATE POLICY "Allow all authenticated users to read event_stages" 
ON public.event_stages FOR SELECT 
TO authenticated 
USING (true);

-- Ensure base tables are readable by everyone authenticated to avoid empty UI
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sports are readable by everyone" ON public.sports;
CREATE POLICY "Sports are readable by everyone authenticated" ON public.sports FOR SELECT TO authenticated USING (true);

ALTER TABLE public.sport_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sport events are readable by everyone" ON public.sport_events;
CREATE POLICY "Sport events are readable by everyone authenticated" ON public.sport_events FOR SELECT TO authenticated USING (true);

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Institutions are readable by everyone" ON public.institutions;
CREATE POLICY "Institutions are readable by everyone authenticated" ON public.institutions FOR SELECT TO authenticated USING (true);

ALTER TABLE public.delegations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Delegations are readable by everyone" ON public.delegations;
CREATE POLICY "Delegations are readable by everyone authenticated" ON public.delegations FOR SELECT TO authenticated USING (true);

-- Fix participants table to allow Super Admin and other relevant roles
-- Currently it might be too restrictive
DROP POLICY IF EXISTS "Super admin can do everything on participants" ON public.participants;
CREATE POLICY "Super admin can do everything on participants" 
ON public.participants FOR ALL 
TO authenticated 
USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Coordinators can read participants" ON public.participants;
CREATE POLICY "Coordinators can read participants" 
ON public.participants FOR SELECT 
TO authenticated 
USING (has_role(auth.uid(), 'coordenador_modalidade'));
