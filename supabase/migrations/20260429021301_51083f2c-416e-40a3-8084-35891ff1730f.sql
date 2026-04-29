-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage inferences" ON public.sport_family_inferences;

-- Create a more restrictive SELECT policy
CREATE POLICY "Authenticated users can view inferences"
ON public.sport_family_inferences
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create restrictive INSERT and UPDATE policies for super_admin only using has_role
CREATE POLICY "Super admins can insert inferences"
ON public.sport_family_inferences
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update inferences"
ON public.sport_family_inferences
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));