-- Ajuste nas políticas de meal_locations
DROP POLICY IF EXISTS "Admin and Alimentacao manage locations" ON public.meal_locations;
DROP POLICY IF EXISTS "Everyone read locations" ON public.meal_locations;

CREATE POLICY "Enable read for all authenticated users"
ON public.meal_locations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for admins and secretaria"
ON public.meal_locations FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'secretaria'::text])
);

CREATE POLICY "Enable update for admins and secretaria"
ON public.meal_locations FOR UPDATE
TO authenticated
USING (
  (auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'secretaria'::text])
);

CREATE POLICY "Enable delete for admins and secretaria"
ON public.meal_locations FOR DELETE
TO authenticated
USING (
  (auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'secretaria'::text])
);

-- Ajuste nas políticas de meal_windows
DROP POLICY IF EXISTS "Admin full access meal_windows" ON public.meal_windows;
DROP POLICY IF EXISTS "Secretaria can manage meal_windows" ON public.meal_windows;

CREATE POLICY "Admins and Secretaria full access meal_windows"
ON public.meal_windows FOR ALL
TO authenticated
USING (
  (auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'secretaria'::text])
)
WITH CHECK (
  (auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'secretaria'::text])
);
