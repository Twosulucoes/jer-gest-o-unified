
-- =============================================
-- PARTE A: ROBUSTEZ + PERFORMANCE
-- =============================================

-- A2) Índices de performance
CREATE INDEX IF NOT EXISTS idx_pi_event_status_sev
  ON public.participation_irregularities (event_id, status, severity);

CREATE INDEX IF NOT EXISTS idx_pi_event_participant
  ON public.participation_irregularities (event_id, participant_id);

CREATE INDEX IF NOT EXISTS idx_pse_participant
  ON public.participant_sport_events (participant_id);

CREATE INDEX IF NOT EXISTS idx_pse_sport_event
  ON public.participant_sport_events (sport_event_id);

CREATE INDEX IF NOT EXISTS idx_se_event_sport
  ON public.sport_events (event_id, sport_id);

CREATE INDEX IF NOT EXISTS idx_sepm_event_sport_slug
  ON public.sport_event_prova_map (event_id, sport_id, prova_slug);

CREATE INDEX IF NOT EXISTS idx_sepm_sport_event
  ON public.sport_event_prova_map (sport_event_id);

-- A3) Atualizar refresh_sport_event_prova_map para usar slug como prova_raw preferencial
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
    COALESCE(NULLIF(se.slug,''), NULLIF(se.name,''), 'SEM_PROVA') AS prova_raw,
    (public.resolve_prova_slug(se.event_id, se.sport_id, COALESCE(NULLIF(se.slug,''), NULLIF(se.name,''), 'SEM_PROVA'))->>'prova_raw_normalized') AS prova_raw_normalized,
    (public.resolve_prova_slug(se.event_id, se.sport_id, COALESCE(NULLIF(se.slug,''), NULLIF(se.name,''), 'SEM_PROVA'))->>'prova_slug') AS prova_slug,
    (public.resolve_prova_slug(se.event_id, se.sport_id, COALESCE(NULLIF(se.slug,''), NULLIF(se.name,''), 'SEM_PROVA'))->>'prova_display') AS prova_display,
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

-- A1) Atualizar recompute para chamar refresh automaticamente
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

  -- A1: Garantir mapa atualizado antes de calcular
  PERFORM public.refresh_sport_event_prova_map(p_event_id);

  -- Fechar irregularidades open existentes
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

  -- C) LIMIT_EVENTS_PER_SPORT (conta por prova_slug canônico)
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

-- =============================================
-- PARTE B: BLOQUEIO NO CREDENCIAMENTO
-- =============================================

-- B1) RPC detalhada para UI
CREATE OR REPLACE FUNCTION public.get_blocking_irregularities(p_event_id uuid, p_participant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path='public'
AS $$
BEGIN
  IF p_event_id IS NULL OR p_participant_id IS NULL THEN
    RAISE EXCEPTION 'event_id e participant_id são obrigatórios' USING ERRCODE='22023';
  END IF;

  RETURN jsonb_build_object(
    'has_blocking', EXISTS (
      SELECT 1 FROM public.participation_irregularities pi
      WHERE pi.event_id=p_event_id AND pi.participant_id=p_participant_id
        AND pi.status='open' AND pi.severity='blocking'
    ),
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pi.id,
          'rule_code', pi.rule_code,
          'message', pi.message,
          'context', pi.context,
          'created_at', pi.created_at
        )
        ORDER BY pi.created_at DESC
      )
      FROM public.participation_irregularities pi
      WHERE pi.event_id=p_event_id AND pi.participant_id=p_participant_id
        AND pi.status='open' AND pi.severity='blocking'
    ), '[]'::jsonb)
  );
END;
$$;

-- B1) RPC batch: lista participantes bloqueados
CREATE OR REPLACE FUNCTION public.list_blocked_participants(p_event_id uuid)
RETURNS TABLE (participant_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path='public'
AS $$
  SELECT DISTINCT pi.participant_id
  FROM public.participation_irregularities pi
  WHERE pi.event_id=p_event_id AND pi.status='open' AND pi.severity='blocking';
$$;

-- B2) Trigger fail-safe em participant_credentials
CREATE OR REPLACE FUNCTION public.prevent_credential_activation_if_blocking_irregularity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path='public'
AS $$
BEGIN
  IF NEW.status = 'active'
     AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN

    IF EXISTS (
      SELECT 1 FROM public.participation_irregularities pi
      WHERE pi.event_id = NEW.event_id
        AND pi.participant_id = NEW.participant_id
        AND pi.status='open'
        AND pi.severity='blocking'
    ) THEN
      RAISE EXCEPTION 'Credenciamento bloqueado: atleta possui irregularidade aberta. Resolva em Irregularidades.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_credential_activation ON public.participant_credentials;
CREATE TRIGGER trg_block_credential_activation
BEFORE INSERT OR UPDATE OF status ON public.participant_credentials
FOR EACH ROW EXECUTE FUNCTION public.prevent_credential_activation_if_blocking_irregularity();
