
-- Mesario can read match_events for assigned matches
CREATE POLICY "Mesario can read match_events"
ON public.match_events
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'mesario'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.match_user_assignments mua
    WHERE mua.match_id = match_events.match_id
      AND mua.user_id = auth.uid()
  )
);

-- Mesario can insert match_events for assigned matches
CREATE POLICY "Mesario can insert match_events"
ON public.match_events
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'mesario'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.match_user_assignments mua
    WHERE mua.match_id = match_events.match_id
      AND mua.user_id = auth.uid()
  )
);

-- Mesario can delete own match_events for assigned matches
CREATE POLICY "Mesario can delete match_events"
ON public.match_events
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'mesario'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.match_user_assignments mua
    WHERE mua.match_id = match_events.match_id
      AND mua.user_id = auth.uid()
  )
);

-- Coordenador modalidade full access to match_events
CREATE POLICY "Coord modalidade manage match_events"
ON public.match_events
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'coordenador_modalidade'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordenador_modalidade'::app_role));

-- Mesario can read match_lineups for assigned matches
CREATE POLICY "Mesario can read match_lineups"
ON public.match_lineups
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'mesario'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.match_user_assignments mua
    WHERE mua.match_id = match_lineups.match_id
      AND mua.user_id = auth.uid()
  )
);

-- Mesario can read competition_matches they are assigned to
CREATE POLICY "Mesario can read assigned matches"
ON public.competition_matches
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'mesario'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.match_user_assignments mua
    WHERE mua.match_id = competition_matches.id
      AND mua.user_id = auth.uid()
  )
);

-- Mesario can read entries for assigned matches
CREATE POLICY "Mesario can read assigned match entries"
ON public.competition_match_entries
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'mesario'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.match_user_assignments mua
    WHERE mua.match_id = competition_match_entries.match_id
      AND mua.user_id = auth.uid()
  )
);

-- Mesario can read match_scores for assigned matches
CREATE POLICY "Mesario can read assigned match_scores"
ON public.match_scores
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'mesario'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.match_user_assignments mua
    WHERE mua.match_id = match_scores.match_id
      AND mua.user_id = auth.uid()
  )
);

-- Coordenador modalidade can manage match_user_assignments
CREATE POLICY "Coord modalidade manage match_user_assignments"
ON public.match_user_assignments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'coordenador_modalidade'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordenador_modalidade'::app_role));

-- Mesario can read own assignments
CREATE POLICY "Mesario can read own assignments"
ON public.match_user_assignments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'mesario'::app_role)
  AND user_id = auth.uid()
);

-- Coordenador modalidade can read competition_matches
CREATE POLICY "Coord modalidade read competition_matches"
ON public.competition_matches
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'coordenador_modalidade'::app_role));

-- Coordenador modalidade can manage competition_match_entries
CREATE POLICY "Coord modalidade manage match_entries"
ON public.competition_match_entries
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'coordenador_modalidade'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordenador_modalidade'::app_role));

-- Coordenador modalidade can manage match_lineups
CREATE POLICY "Coord modalidade manage match_lineups"
ON public.match_lineups
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'coordenador_modalidade'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordenador_modalidade'::app_role));

-- Coordenador modalidade can manage match_scores
CREATE POLICY "Coord modalidade manage match_scores"
ON public.match_scores
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'coordenador_modalidade'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordenador_modalidade'::app_role));

-- Coordenador modalidade can manage competition_match_results
CREATE POLICY "Coord modalidade manage match_results"
ON public.competition_match_results
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'coordenador_modalidade'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordenador_modalidade'::app_role));

-- Mesario can read competition_match_results for assigned matches
CREATE POLICY "Mesario can read assigned match_results"
ON public.competition_match_results
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'mesario'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.match_user_assignments mua
    WHERE mua.match_id = competition_match_results.match_id
      AND mua.user_id = auth.uid()
  )
);

-- Mesario can read competition_phases (needed for navigation)
CREATE POLICY "Mesario can read phases"
ON public.competition_phases
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'mesario'::app_role));

-- Coordenador modalidade can read competition_phases
CREATE POLICY "Coord modalidade read phases"
ON public.competition_phases
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'coordenador_modalidade'::app_role));
