
-- 1. Create table
CREATE TABLE IF NOT EXISTS public.sport_event_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id),
  sport_event_id uuid NOT NULL UNIQUE REFERENCES public.sport_events(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  rules_version int NOT NULL DEFAULT 1,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS idx_sport_event_rules_event_id ON public.sport_event_rules(event_id);
CREATE INDEX IF NOT EXISTS idx_sport_event_rules_rules_gin ON public.sport_event_rules USING gin(rules);

-- 2. Enable RLS
ALTER TABLE public.sport_event_rules ENABLE ROW LEVEL SECURITY;

-- 3. Audit trigger
CREATE OR REPLACE FUNCTION public.set_sport_event_rules_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.updated_by := COALESCE(NEW.updated_by, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sport_event_rules_audit
  BEFORE INSERT OR UPDATE ON public.sport_event_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_sport_event_rules_audit();

-- 4. RLS Policies
CREATE POLICY "Admin/coord/secretaria can read sport_event_rules"
  ON public.sport_event_rules FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica') OR
    public.has_role(auth.uid(), 'secretaria')
  );

CREATE POLICY "Admin/coord can insert sport_event_rules"
  ON public.sport_event_rules FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  );

CREATE POLICY "Admin/coord can update sport_event_rules"
  ON public.sport_event_rules FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  );

CREATE POLICY "Admin/coord can delete sport_event_rules"
  ON public.sport_event_rules FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  );

-- 5. RPC: get rules (with defaults)
CREATE OR REPLACE FUNCTION public.rpc_get_sport_event_rules(
  p_sport_event_id uuid,
  p_event_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules jsonb;
  v_is_collective boolean;
BEGIN
  SELECT rules INTO v_rules
  FROM public.sport_event_rules
  WHERE sport_event_id = p_sport_event_id
    AND is_active = true;

  IF FOUND THEN
    RETURN jsonb_build_object('source', 'db', 'rules', v_rules);
  END IF;

  -- Build default based on sport type
  SELECT s.is_collective INTO v_is_collective
  FROM public.sport_events se
  JOIN public.sports s ON s.id = se.sport_id
  WHERE se.id = p_sport_event_id;

  IF v_is_collective IS TRUE THEN
    RETURN jsonb_build_object('source', 'default', 'rules', jsonb_build_object(
      'family', 'score',
      'format', 'group_stage',
      'participant_mode', 'team',
      'scoring', jsonb_build_object('score_type', 'goals'),
      'scheduling', '{}'::jsonb,
      'tie_breakers', '[]'::jsonb,
      'enrollment_limits', '{}'::jsonb,
      'notes', null,
      'preset_key', null
    ));
  ELSE
    RETURN jsonb_build_object('source', 'default', 'rules', jsonb_build_object(
      'family', 'time',
      'format', 'heats',
      'participant_mode', 'individual',
      'scoring', jsonb_build_object('score_type', 'time_ms'),
      'scheduling', jsonb_build_object('lanes_min', 6, 'lanes_max', 10),
      'tie_breakers', '[]'::jsonb,
      'enrollment_limits', '{}'::jsonb,
      'notes', null,
      'preset_key', null
    ));
  END IF;
END;
$$;

-- 6. RPC: upsert rules
CREATE OR REPLACE FUNCTION public.rpc_upsert_sport_event_rules(
  p_sport_event_id uuid,
  p_event_id uuid,
  p_rules jsonb,
  p_is_active boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family text;
  v_format text;
  v_valid_families text[] := ARRAY['score','sets','time','mark','combat','ranking'];
  v_valid_formats text[] := ARRAY['knockout','group_stage','round_robin','heats','heats_final','combat_bracket','ranking'];
BEGIN
  -- Validate authorization
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenacao_tecnica')) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  v_family := p_rules->>'family';
  v_format := p_rules->>'format';

  IF v_family IS NULL OR NOT (v_family = ANY(v_valid_families)) THEN
    RAISE EXCEPTION 'Família inválida: %. Permitidas: %', v_family, array_to_string(v_valid_families, ', ')
      USING ERRCODE = 'P0001';
  END IF;

  IF v_format IS NULL OR NOT (v_format = ANY(v_valid_formats)) THEN
    RAISE EXCEPTION 'Formato inválido: %. Permitidos: %', v_format, array_to_string(v_valid_formats, ', ')
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.sport_event_rules (sport_event_id, event_id, rules, is_active, created_by, updated_by)
  VALUES (p_sport_event_id, p_event_id, p_rules, p_is_active, auth.uid(), auth.uid())
  ON CONFLICT (sport_event_id) DO UPDATE SET
    event_id = p_event_id,
    rules = p_rules,
    is_active = p_is_active,
    updated_at = now(),
    updated_by = auth.uid();
END;
$$;
