
-- =====================================================================
-- Atualização das Políticas RLS para operational_incidents
-- Objetivo: Garantir isolamento por event_id (via stage) e perfil.
-- =====================================================================

BEGIN;

-- 1. Remover políticas antigas
DROP POLICY IF EXISTS "Admins can view all incidents" ON public.operational_incidents;
DROP POLICY IF EXISTS "Operators can view own incidents" ON public.operational_incidents;
DROP POLICY IF EXISTS "Users can create incidents" ON public.operational_incidents;
DROP POLICY IF EXISTS "Admins can update incidents" ON public.operational_incidents;

-- 2. Política de Visualização (SELECT)
CREATE POLICY "Authorized profiles can view incidents"
ON public.operational_incidents
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    (public.has_role(auth.uid(), 'admin') 
     OR public.has_role(auth.uid(), 'secretaria') 
     OR public.has_role(auth.uid(), 'coordenacao_tecnica'))
    AND public.user_can_access_stage(auth.uid(), event_stage_id)
  )
  OR (
    (
      (module = 'transporte' AND public.has_role(auth.uid(), 'transporte'))
      OR (module = 'alimentacao' AND public.has_role(auth.uid(), 'alimentacao'))
      OR (module = 'alojamento' AND public.has_role(auth.uid(), 'alojamento'))
    )
    AND public.user_can_access_stage(auth.uid(), event_stage_id)
  )
  OR reported_by_user_id = auth.uid()
);

-- 3. Política de Inserção (INSERT)
CREATE POLICY "Users can create incidents"
ON public.operational_incidents
FOR INSERT
TO authenticated
WITH CHECK (
  reported_by_user_id = auth.uid()
  AND public.user_can_access_stage(auth.uid(), event_stage_id)
);

-- 4. Política de Atualização (UPDATE)
CREATE POLICY "Authorized profiles can update incidents"
ON public.operational_incidents
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    (public.has_role(auth.uid(), 'admin') 
     OR public.has_role(auth.uid(), 'secretaria'))
    AND public.user_can_access_stage(auth.uid(), event_stage_id)
  )
  OR (
    (
      (module = 'transporte' AND public.has_role(auth.uid(), 'transporte'))
      OR (module = 'alimentacao' AND public.has_role(auth.uid(), 'alimentacao'))
      OR (module = 'alojamento' AND public.has_role(auth.uid(), 'alojamento'))
    )
    AND public.user_can_access_stage(auth.uid(), event_stage_id)
  )
);

-- 5. Política de Exclusão (DELETE)
CREATE POLICY "Admins can delete incidents"
ON public.operational_incidents
FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

COMMIT;
