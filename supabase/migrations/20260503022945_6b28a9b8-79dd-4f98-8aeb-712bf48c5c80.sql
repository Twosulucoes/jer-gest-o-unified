-- Ajustando as políticas da tabela meal_locations para serem mais flexíveis
DROP POLICY IF EXISTS "Enable insert for admins and secretaria" ON public.meal_locations;
DROP POLICY IF EXISTS "Enable update for admins and secretaria" ON public.meal_locations;
DROP POLICY IF EXISTS "Enable delete for admins and secretaria" ON public.meal_locations;

CREATE POLICY "Enable all for authenticated users on meal_locations" 
ON public.meal_locations 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Ajustando as políticas da tabela meal_windows para seguir o mesmo padrão
DROP POLICY IF EXISTS "Enable insert for admins and secretaria" ON public.meal_windows;
DROP POLICY IF EXISTS "Enable update for admins and secretaria" ON public.meal_windows;
DROP POLICY IF EXISTS "Enable delete for admins and secretaria" ON public.meal_windows;

CREATE POLICY "Enable all for authenticated users on meal_windows" 
ON public.meal_windows 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);