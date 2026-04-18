
-- =============================================
-- TABLES
-- =============================================

-- 1) Dicionário de aliases
CREATE TABLE IF NOT EXISTS public.prova_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sport_id uuid NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  prova_raw_normalized text NOT NULL,
  prova_slug_override text NOT NULL,
  prova_display_override text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL DEFAULT auth.uid(),
  UNIQUE (event_id, sport_id, prova_raw_normalized)
);
ALTER TABLE public.prova_aliases ENABLE ROW LEVEL SECURITY;

-- 2) Catálogo de provas
CREATE TABLE IF NOT EXISTS public.prova_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  prova_raw text NOT NULL,
  prova_raw_normalized text NOT NULL,
  prova_slug text NOT NULL,
  prova_display text NOT NULL,
  age_band text NULL,
  sex text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL DEFAULT auth.uid(),
  UNIQUE (event_id, sport_id, prova_raw_normalized, sex, age_band)
);
ALTER TABLE public.prova_catalog ENABLE ROW LEVEL SECURITY;

-- 3) Irregularidades
CREATE TABLE IF NOT EXISTS public.participation_irregularities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  rule_code text NOT NULL,
  severity text NOT NULL DEFAULT 'blocking',
  status text NOT NULL DEFAULT 'open',
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL DEFAULT auth.uid(),
  resolved_at timestamptz NULL,
  resolved_by uuid NULL
);
ALTER TABLE public.participation_irregularities ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_participation_irregularities_event_status
  ON public.participation_irregularities(event_id, status);

-- =============================================
-- RLS — prova_aliases
-- =============================================
CREATE POLICY "Admin full access prova_aliases"
ON public.prova_aliases FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria full access prova_aliases"
ON public.prova_aliases FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'secretaria'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "CoordTec read prova_aliases"
ON public.prova_aliases FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- =============================================
-- RLS — prova_catalog
-- =============================================
CREATE POLICY "Admin full access prova_catalog"
ON public.prova_catalog FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria full access prova_catalog"
ON public.prova_catalog FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'secretaria'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "CoordTec read prova_catalog"
ON public.prova_catalog FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- =============================================
-- RLS — participation_irregularities
-- =============================================
CREATE POLICY "Admin full access participation_irregularities"
ON public.participation_irregularities FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria full access participation_irregularities"
ON public.participation_irregularities FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'secretaria'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "CoordTec read participation_irregularities"
ON public.participation_irregularities FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

CREATE POLICY "CoordTec update status participation_irregularities"
ON public.participation_irregularities FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- =============================================
-- FUNCTIONS — Normalização
-- =============================================

CREATE OR REPLACE FUNCTION public.normalize_text(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = 'public'
AS $$
  SELECT trim(regexp_replace(
           upper(
             translate(coalesce(p,''),
               'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
               'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')
           ),
           '\s+',' ','g'
         ));
$$;

CREATE OR REPLACE FUNCTION public.normalize_prova_slug(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = 'public'
AS $$
  SELECT lower(
    regexp_replace(
      regexp_replace(public.normalize_text(p), '[^A-Z0-9 ]', '', 'g'),
      '\s+','-','g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_prova_slug(p_event_id uuid, p_sport_id uuid, p_prova_raw text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path='public'
AS $$
DECLARE
  v_norm text;
  v_slug text;
  v_disp text;
  v_override record;
BEGIN
  v_norm := public.normalize_text(p_prova_raw);
  v_slug := public.normalize_prova_slug(p_prova_raw);
  v_disp := trim(coalesce(p_prova_raw,''));

  SELECT prova_slug_override, prova_display_override
    INTO v_override
  FROM public.prova_aliases
  WHERE event_id = p_event_id
    AND (sport_id IS NULL OR sport_id = p_sport_id)
    AND prova_raw_normalized = v_norm
  LIMIT 1;

  IF FOUND THEN
    v_slug := v_override.prova_slug_override;
    IF v_override.prova_display_override IS NOT NULL AND v_override.prova_display_override <> '' THEN
      v_disp := v_override.prova_display_override;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'prova_raw_normalized', v_norm,
    'prova_slug', v_slug,
    'prova_display', v_disp
  );
END;
$$;

-- =============================================
-- RPC — Recompute irregularities
-- =============================================

CREATE OR REPLACE FUNCTION public.recompute_participation_irregularities(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path='public'
AS $$
DECLARE
  v_rules jsonb;
  v_max_collective int;
  v_max_ind_sports int;
  v_max_events_per_sport int;
  v_closed int := 0;
  v_created_a int := 0;
  v_created_b int := 0;
  v_created_c int := 0;
BEGIN
  IF p_event_id IS NULL THEN RAISE EXCEPTION 'event_id obrigatório' USING ERRCODE='22023'; END IF;

  v_rules := public.get_event_participation_rules(p_event_id);
  v_max_collective := (v_rules->>'max_collective_teams_per_athlete')::int;
  v_max_ind_sports := (v_rules->>'max_individual_sports_per_athlete')::int;
  v_max_events_per_sport := (v_rules->>'max_events_per_individual_sport')::int;

  -- Close existing open irregularities
  UPDATE public.participation_irregularities
     SET status='resolved', resolved_at=now(), resolved_by=auth.uid()
   WHERE event_id=p_event_id AND status='open';
  GET DIAGNOSTICS v_closed = ROW_COUNT;

  -- A) LIMIT_COLLECTIVE_TEAMS
  INSERT INTO public.participation_irregularities(event_id, participant_id, rule_code, severity, status, message, context)
  SELECT
    p_event_id,
    tm.participant_id,
    'LIMIT_COLLECTIVE_TEAMS',
    'blocking',
    'open',
    format('Atleta excedeu limite de equipes coletivas (limite=%s, encontrado=%s).', v_max_collective, COUNT(DISTINCT t.id)),
    jsonb_build_object(
      'limit', v_max_collective,
      'count', COUNT(DISTINCT t.id),
      'team_ids', jsonb_agg(DISTINCT t.id)
    )
  FROM public.team_members tm
  JOIN public.teams t ON t.id = tm.team_id
  JOIN public.sport_events se ON se.id = t.sport_event_id AND se.event_id = p_event_id
  JOIN public.sports s ON s.id = se.sport_id AND s.is_collective = true
  WHERE tm.is_active = true
  GROUP BY tm.participant_id
  HAVING COUNT(DISTINCT t.id) > v_max_collective;
  GET DIAGNOSTICS v_created_a = ROW_COUNT;

  -- B) LIMIT_INDIVIDUAL_SPORTS
  INSERT INTO public.participation_irregularities(event_id, participant_id, rule_code, severity, status, message, context)
  SELECT
    p_event_id,
    pse.participant_id,
    'LIMIT_INDIVIDUAL_SPORTS',
    'blocking',
    'open',
    format('Atleta excedeu limite de modalidades individuais (limite=%s, encontrado=%s).', v_max_ind_sports, COUNT(DISTINCT se.sport_id)),
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
  GET DIAGNOSTICS v_created_b = ROW_COUNT;

  -- C) LIMIT_EVENTS_PER_SPORT
  INSERT INTO public.participation_irregularities(event_id, participant_id, rule_code, severity, status, message, context)
  SELECT
    p_event_id,
    pse.participant_id,
    'LIMIT_EVENTS_PER_SPORT',
    'blocking',
    'open',
    format('Atleta excedeu limite de provas na modalidade individual (limite=%s, encontrado=%s).', v_max_events_per_sport, COUNT(DISTINCT pse.sport_event_id)),
    jsonb_build_object(
      'limit', v_max_events_per_sport,
      'sport_id', se.sport_id,
      'count', COUNT(DISTINCT pse.sport_event_id),
      'sport_event_ids', jsonb_agg(DISTINCT pse.sport_event_id)
    )
  FROM public.participant_sport_events pse
  JOIN public.sport_events se ON se.id = pse.sport_event_id AND se.event_id = p_event_id
  JOIN public.sports s ON s.id = se.sport_id AND s.is_collective = false
  GROUP BY pse.participant_id, se.sport_id
  HAVING COUNT(DISTINCT pse.sport_event_id) > v_max_events_per_sport;
  GET DIAGNOSTICS v_created_c = ROW_COUNT;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'rules', v_rules,
    'closed_previous', v_closed,
    'created', jsonb_build_object(
      'collective_teams', v_created_a,
      'individual_sports', v_created_b,
      'events_per_sport', v_created_c,
      'total', v_created_a + v_created_b + v_created_c
    ),
    'status', 'ok'
  );
END;
$$;
