-- ============================================================================
-- FIX: RPCs e Policies do Módulo de Alimentação
-- ============================================================================
-- Corrige bugs críticos, altos e médios identificados na auditoria:
--
-- CRITICAL 1: get_present_participant_counts_by_profile() referencia
--             p.category_slug que não existe — corrigido para p.participant_type
--
-- CRITICAL 2: get_present_participant_counts_by_institution() referencia
--             p.institution_id que não existe — corrigido com JOIN delegations
--
-- HIGH 1:     record_meal_consumption() é SECURITY DEFINER sem role check —
--             adicionada verificação de role (admin, secretaria,
--             coordenacao_tecnica, alimentacao)
--
-- HIGH 2:     record_meal_incident() é SECURITY DEFINER acessível a PUBLIC —
--             adicionada verificação de role + REVOKE/GRANT
--
-- MEDIUM 1:   get_alimentacao_duplicates() não filtra status = 'active' —
--             adicionado AND mc.status = 'active'
--
-- MEDIUM 2:   meal_incidents RLS policies usam 'coordenacao' (errado) —
--             corrigido para 'coordenacao_tecnica'
--
-- MEDIUM 3:   check_user_stage_access() retorna FALSE para NULL target_stage_id —
--             corrigido para retornar TRUE (janelas legadas sem etapa)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- CRITICAL 1: get_present_participant_counts_by_profile()
-- Substituir p.category_slug (inexistente) por p.participant_type
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_present_participant_counts_by_profile(
  p_event_id UUID,
  p_service_date DATE,
  p_stage_id UUID DEFAULT NULL
)
RETURNS TABLE (type TEXT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.participant_type AS type,
    COUNT(*)::BIGINT AS count
  FROM public.participants p
  JOIN public.participant_event_stages pes ON p.id = pes.participant_id
  WHERE p.event_id = p_event_id
    AND p.is_active = true
    AND p.needs_meals = true
    AND p.credentialed_at IS NOT NULL
    AND p.credentialed_at::date <= p_service_date
    AND (p.left_event_at IS NULL OR p.left_event_at::date > p_service_date)
    AND (p_stage_id IS NULL OR pes.event_stage_id = p_stage_id)
  GROUP BY p.participant_type;
END;
$$;

-- ---------------------------------------------------------------------------
-- CRITICAL 2: get_present_participant_counts_by_institution()
-- A tabela participants NÃO tem institution_id.
-- Precisa de JOIN com delegations para alcançar institution_id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_present_participant_counts_by_institution(
  p_event_id UUID,
  p_service_date DATE,
  p_stage_id UUID DEFAULT NULL
)
RETURNS TABLE (id UUID, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.institution_id AS id,
    COUNT(*)::BIGINT AS count
  FROM public.participants p
  JOIN public.delegations d ON d.id = p.delegation_id
  JOIN public.participant_event_stages pes ON p.id = pes.participant_id
  WHERE p.event_id = p_event_id
    AND p.is_active = true
    AND p.needs_meals = true
    AND p.credentialed_at IS NOT NULL
    AND p.credentialed_at::date <= p_service_date
    AND (p.left_event_at IS NULL OR p.left_event_at::date > p_service_date)
    AND (p_stage_id IS NULL OR pes.event_stage_id = p_stage_id)
    AND d.institution_id IS NOT NULL
  GROUP BY d.institution_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- HIGH 1: record_meal_consumption() — adicionar role check
-- A função é SECURITY DEFINER mas qualquer authenticated podia chamar.
-- Agora valida que o caller tem role apropriada antes de prosseguir.
-- (Assinatura e corpo preservados do migration 20260513000006)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_meal_consumption(
  p_participant_id uuid,
  p_meal_window_id uuid,
  p_method         text    DEFAULT 'qr',
  p_registered_by  uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller         uuid    := auth.uid();
  v_window         RECORD;
  v_now_local      timestamptz := (now() AT TIME ZONE 'America/Boa_Vista');
  v_today          date        := v_now_local::date;
  v_time_now       time        := v_now_local::time;
  v_has_rules      boolean;
  v_eligible       boolean;
  v_consumption_id uuid;
BEGIN
  -- ========= ROLE CHECK (HIGH fix) =========
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.has_role(v_caller, 'admin')
    OR public.has_role(v_caller, 'secretaria')
    OR public.has_role(v_caller, 'coordenacao_tecnica')
    OR public.has_role(v_caller, 'alimentacao')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para registrar consumo de refeição' USING ERRCODE = '42501';
  END IF;
  -- ==========================================

  SELECT * INTO v_window
  FROM meal_windows
  WHERE id = p_meal_window_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'WINDOW_NOT_FOUND');
  END IF;

  IF v_window.service_date != v_today THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'WINDOW_WRONG_DATE',
      'window_date', v_window.service_date::text, 'today', v_today::text);
  END IF;

  IF v_time_now < (v_window.start_time::time - interval '15 minutes')
     OR v_time_now > (v_window.end_time::time + interval '15 minutes') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'WINDOW_CLOSED',
      'start', v_window.start_time, 'end', v_window.end_time);
  END IF;

  -- Bloqueia registro se a janela pertence a uma etapa e o participante
  -- não está inscrito nessa etapa.
  IF v_window.event_stage_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM participant_event_stages
      WHERE participant_id = p_participant_id
        AND event_stage_id = v_window.event_stage_id
        AND status = 'active'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'NOT_ENROLLED_IN_STAGE');
    END IF;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM meal_window_eligibility WHERE meal_window_id = p_meal_window_id
  ) INTO v_has_rules;

  IF v_has_rules THEN
    SELECT EXISTS (
      SELECT 1 FROM meal_window_eligibility mwe
      WHERE mwe.meal_window_id = p_meal_window_id
        AND (
          (mwe.eligibility_type = 'participant_type'
           AND mwe.participant_type_value = (
             SELECT participant_type::text FROM participants WHERE id = p_participant_id
           ))
          OR
          (mwe.eligibility_type = 'delegation'
           AND mwe.reference_id = (
             SELECT delegation_id FROM participants WHERE id = p_participant_id
           ))
          OR
          (mwe.eligibility_type = 'institution'
           AND mwe.reference_id = (
             SELECT d.institution_id
             FROM participants p2
             JOIN delegations d ON d.id = p2.delegation_id
             WHERE p2.id = p_participant_id
           ))
        )
    ) INTO v_eligible;

    IF NOT v_eligible THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'NOT_ELIGIBLE');
    END IF;
  END IF;

  INSERT INTO meal_consumptions (participant_id, meal_window_id, method, registered_by, status)
  VALUES (p_participant_id, p_meal_window_id, p_method, p_registered_by, 'active')
  ON CONFLICT (meal_window_id, participant_id) WHERE (status = 'active')
  DO NOTHING
  RETURNING id INTO v_consumption_id;

  IF v_consumption_id IS NULL THEN
    SELECT id INTO v_consumption_id
    FROM meal_consumptions
    WHERE participant_id = p_participant_id
      AND meal_window_id = p_meal_window_id
      AND status = 'active';
    RETURN jsonb_build_object('ok', false, 'reason', 'ALREADY_REGISTERED', 'id', v_consumption_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_consumption_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_meal_consumption(uuid, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_meal_consumption(uuid, uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_meal_consumption(uuid, uuid, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- HIGH 2: record_meal_incident() — adicionar role check + REVOKE/GRANT
-- A função original era SECURITY DEFINER sem nenhuma verificação de role
-- e acessível a PUBLIC.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_meal_incident(
  p_meal_window_id UUID,
  p_incident_type public.meal_incident_type,
  p_participant_id UUID DEFAULT NULL,
  p_is_offline BOOLEAN DEFAULT FALSE,
  p_incident_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_device_info JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_incident_id UUID;
BEGIN
  -- ========= ROLE CHECK (HIGH fix) =========
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.has_role(v_caller, 'admin')
    OR public.has_role(v_caller, 'secretaria')
    OR public.has_role(v_caller, 'coordenacao_tecnica')
    OR public.has_role(v_caller, 'alimentacao')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para registrar incidente de refeição' USING ERRCODE = '42501';
  END IF;
  -- ==========================================

  INSERT INTO public.meal_incidents (
    meal_window_id,
    incident_type,
    participant_id,
    is_offline,
    incident_at,
    registered_by,
    device_info
  ) VALUES (
    p_meal_window_id,
    p_incident_type,
    p_participant_id,
    p_is_offline,
    COALESCE(p_incident_at, now()),
    v_caller,
    p_device_info
  ) RETURNING id INTO v_incident_id;

  RETURN v_incident_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.record_meal_incident(UUID, public.meal_incident_type, UUID, BOOLEAN, TIMESTAMP WITH TIME ZONE, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_meal_incident(UUID, public.meal_incident_type, UUID, BOOLEAN, TIMESTAMP WITH TIME ZONE, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- MEDIUM 1: get_alimentacao_duplicates() — adicionar filtro status = 'active'
-- Sem o filtro, consumos estornados (deletados logicamente) ainda apareciam
-- como duplicidades.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_alimentacao_duplicates(
  p_event_id uuid DEFAULT NULL,
  p_event_stage_id uuid DEFAULT NULL,
  p_service_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.has_role(v_actor, 'admin')
    OR public.has_role(v_actor, 'secretaria')
    OR public.has_role(v_actor, 'coordenacao_tecnica')
    OR public.has_role(v_actor, 'alimentacao')
  ) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    SELECT
      mc.id AS consumption_id,
      mc.participant_id,
      mc.meal_window_id,
      mc.consumed_at,
      mw.meal_type_id,
      mw.service_date,
      mw.event_id,
      mw.event_stage_id,
      mt.name AS meal_type_name,
      p.full_name AS participant_name
    FROM public.meal_consumptions mc
    JOIN public.meal_windows mw ON mw.id = mc.meal_window_id
    JOIN public.meal_types  mt ON mt.id = mw.meal_type_id
    JOIN public.participants p ON p.id  = mc.participant_id
    WHERE mc.status = 'active'
      AND (p_event_id       IS NULL OR mw.event_id        = p_event_id)
      AND (p_event_stage_id IS NULL OR mw.event_stage_id  = p_event_stage_id)
      AND (p_service_date   IS NULL OR mw.service_date    = p_service_date)
  ),
  grouped AS (
    SELECT
      participant_id,
      participant_name,
      service_date,
      meal_type_id,
      meal_type_name,
      event_id,
      event_stage_id,
      count(*) AS occurrences,
      jsonb_agg(jsonb_build_object(
        'consumption_id', consumption_id,
        'meal_window_id', meal_window_id,
        'consumed_at',    consumed_at
      ) ORDER BY consumed_at) AS records
    FROM base
    GROUP BY participant_id, participant_name, service_date,
             meal_type_id, meal_type_name, event_id, event_stage_id
    HAVING count(*) > 1
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(grouped) ORDER BY service_date DESC, participant_name), '[]'::jsonb)
    INTO v_result
    FROM grouped;

  RETURN jsonb_build_object(
    'duplicates', v_result,
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_alimentacao_duplicates(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_alimentacao_duplicates(uuid, uuid, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- MEDIUM 2: meal_incidents RLS policies — 'coordenacao' → 'coordenacao_tecnica'
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin/Coord/Secretaria can view all incidents" ON public.meal_incidents;
CREATE POLICY "Admin/Coord/Secretaria can view all incidents"
  ON public.meal_incidents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role::text IN ('admin', 'coordenacao_tecnica', 'secretaria')
    )
  );

DROP POLICY IF EXISTS "Food operators can insert incidents" ON public.meal_incidents;
CREATE POLICY "Food operators can insert incidents"
  ON public.meal_incidents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role::text IN ('admin', 'coordenacao_tecnica', 'secretaria', 'alimentacao')
    )
  );

-- ---------------------------------------------------------------------------
-- MEDIUM 3: check_user_stage_access() — NULL target_stage_id → TRUE
-- Janelas legadas sem etapa (target_stage_id IS NULL) devem ser acessíveis.
-- Retornar FALSE bloqueava operações em janelas pré-etapa.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_stage_access(target_stage_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Janelas legadas sem etapa: acesso livre.
    IF target_stage_id IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Perfis com acesso amplo bypassam o filtro de etapa.
    IF public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
       OR public.has_role(auth.uid(), 'secretaria'::public.app_role)
       OR public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role)
    THEN
        RETURN TRUE;
    END IF;

    -- Demais perfis: precisam de atribuição explícita à etapa.
    RETURN EXISTS (
        SELECT 1
        FROM public.user_stage_assignments
        WHERE user_id = auth.uid()
          AND event_stage_id = target_stage_id
    );
END;
$$;

COMMENT ON FUNCTION public.check_user_stage_access(UUID) IS
  'Retorna TRUE se o usuário tem acesso à etapa. NULL target_stage_id → TRUE (janelas legadas sem etapa). admin/super_admin/secretaria/coordenacao_tecnica bypassam; demais perfis precisam de entrada em user_stage_assignments.';

-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;
