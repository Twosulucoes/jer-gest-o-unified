-- ============================================================
-- Fix: referee_indisponibilities had RLS enabled but zero policies
-- (silent deny-all for every user). Add policies consistent with
-- the pattern used by referee_profiles.
-- ============================================================

-- Ensure table exists (was created outside migration history in production)
CREATE TABLE IF NOT EXISTS public.referee_indisponibilities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referee_id      uuid,
  event_stage_id  uuid,
  start_date      timestamptz,
  end_date        timestamptz,
  reason          text,
  status          text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.referee_indisponibilities ENABLE ROW LEVEL SECURITY;

-- Admin: full control
DROP POLICY IF EXISTS "referee_indisponibilities admin full access" ON public.referee_indisponibilities;
CREATE POLICY "referee_indisponibilities admin full access"
ON public.referee_indisponibilities
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Secretaria: full control
DROP POLICY IF EXISTS "referee_indisponibilities secretaria full access" ON public.referee_indisponibilities;
CREATE POLICY "referee_indisponibilities secretaria full access"
ON public.referee_indisponibilities
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'secretaria'::app_role))
WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

-- Coordenação técnica: full control
DROP POLICY IF EXISTS "referee_indisponibilities coord_tecnica full access" ON public.referee_indisponibilities;
CREATE POLICY "referee_indisponibilities coord_tecnica full access"
ON public.referee_indisponibilities
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- Coordenador modalidade: read-only
DROP POLICY IF EXISTS "referee_indisponibilities coord_modalidade read" ON public.referee_indisponibilities;
CREATE POLICY "referee_indisponibilities coord_modalidade read"
ON public.referee_indisponibilities
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'coordenador_modalidade'::app_role));

-- Referee (arbitragem): manage their own indisponibilities only
DROP POLICY IF EXISTS "referee_indisponibilities own read" ON public.referee_indisponibilities;
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

DROP POLICY IF EXISTS "referee_indisponibilities own insert" ON public.referee_indisponibilities;
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

DROP POLICY IF EXISTS "referee_indisponibilities own update" ON public.referee_indisponibilities;
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

DROP POLICY IF EXISTS "referee_indisponibilities own delete" ON public.referee_indisponibilities;
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
