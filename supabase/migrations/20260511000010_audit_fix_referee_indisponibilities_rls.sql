-- ============================================================
-- Fix: referee_indisponibilities had RLS enabled but zero policies
-- (silent deny-all for every user). Add policies consistent with
-- the pattern used by referee_profiles.
-- ============================================================

-- Admin: full control
CREATE POLICY "referee_indisponibilities admin full access"
ON public.referee_indisponibilities
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Secretaria: full control
CREATE POLICY "referee_indisponibilities secretaria full access"
ON public.referee_indisponibilities
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'secretaria'::app_role))
WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

-- Coordenação técnica: full control
CREATE POLICY "referee_indisponibilities coord_tecnica full access"
ON public.referee_indisponibilities
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- Coordenador modalidade: read-only
CREATE POLICY "referee_indisponibilities coord_modalidade read"
ON public.referee_indisponibilities
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'coordenador_modalidade'::app_role));

-- Referee (arbitragem): manage their own indisponibilities only
CREATE POLICY "referee_indisponibilities own read"
ON public.referee_indisponibilities
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'arbitragem'::app_role)
  AND referee_id IN (
    SELECT id FROM public.referee_profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "referee_indisponibilities own insert"
ON public.referee_indisponibilities
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'arbitragem'::app_role)
  AND referee_id IN (
    SELECT id FROM public.referee_profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "referee_indisponibilities own update"
ON public.referee_indisponibilities
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'arbitragem'::app_role)
  AND referee_id IN (
    SELECT id FROM public.referee_profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'arbitragem'::app_role)
  AND referee_id IN (
    SELECT id FROM public.referee_profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "referee_indisponibilities own delete"
ON public.referee_indisponibilities
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'arbitragem'::app_role)
  AND referee_id IN (
    SELECT id FROM public.referee_profiles WHERE user_id = auth.uid()
  )
);
