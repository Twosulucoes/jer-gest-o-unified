-- 1. Function to check if the user is a modality coordinator and has access to a specific sport
CREATE OR REPLACE FUNCTION public.check_modality_coordinator_access(p_sport_id uuid)
RETURNS boolean AS $$
BEGIN
  -- If not a modality coordinator, then they have access (other policies will handle them)
  IF NOT has_role(auth.uid(), 'coordenador_modalidade'::app_role) THEN
    RETURN TRUE;
  END IF;

  -- Check if the user is linked to this specific sport in the user_sport_links table
  RETURN EXISTS (
    SELECT 1 FROM user_sport_links
    WHERE user_id = auth.uid()
    AND sport_id = p_sport_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Restrict competition_matches
DROP POLICY IF EXISTS "Coord modalidade read competition_matches" ON public.competition_matches;
CREATE POLICY "Coord modalidade read competition_matches" ON public.competition_matches
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_modalidade'::app_role) AND 
  EXISTS (
    SELECT 1 FROM sport_events se
    WHERE se.id = competition_matches.sport_event_id
    AND check_modality_coordinator_access(se.sport_id)
  )
);

-- 3. Restrict competition_match_results
DROP POLICY IF EXISTS "Coord modalidade manage match_results" ON public.competition_match_results;
CREATE POLICY "Coord modalidade manage match_results" ON public.competition_match_results
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_modalidade'::app_role) AND 
  EXISTS (
    SELECT 1 FROM competition_matches m
    JOIN sport_events se ON m.sport_event_id = se.id
    WHERE m.id = competition_match_results.match_id
    AND check_modality_coordinator_access(se.sport_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'coordenador_modalidade'::app_role) AND 
  EXISTS (
    SELECT 1 FROM competition_matches m
    JOIN sport_events se ON m.sport_event_id = se.id
    WHERE m.id = competition_match_results.match_id
    AND check_modality_coordinator_access(se.sport_id)
  )
);

-- 4. Restrict sport_events
DROP POLICY IF EXISTS "Coord modalidade read sport_events" ON public.sport_events;
CREATE POLICY "Coord modalidade read sport_events" ON public.sport_events
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_modalidade'::app_role) AND 
  check_modality_coordinator_access(sport_id)
);

-- 5. Restrict sports
DROP POLICY IF EXISTS "Coord modalidade read sports" ON public.sports;
CREATE POLICY "Coord modalidade read sports" ON public.sports
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_modalidade'::app_role) AND 
  check_modality_coordinator_access(id)
);

-- 6. Restrict competition_phases
DROP POLICY IF EXISTS "Coord modalidade read competition_phases" ON public.competition_phases;
CREATE POLICY "Coord modalidade read competition_phases" ON public.competition_phases
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_modalidade'::app_role) AND 
  EXISTS (
    SELECT 1 FROM sport_events se
    WHERE se.id = competition_phases.sport_event_id
    AND check_modality_coordinator_access(se.sport_id)
  )
);

-- 7. Restrict competition_groups
DROP POLICY IF EXISTS "Coord modalidade read competition_groups" ON public.competition_groups;
CREATE POLICY "Coord modalidade read competition_groups" ON public.competition_groups
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_modalidade'::app_role) AND 
  EXISTS (
    SELECT 1 FROM competition_phases p
    JOIN sport_events se ON p.sport_event_id = se.id
    WHERE p.id = competition_groups.phase_id
    AND check_modality_coordinator_access(se.sport_id)
  )
);

-- 8. Restrict teams
DROP POLICY IF EXISTS "Coord modalidade read teams" ON public.teams;
CREATE POLICY "Coord modalidade read teams" ON public.teams
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_modalidade'::app_role) AND 
  EXISTS (
    SELECT 1 FROM sport_events se
    WHERE se.id = teams.sport_event_id
    AND check_modality_coordinator_access(se.sport_id)
  )
);

-- 9. Restrict participants
DROP POLICY IF EXISTS "Coord modalidade read participants" ON public.participants;
CREATE POLICY "Coord modalidade read participants" ON public.participants
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_modalidade'::app_role) AND 
  EXISTS (
    SELECT 1 FROM participant_sport_events pse
    JOIN sport_events se ON pse.sport_event_id = se.id
    WHERE pse.participant_id = participants.id
    AND check_modality_coordinator_access(se.sport_id)
  )
);
