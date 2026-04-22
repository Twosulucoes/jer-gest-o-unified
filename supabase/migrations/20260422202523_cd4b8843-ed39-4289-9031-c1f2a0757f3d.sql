
-- Remove blanket SELECT true policies that expose sensitive contact data and stage participation
DROP POLICY IF EXISTS "Delegations are readable by everyone authenticated" ON public.delegations;
DROP POLICY IF EXISTS "pes_read_authenticated" ON public.participant_event_stages;

-- Add scoped SELECT policies for participant_event_stages so operational roles still work
CREATE POLICY "pes_read_operational_roles"
ON public.participant_event_stages
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'secretaria'::app_role)
  OR has_role(auth.uid(), 'coordenacao_tecnica'::app_role)
  OR has_role(auth.uid(), 'transporte'::app_role)
  OR has_role(auth.uid(), 'alimentacao'::app_role)
  OR has_role(auth.uid(), 'alojamento'::app_role)
);

-- Allow delegacao users to see their own delegation participants' stage links
CREATE POLICY "pes_read_delegacao_own"
ON public.participant_event_stages
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'delegacao'::app_role)
  AND EXISTS (
    SELECT 1 FROM participants p
    WHERE p.id = participant_event_stages.participant_id
      AND p.delegation_id = get_user_delegation_id(auth.uid())
  )
);
