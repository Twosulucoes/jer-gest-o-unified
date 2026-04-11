
-- 1) Tabela
CREATE TABLE IF NOT EXISTS public.event_participation_rules (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  max_collective_teams_per_athlete int NOT NULL DEFAULT 1,
  max_individual_sports_per_athlete int NOT NULL DEFAULT 2,
  max_events_per_individual_sport int NOT NULL DEFAULT 6,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  CONSTRAINT chk_rules_nonnegative CHECK (
    max_collective_teams_per_athlete >= 0 AND
    max_individual_sports_per_athlete >= 0 AND
    max_events_per_individual_sport >= 0
  ),
  CONSTRAINT chk_rules_reasonable CHECK (
    max_collective_teams_per_athlete <= 50 AND
    max_individual_sports_per_athlete <= 50 AND
    max_events_per_individual_sport <= 50
  )
);

ALTER TABLE public.event_participation_rules ENABLE ROW LEVEL SECURITY;

-- 2) Audit trigger
CREATE TRIGGER trg_event_participation_rules_updated
BEFORE UPDATE ON public.event_participation_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) RLS
CREATE POLICY "Admin full access event_participation_rules"
ON public.event_participation_rules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria read event_participation_rules"
ON public.event_participation_rules FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Secretaria insert event_participation_rules"
ON public.event_participation_rules FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Secretaria update event_participation_rules"
ON public.event_participation_rules FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'secretaria'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "CoordTec read event_participation_rules"
ON public.event_participation_rules FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- 4) RPC get
CREATE OR REPLACE FUNCTION public.get_event_participation_rules(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE r public.event_participation_rules%ROWTYPE;
BEGIN
  IF p_event_id IS NULL THEN RAISE EXCEPTION 'event_id obrigatório' USING ERRCODE='22023'; END IF;

  SELECT * INTO r FROM public.event_participation_rules WHERE event_id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'event_id', p_event_id,
      'max_collective_teams_per_athlete', 1,
      'max_individual_sports_per_athlete', 2,
      'max_events_per_individual_sport', 6,
      'source', 'default'
    );
  END IF;

  RETURN jsonb_build_object(
    'event_id', r.event_id,
    'max_collective_teams_per_athlete', r.max_collective_teams_per_athlete,
    'max_individual_sports_per_athlete', r.max_individual_sports_per_athlete,
    'max_events_per_individual_sport', r.max_events_per_individual_sport,
    'source', 'db'
  );
END; $$;

-- 5) RPC upsert
CREATE OR REPLACE FUNCTION public.upsert_event_participation_rules(
  p_event_id uuid,
  p_max_collective_teams_per_athlete int,
  p_max_individual_sports_per_athlete int,
  p_max_events_per_individual_sport int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF p_event_id IS NULL THEN RAISE EXCEPTION 'event_id obrigatório' USING ERRCODE='22023'; END IF;

  INSERT INTO public.event_participation_rules(
    event_id, max_collective_teams_per_athlete, max_individual_sports_per_athlete, max_events_per_individual_sport,
    created_by, updated_by
  ) VALUES (
    p_event_id, p_max_collective_teams_per_athlete, p_max_individual_sports_per_athlete, p_max_events_per_individual_sport,
    auth.uid(), auth.uid()
  )
  ON CONFLICT (event_id) DO UPDATE SET
    max_collective_teams_per_athlete = EXCLUDED.max_collective_teams_per_athlete,
    max_individual_sports_per_athlete = EXCLUDED.max_individual_sports_per_athlete,
    max_events_per_individual_sport = EXCLUDED.max_events_per_individual_sport,
    updated_by = auth.uid();
END; $$;
