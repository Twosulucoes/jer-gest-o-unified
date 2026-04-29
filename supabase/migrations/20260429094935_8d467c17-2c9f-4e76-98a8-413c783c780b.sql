-- Consolidar e simplificar políticas de gerenciamento de lotes
DROP POLICY IF EXISTS "Admins and secretaria can manage voucher batches" ON public.service_voucher_batches;
DROP POLICY IF EXISTS "Escrita de lotes por admin e secretaria" ON public.service_voucher_batches;

CREATE POLICY "Gerenciamento total de lotes por administradores" 
ON public.service_voucher_batches 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'secretaria', 'super_admin')
  )
  OR 
  (auth.jwt() -> 'user_metadata' ->> 'app_role') IN ('admin', 'secretaria', 'super_admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'secretaria', 'super_admin')
  )
  OR 
  (auth.jwt() -> 'user_metadata' ->> 'app_role') IN ('admin', 'secretaria', 'super_admin')
);

-- Garantir que a política de leitura também cubra os metadados se a tabela user_roles falhar
DROP POLICY IF EXISTS "Leitura de lotes por perfis autorizados" ON public.service_voucher_batches;
DROP POLICY IF EXISTS "Operacional roles can view voucher batches" ON public.service_voucher_batches;

CREATE POLICY "Visualização de lotes por perfis autorizados"
ON public.service_voucher_batches
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'secretaria', 'super_admin', 'coordenacao_tecnica', 'transporte', 'alimentacao', 'alojamento')
  )
  OR 
  (auth.jwt() -> 'user_metadata' ->> 'app_role') IN ('admin', 'secretaria', 'super_admin', 'coordenacao_tecnica', 'transporte', 'alimentacao', 'alojamento')
);