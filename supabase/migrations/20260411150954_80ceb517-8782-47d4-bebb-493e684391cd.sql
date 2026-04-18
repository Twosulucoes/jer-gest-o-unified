
-- 1) Tabela de mapeamento
CREATE TABLE IF NOT EXISTS public.sport_event_prova_map (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sport_event_id uuid PRIMARY KEY REFERENCES public.sport_events(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  prova_raw text NOT NULL,
  prova_raw_normalized text NOT NULL,
  prova_slug text NOT NULL,
  prova_display text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL DEFAULT auth.uid()
);

ALTER TABLE public.sport_event_prova_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access sport_event_prova_map"
ON public.sport_event_prova_map FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria full access sport_event_prova_map"
ON public.sport_event_prova_map FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'secretaria'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "CoordTec read sport_event_prova_map"
ON public.sport_event_prova_map FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- 2) RPC refresh
CREATE OR REPLACE FUNCTION public.refresh_sport_event_prova_map(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path='public'
AS $$
DECLARE
  v_count int := 0;
BEGIN
  IF p_event_id IS NULL THEN RAISE EXCEPTION 'event_id obrigatório' USING ERRCODE='22023'; END IF;

  INSERT INTO public.sport_event_prova_map (
    event_id, sport_event_id, sport_id,
    prova_raw, prova_raw_normalized, prova_slug, prova_display,
    updated_at, updated_by
  )
  SELECT
    se.event_id,
    se.id,
    se.sport_id,
    COALESCE(NULLIF(se.name,''), se.slug, 'SEM_PROVA'),
    (public.resolve_prova_slug(se.event_id, se.sport_id, COALESCE(NULLIF(se.name,''), se.slug, 'SEM_PROVA'))->>'prova_raw_normalized'),
    (public.resolve_prova_slug(se.event_id, se.sport_id, COALESCE(NULLIF(se.name,''), se.slug, 'SEM_PROVA'))->>'prova_slug'),
    (public.resolve_prova_slug(se.event_id, se.sport_id, COALESCE(NULLIF(se.name,''), se.slug, 'SEM_PROVA'))->>'prova_display'),
    now(),
    auth.uid()
  FROM public.sport_events se
  WHERE se.event_id = p_event_id
  ON CONFLICT (sport_event_id) DO UPDATE SET
    prova_raw = EXCLUDED.prova_raw,
    prova_raw_normalized = EXCLUDED.prova_raw_normalized,
    prova_slug = EXCLUDED.prova_slug,
    prova_display = EXCLUDED.prova_display,
    updated_at = now(),
    updated_by = auth.uid();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'updated_rows', v_count,
    'status', 'ok'
  );
END;
$$;

-- 3) Recriar recompute com parte C usando prova_slug canônico
CREATE OR REPLACE FUNCTION public.recompute_participation_irregularities(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path='public'
AS $$
DECLARE
  v_rules jsonb;
  v_max_collective int := 1;
  v_max_ind_sports int := 2;
  v_max_events_per_sport int := 6;
BEGIN
  IF p_event_id IS NULL THEN RAISE EXCEPTION 'event_id obrigatório' USING ERRCODE='22023'; END IF;

  v_rules := public.get_event_participation_rules(p_event_id);
  v_max_collective := (v_rules->>'max_collective_teams_per_athlete')::int;
  v_max_ind_sports := (v_rules->>'max_individual_sports_per_athlete')::int;
  v_max_events_per_sport := (v_rules->>'max_events_per_individual_sport')::int;

  UPDATE public.participation_irregularities
     SET status='resolved', resolved_at=now(), resolved_by=auth.uid()
   WHERE event_id=p_event_id AND status='open';

  -- A) LIMIT_COLLECTIVE_TEAMS
  INSERT INTO public.participation_irregularities(event_id, participant_id, rule_code, severity, status, message, context)
  SELECT
    p_event_id,
    tm.participant_id,
    'LIMIT_COLLECTIVE_TEAMS',
    'blocking',
    'open',
    format('Atleta excedeu limite de equipes coletivas (limite=%s).', v_max_collective),
    jsonb_build_object(
      'limit', v_max_collective,
      'count', COUNT(DISTINCT t.id),
      'team_ids', jsonb_agg(DISTINCT t.id)
    )
  FROM public.team_members tm
  JOIN public.teams t ON t.id = tm.team_id
  JOIN public.sport_events se ON se.id = t.sport_event_id AND se.event_id = p_event_id
  JOIN public.sports s ON s.id = se.sport_id AND s.is_collective = true
  GROUP BY tm.participant_id
  HAVING COUNT(DISTINCT t.id) > v_max_collective;

  -- B) LIMIT_INDIVIDUAL_SPORTS
  INSERT INTO public.participation_irregularities(event_id, participant_id, rule_code, severity, status, message, context)
  SELECT
    p_event_id,
    pse.participant_id,
    'LIMIT_INDIVIDUAL_SPORTS',
    'blocking',
    'open',
    format('Atleta excedeu limite de modalidades individuais (limite=%s).', v_max_ind_sports),
    jsonb_build_object(
      'limit', v_max_ind_sports,
      'count', COUNT(DISTINCT se.sport_id),
      'sport_ids', jsonb_agg(DISTINCT se.sport_id)
    )
  FROM public.participant_sport_events pse
  JOIN public.sport_events se ON se.id = pse.sport_event_id AND se.event_id = p_event_id
  JOIN public.sports s ON s.id = se.sport_id AND s.is_collective = false
  GROUP BY pse.participant_id
  HAVING COUNT(DISTINCT se.sport_id) > v_max_ind_sports;

  -- C) LIMIT_EVENTS_PER_SPORT (conta por prova_slug canônico via mapa)
  INSERT INTO public.participation_irregularities(event_id, participant_id, rule_code, severity, status, message, context)
  SELECT
    p_event_id,
    pse.participant_id,
    'LIMIT_EVENTS_PER_SPORT',
    'blocking',
    'open',
    format('Atleta excedeu limite de provas na modalidade individual (limite=%s, encontrado=%s).', v_max_events_per_sport, COUNT(DISTINCT m.prova_slug)),
    jsonb_build_object(
      'limit', v_max_events_per_sport,
      'sport_id', se.sport_id,
      'count', COUNT(DISTINCT m.prova_slug),
      'prova_slugs', jsonb_agg(DISTINCT m.prova_slug),
      'sport_event_ids', jsonb_agg(DISTINCT pse.sport_event_id)
    )
  FROM public.participant_sport_events pse
  JOIN public.sport_events se
    ON se.id = pse.sport_event_id AND se.event_id = p_event_id
  JOIN public.sports s
    ON s.id = se.sport_id AND s.is_collective = false
  JOIN public.sport_event_prova_map m
    ON m.sport_event_id = pse.sport_event_id AND m.event_id = p_event_id
  GROUP BY pse.participant_id, se.sport_id
  HAVING COUNT(DISTINCT m.prova_slug) > v_max_events_per_sport;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'rules', v_rules,
    'status', 'ok'
  );
END;
$$;
