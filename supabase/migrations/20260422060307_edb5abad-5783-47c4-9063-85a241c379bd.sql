-- Drop redundant select policies
DROP POLICY IF EXISTS "CoordTec read user_sport_links" ON public.user_sport_links;
DROP POLICY IF EXISTS "Secretaria read user_sport_links" ON public.user_sport_links;

-- Update the main management policy to include secretaria and coordenacao_tecnica
DROP POLICY IF EXISTS "Admin full access user_sport_links" ON public.user_sport_links;

CREATE POLICY "Manage user_sport_links"
  ON public.user_sport_links FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'secretaria'::app_role) OR 
    has_role(auth.uid(), 'coordenacao_tecnica'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'secretaria'::app_role) OR 
    has_role(auth.uid(), 'coordenacao_tecnica'::app_role)
  );
