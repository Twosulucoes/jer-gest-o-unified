-- Etapa 5 da Auditoria do Módulo de Alimentação
-- Habilita o perfil 'delegacao' a consultar consumos de refeição dos
-- próprios atletas no PWA, sem expor dados de outras delegações.
--
-- Padrão usado: get_user_delegation_id(auth.uid()) (helper SECURITY
-- DEFINER já existente em 20260411044949).

-- ---------------------------------------------------------------------
-- meal_windows: leitura aberta para o perfil delegacao.
-- O cardápio/horário não é dado sensível — qualquer delegação pode ver
-- as janelas para cruzar com seus consumos.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "meal_windows delegacao read" ON public.meal_windows;
CREATE POLICY "meal_windows delegacao read"
  ON public.meal_windows FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'delegacao'::public.app_role));

-- ---------------------------------------------------------------------
-- meal_locations: idem (necessário para o JOIN meal_window_location_id).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "meal_locations delegacao read" ON public.meal_locations;
CREATE POLICY "meal_locations delegacao read"
  ON public.meal_locations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'delegacao'::public.app_role));

-- ---------------------------------------------------------------------
-- meal_types: idem (rótulo da refeição na lista).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "meal_types delegacao read" ON public.meal_types;
CREATE POLICY "meal_types delegacao read"
  ON public.meal_types FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'delegacao'::public.app_role));

-- ---------------------------------------------------------------------
-- meal_consumptions: leitura SOMENTE de consumos cujo participant_id
-- pertença à delegação do usuário.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "meal_consumptions delegacao read" ON public.meal_consumptions;
CREATE POLICY "meal_consumptions delegacao read"
  ON public.meal_consumptions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'delegacao'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = meal_consumptions.participant_id
        AND p.delegation_id = public.get_user_delegation_id(auth.uid())
    )
  );
