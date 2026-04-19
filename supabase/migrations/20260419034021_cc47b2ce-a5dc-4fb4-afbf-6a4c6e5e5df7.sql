-- Coordenador de modalidade: ler participantes que estão inscritos em alguma das modalidades vinculadas
CREATE POLICY "Coordenador modalidade can read scoped participants"
ON public.participants
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_modalidade'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.participant_sport_events pse
    JOIN public.sport_events se ON se.id = pse.sport_event_id
    JOIN public.user_sport_links usl
      ON usl.sport_id = se.sport_id
     AND usl.event_id = se.event_id
     AND usl.user_id = auth.uid()
    WHERE pse.participant_id = participants.id
  )
);

-- Pessoas relacionadas
CREATE POLICY "Coordenador modalidade can read scoped people"
ON public.people
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_modalidade'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.participants p
    JOIN public.participant_sport_events pse ON pse.participant_id = p.id
    JOIN public.sport_events se ON se.id = pse.sport_event_id
    JOIN public.user_sport_links usl
      ON usl.sport_id = se.sport_id
     AND usl.event_id = se.event_id
     AND usl.user_id = auth.uid()
    WHERE p.person_id = people.id
  )
);

-- Delegações relacionadas
CREATE POLICY "Coordenador modalidade can read scoped delegations"
ON public.delegations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_modalidade'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.participants p
    JOIN public.participant_sport_events pse ON pse.participant_id = p.id
    JOIN public.sport_events se ON se.id = pse.sport_event_id
    JOIN public.user_sport_links usl
      ON usl.sport_id = se.sport_id
     AND usl.event_id = se.event_id
     AND usl.user_id = auth.uid()
    WHERE p.delegation_id = delegations.id
  )
);

-- Instituições relacionadas
CREATE POLICY "Coordenador modalidade can read scoped institutions"
ON public.institutions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_modalidade'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.delegations d
    JOIN public.participants p ON p.delegation_id = d.id
    JOIN public.participant_sport_events pse ON pse.participant_id = p.id
    JOIN public.sport_events se ON se.id = pse.sport_event_id
    JOIN public.user_sport_links usl
      ON usl.sport_id = se.sport_id
     AND usl.event_id = se.event_id
     AND usl.user_id = auth.uid()
    WHERE d.institution_id = institutions.id
  )
);

-- participant_event_stages (filtro de etapa)
CREATE POLICY "Coordenador modalidade can read scoped stage links"
ON public.participant_event_stages
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_modalidade'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.participants p
    JOIN public.participant_sport_events pse ON pse.participant_id = p.id
    JOIN public.sport_events se ON se.id = pse.sport_event_id
    JOIN public.user_sport_links usl
      ON usl.sport_id = se.sport_id
     AND usl.event_id = se.event_id
     AND usl.user_id = auth.uid()
    WHERE p.id = participant_event_stages.participant_id
  )
);