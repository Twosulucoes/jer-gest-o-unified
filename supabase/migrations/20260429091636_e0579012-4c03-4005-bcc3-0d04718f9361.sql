-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Admins and secretaria can manage service vouchers" ON public.service_vouchers;
DROP POLICY IF EXISTS "Operacional roles can view service vouchers" ON public.service_vouchers;
DROP POLICY IF EXISTS "Admins and secretaria can manage voucher batches" ON public.service_voucher_batches;
DROP POLICY IF EXISTS "Operacional roles can view voucher batches" ON public.service_voucher_batches;
DROP POLICY IF EXISTS "Admins and secretaria can manage eventual people" ON public.service_eventual_people;
DROP POLICY IF EXISTS "Operacional roles can view eventual people" ON public.service_eventual_people;

-- Re-create policies using only user_roles (which is in public schema and accessible)
-- Service Vouchers
CREATE POLICY "Admins and secretaria can manage service vouchers" 
ON public.service_vouchers 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin'))
  )
);

CREATE POLICY "Operacional roles can view service vouchers" 
ON public.service_vouchers 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('transporte', 'alimentacao', 'alojamento', 'coordenacao_tecnica'))
  )
);

-- Voucher Batches
CREATE POLICY "Admins and secretaria can manage voucher batches" 
ON public.service_voucher_batches 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin'))
  )
);

CREATE POLICY "Operacional roles can view voucher batches" 
ON public.service_voucher_batches 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('transporte', 'alimentacao', 'alojamento', 'coordenacao_tecnica'))
  )
);

-- Eventual People
CREATE POLICY "Admins and secretaria can manage eventual people" 
ON public.service_eventual_people 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin'))
  )
);

CREATE POLICY "Operacional roles can view eventual people" 
ON public.service_eventual_people 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('transporte', 'alimentacao', 'alojamento', 'coordenacao_tecnica'))
  )
);
