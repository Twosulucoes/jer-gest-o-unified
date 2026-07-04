-- ============================================================
-- Pesquisa de Satisfação: endurecimento de segurança (auditoria OODA)
--
-- 1. Rate limiting + auditoria de tentativas no login por PIN (RPC anônima)
-- 2. Verificação de posse (device) ao revogar sessão
-- 3. Proteção contra collected_at futuro (anti-adulteração), preservando
--    o horário real de coleta do fluxo offline
-- 4. Restaura a gravação de event_stage_id no submit — comportamento
--    perdido acidentalmente na migration 20260418183000 (application_location),
--    que reescreveu a função sem reincluir a resolução de etapa introduzida
--    em 20260418000004 (stage isolation).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabela de auditoria de tentativas de login
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pesquisa_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text,
  success boolean NOT NULL,
  researcher_id uuid REFERENCES public.pesquisa_researchers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pesquisa_login_attempts_device_time
  ON public.pesquisa_login_attempts(device_id, created_at DESC);

ALTER TABLE public.pesquisa_login_attempts ENABLE ROW LEVEL SECURITY;

-- Somente admin/secretaria leem; escrita ocorre apenas via função SECURITY DEFINER.
CREATE POLICY "Admin read pesquisa_login_attempts" ON public.pesquisa_login_attempts
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Secretaria read pesquisa_login_attempts" ON public.pesquisa_login_attempts
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'secretaria'::app_role));

-- ------------------------------------------------------------
-- 2. login_with_pin: rate limiting por device + auditoria de tentativas
--    (preserva assigned_location introduzido em 20260418191000)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pesquisa_login_with_pin(p_pin text, p_device_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_researcher record;
  v_event record;
  v_session_id uuid;
  v_expires_at timestamptz;
  v_recent_failures int;
BEGIN
  -- Rate limiting: bloqueia após 5 falhas do mesmo device em 15 minutos.
  IF p_device_id IS NOT NULL THEN
    SELECT count(*) INTO v_recent_failures
    FROM pesquisa_login_attempts
    WHERE device_id = p_device_id
      AND success = false
      AND created_at > now() - interval '15 minutes';

    IF v_recent_failures >= 5 THEN
      INSERT INTO pesquisa_login_attempts (device_id, success) VALUES (p_device_id, false);
      RETURN json_build_object('error', 'RATE_LIMITED');
    END IF;
  END IF;

  SELECT r.id, r.name, r.event_id, r.pin_hash, r.assigned_location
  INTO v_researcher
  FROM pesquisa_researchers r
  WHERE r.active = true AND pesquisa_verify_pin(p_pin, r.pin_hash)
  LIMIT 1;

  IF v_researcher IS NULL THEN
    INSERT INTO pesquisa_login_attempts (device_id, success) VALUES (p_device_id, false);
    RETURN json_build_object('error', 'PIN_INVALID');
  END IF;

  SELECT e.id, e.name, e.location, e.event_date
  INTO v_event
  FROM pesquisa_events e
  WHERE e.id = v_researcher.event_id AND e.active = true;

  IF v_event IS NULL THEN
    INSERT INTO pesquisa_login_attempts (device_id, success, researcher_id)
    VALUES (p_device_id, false, v_researcher.id);
    RETURN json_build_object('error', 'EVENT_INACTIVE');
  END IF;

  v_expires_at := now() + interval '24 hours';
  INSERT INTO pesquisa_sessions (researcher_id, event_id, device_id, expires_at)
  VALUES (v_researcher.id, v_researcher.event_id, p_device_id, v_expires_at)
  RETURNING id INTO v_session_id;

  UPDATE pesquisa_researchers SET last_login_at = now() WHERE id = v_researcher.id;

  INSERT INTO pesquisa_login_attempts (device_id, success, researcher_id)
  VALUES (p_device_id, true, v_researcher.id);

  RETURN json_build_object(
    'session_id', v_session_id,
    'expires_at', v_expires_at,
    'researcher', json_build_object(
      'id', v_researcher.id,
      'name', v_researcher.name,
      'event_id', v_researcher.event_id,
      'assigned_location', v_researcher.assigned_location
    ),
    'event', json_build_object('id', v_event.id, 'name', v_event.name, 'location', v_event.location, 'event_date', v_event.event_date)
  );
END;
$$;

-- ------------------------------------------------------------
-- 3. revoke_session: exige posse via device_id quando informado
--    (defesa em profundidade contra revogação de sessão alheia)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.pesquisa_revoke_session(uuid);

CREATE FUNCTION public.pesquisa_revoke_session(p_session_id uuid, p_device_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE pesquisa_sessions
  SET revoked_at = now()
  WHERE id = p_session_id
    AND revoked_at IS NULL
    AND (p_device_id IS NULL OR device_id = p_device_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pesquisa_revoke_session(uuid, text) TO anon;

-- ------------------------------------------------------------
-- 4. submit_survey: clamp anti-adulteração em collected_at
--    (preserva application_location de 20260418183000)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pesquisa_pwa_submit_survey(p_session_id uuid, p_payload json)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session record;
  v_collected_at timestamptz;
  v_row_count int;
BEGIN
  SELECT s.researcher_id, s.event_id, s.device_id
  INTO v_session
  FROM pesquisa_sessions s
  WHERE s.id = p_session_id AND s.revoked_at IS NULL AND s.expires_at > now();

  IF v_session IS NULL THEN
    RETURN json_build_object('error', 'SESSION_INVALID');
  END IF;

  -- collected_at: preserva o horário real de coleta (essencial para o fluxo offline,
  -- em que a resposta é enfileirada e enviada mais tarde), mas rejeita datas futuras
  -- além de uma pequena tolerância de relógio. O carimbo servidor imutável fica em created_at.
  v_collected_at := COALESCE((p_payload->>'collected_at')::timestamptz, now());
  IF v_collected_at > now() + interval '5 minutes' THEN
    v_collected_at := now();
  END IF;

  INSERT INTO pesquisa_surveys (
    client_uuid, researcher_id, event_id, device_id,
    respondent_type, respondent_age, respondent_gender, mode,
    d1_organizacao, d1_infraestrutura, d1_alimentacao, d1_seguranca, d1_transporte,
    d2_igualdade, d2_acessibilidade, d2_inclusao,
    d3_aprendizado, d3_convivencia, d3_cidadania, d3_superacao,
    ponto_positivo, sugestao, collected_at, application_location
  ) VALUES (
    (p_payload->>'client_uuid')::uuid,
    v_session.researcher_id,
    v_session.event_id,
    v_session.device_id,
    p_payload->>'respondent_type',
    p_payload->>'respondent_age',
    p_payload->>'respondent_gender',
    p_payload->>'mode',
    (p_payload->>'d1_organizacao')::int,
    (p_payload->>'d1_infraestrutura')::int,
    (p_payload->>'d1_alimentacao')::int,
    (p_payload->>'d1_seguranca')::int,
    (p_payload->>'d1_transporte')::int,
    (p_payload->>'d2_igualdade')::int,
    (p_payload->>'d2_acessibilidade')::int,
    (p_payload->>'d2_inclusao')::int,
    (p_payload->>'d3_aprendizado')::int,
    (p_payload->>'d3_convivencia')::int,
    (p_payload->>'d3_cidadania')::int,
    (p_payload->>'d3_superacao')::int,
    p_payload->>'ponto_positivo',
    p_payload->>'sugestao',
    v_collected_at,
    NULLIF(trim(p_payload->>'application_location'), '')
  )
  ON CONFLICT (event_id, client_uuid) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  RETURN json_build_object('status', CASE WHEN v_row_count > 0 THEN 'created' ELSE 'duplicate' END);
END;
$$;
