
-- Enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

------------------------------------------------------------
-- TABLES
------------------------------------------------------------
CREATE TABLE public.pesquisa_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  event_date date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE public.pesquisa_researchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_id uuid NOT NULL REFERENCES public.pesquisa_events(id) ON DELETE RESTRICT,
  pin_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE public.pesquisa_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  researcher_id uuid NOT NULL REFERENCES public.pesquisa_researchers(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.pesquisa_events(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE INDEX idx_pesquisa_sessions_researcher ON public.pesquisa_sessions(researcher_id);
CREATE INDEX idx_pesquisa_sessions_device ON public.pesquisa_sessions(device_id);
CREATE INDEX idx_pesquisa_sessions_expires ON public.pesquisa_sessions(expires_at);

CREATE TABLE public.pesquisa_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_uuid uuid NOT NULL,
  researcher_id uuid NOT NULL REFERENCES public.pesquisa_researchers(id) ON DELETE RESTRICT,
  event_id uuid NOT NULL REFERENCES public.pesquisa_events(id) ON DELETE RESTRICT,
  respondent_type text NOT NULL CHECK (respondent_type IN ('atleta','familiar','professor','tecnico','outro')),
  respondent_age text NOT NULL CHECK (respondent_age IN ('ate_12','13_17','18_30','acima_30')),
  respondent_gender text NOT NULL CHECK (respondent_gender IN ('masculino','feminino','nao_informado')),
  mode text NOT NULL CHECK (mode IN ('autopreenchimento','entrevista')),
  d1_organizacao int NOT NULL CHECK (d1_organizacao BETWEEN 1 AND 5),
  d1_infraestrutura int NOT NULL CHECK (d1_infraestrutura BETWEEN 1 AND 5),
  d1_alimentacao int NOT NULL CHECK (d1_alimentacao BETWEEN 1 AND 5),
  d1_seguranca int NOT NULL CHECK (d1_seguranca BETWEEN 1 AND 5),
  d1_transporte int NOT NULL CHECK (d1_transporte BETWEEN 1 AND 5),
  d2_igualdade int NOT NULL CHECK (d2_igualdade BETWEEN 1 AND 5),
  d2_acessibilidade int NOT NULL CHECK (d2_acessibilidade BETWEEN 1 AND 5),
  d2_inclusao int NOT NULL CHECK (d2_inclusao BETWEEN 1 AND 5),
  d3_aprendizado int NOT NULL CHECK (d3_aprendizado BETWEEN 1 AND 5),
  d3_convivencia int NOT NULL CHECK (d3_convivencia BETWEEN 1 AND 5),
  d3_cidadania int NOT NULL CHECK (d3_cidadania BETWEEN 1 AND 5),
  d3_superacao int NOT NULL CHECK (d3_superacao BETWEEN 1 AND 5),
  ponto_positivo text,
  sugestao text,
  collected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  device_id text,
  UNIQUE(event_id, client_uuid)
);

CREATE INDEX idx_pesquisa_surveys_event_date ON public.pesquisa_surveys(event_id, collected_at DESC);
CREATE INDEX idx_pesquisa_surveys_researcher_date ON public.pesquisa_surveys(researcher_id, collected_at DESC);
CREATE INDEX idx_pesquisa_surveys_filters ON public.pesquisa_surveys(event_id, respondent_type, respondent_age, respondent_gender, mode);

------------------------------------------------------------
-- RLS
------------------------------------------------------------
ALTER TABLE public.pesquisa_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesquisa_researchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesquisa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesquisa_surveys ENABLE ROW LEVEL SECURITY;

-- pesquisa_events policies
CREATE POLICY "Admin full access pesquisa_events" ON public.pesquisa_events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Secretaria manage pesquisa_events" ON public.pesquisa_events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role)) WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

-- pesquisa_researchers policies
CREATE POLICY "Admin full access pesquisa_researchers" ON public.pesquisa_researchers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Secretaria manage pesquisa_researchers" ON public.pesquisa_researchers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role)) WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

-- pesquisa_sessions policies
CREATE POLICY "Admin full access pesquisa_sessions" ON public.pesquisa_sessions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Secretaria read pesquisa_sessions" ON public.pesquisa_sessions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role));

-- pesquisa_surveys policies (read-only for admin/secretaria; inserts only via RPC)
CREATE POLICY "Admin read pesquisa_surveys" ON public.pesquisa_surveys FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Secretaria read pesquisa_surveys" ON public.pesquisa_surveys FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role));

------------------------------------------------------------
-- TRIGGERS
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pesquisa_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_pesquisa_events_updated BEFORE UPDATE ON public.pesquisa_events
  FOR EACH ROW EXECUTE FUNCTION public.pesquisa_set_updated_at();
CREATE TRIGGER trg_pesquisa_researchers_updated BEFORE UPDATE ON public.pesquisa_researchers
  FOR EACH ROW EXECUTE FUNCTION public.pesquisa_set_updated_at();

------------------------------------------------------------
-- PIN HELPERS
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pesquisa_hash_pin(pin text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT extensions.crypt(pin, extensions.gen_salt('bf'))
$$;

CREATE OR REPLACE FUNCTION public.pesquisa_verify_pin(pin text, pin_hash text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT extensions.crypt(pin, pin_hash) = pin_hash
$$;

------------------------------------------------------------
-- RPC: LOGIN
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pesquisa_login_with_pin(p_pin text, p_device_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_researcher record;
  v_event record;
  v_session_id uuid;
  v_expires_at timestamptz;
BEGIN
  SELECT r.id, r.name, r.event_id, r.pin_hash
  INTO v_researcher
  FROM pesquisa_researchers r
  WHERE r.active = true AND pesquisa_verify_pin(p_pin, r.pin_hash)
  LIMIT 1;

  IF v_researcher IS NULL THEN
    RETURN json_build_object('error', 'PIN_INVALID');
  END IF;

  SELECT e.id, e.name, e.location, e.event_date
  INTO v_event
  FROM pesquisa_events e
  WHERE e.id = v_researcher.event_id AND e.active = true;

  IF v_event IS NULL THEN
    RETURN json_build_object('error', 'EVENT_INACTIVE');
  END IF;

  v_expires_at := now() + interval '24 hours';
  INSERT INTO pesquisa_sessions (researcher_id, event_id, device_id, expires_at)
  VALUES (v_researcher.id, v_researcher.event_id, p_device_id, v_expires_at)
  RETURNING id INTO v_session_id;

  UPDATE pesquisa_researchers SET last_login_at = now() WHERE id = v_researcher.id;

  RETURN json_build_object(
    'session_id', v_session_id,
    'expires_at', v_expires_at,
    'researcher', json_build_object('id', v_researcher.id, 'name', v_researcher.name, 'event_id', v_researcher.event_id),
    'event', json_build_object('id', v_event.id, 'name', v_event.name, 'location', v_event.location, 'event_date', v_event.event_date)
  );
END;
$$;

------------------------------------------------------------
-- RPC: TOUCH / REVOKE SESSION
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pesquisa_touch_session(p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE pesquisa_sessions SET last_seen_at = now()
  WHERE id = p_session_id AND revoked_at IS NULL AND expires_at > now();
END;
$$;

CREATE OR REPLACE FUNCTION public.pesquisa_revoke_session(p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE pesquisa_sessions SET revoked_at = now() WHERE id = p_session_id;
END;
$$;

------------------------------------------------------------
-- RPC: PWA HOME
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pesquisa_pwa_get_home(p_session_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session record;
  v_researcher_name text;
  v_event record;
  v_today_count int;
  v_recent json;
BEGIN
  SELECT s.researcher_id, s.event_id, s.device_id
  INTO v_session
  FROM pesquisa_sessions s
  WHERE s.id = p_session_id AND s.revoked_at IS NULL AND s.expires_at > now();

  IF v_session IS NULL THEN
    RETURN json_build_object('error', 'SESSION_INVALID');
  END IF;

  UPDATE pesquisa_sessions SET last_seen_at = now() WHERE id = p_session_id;

  SELECT r.name INTO v_researcher_name FROM pesquisa_researchers r WHERE r.id = v_session.researcher_id;
  SELECT e.id, e.name, e.location, e.event_date INTO v_event FROM pesquisa_events e WHERE e.id = v_session.event_id;

  SELECT count(*) INTO v_today_count
  FROM pesquisa_surveys
  WHERE researcher_id = v_session.researcher_id AND collected_at::date = current_date;

  SELECT json_agg(t) INTO v_recent FROM (
    SELECT respondent_type, collected_at
    FROM pesquisa_surveys
    WHERE researcher_id = v_session.researcher_id
    ORDER BY collected_at DESC LIMIT 10
  ) t;

  RETURN json_build_object(
    'researcher_name', v_researcher_name,
    'event', json_build_object('id', v_event.id, 'name', v_event.name, 'location', v_event.location, 'event_date', v_event.event_date),
    'today_count', v_today_count,
    'recent', COALESCE(v_recent, '[]'::json)
  );
END;
$$;

------------------------------------------------------------
-- RPC: PWA SUBMIT SURVEY
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pesquisa_pwa_submit_survey(p_session_id uuid, p_payload json)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session record;
  v_row_count int;
BEGIN
  SELECT s.researcher_id, s.event_id, s.device_id
  INTO v_session
  FROM pesquisa_sessions s
  WHERE s.id = p_session_id AND s.revoked_at IS NULL AND s.expires_at > now();

  IF v_session IS NULL THEN
    RETURN json_build_object('error', 'SESSION_INVALID');
  END IF;

  INSERT INTO pesquisa_surveys (
    client_uuid, researcher_id, event_id, device_id,
    respondent_type, respondent_age, respondent_gender, mode,
    d1_organizacao, d1_infraestrutura, d1_alimentacao, d1_seguranca, d1_transporte,
    d2_igualdade, d2_acessibilidade, d2_inclusao,
    d3_aprendizado, d3_convivencia, d3_cidadania, d3_superacao,
    ponto_positivo, sugestao, collected_at
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
    COALESCE((p_payload->>'collected_at')::timestamptz, now())
  )
  ON CONFLICT (event_id, client_uuid) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  RETURN json_build_object('status', CASE WHEN v_row_count > 0 THEN 'created' ELSE 'duplicate' END);
END;
$$;

------------------------------------------------------------
-- RPC: PWA LIST RECENT
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pesquisa_pwa_list_recent(p_session_id uuid, p_limit int DEFAULT 20)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_researcher_id uuid;
  v_result json;
BEGIN
  SELECT s.researcher_id INTO v_researcher_id
  FROM pesquisa_sessions s
  WHERE s.id = p_session_id AND s.revoked_at IS NULL AND s.expires_at > now();

  IF v_researcher_id IS NULL THEN
    RETURN json_build_object('error', 'SESSION_INVALID');
  END IF;

  SELECT json_agg(t) INTO v_result FROM (
    SELECT respondent_type, respondent_age, collected_at
    FROM pesquisa_surveys
    WHERE researcher_id = v_researcher_id
    ORDER BY collected_at DESC
    LIMIT LEAST(p_limit, 50)
  ) t;

  RETURN json_build_object('items', COALESCE(v_result, '[]'::json));
END;
$$;

------------------------------------------------------------
-- GRANTS for anon (PWA access without auth)
------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.pesquisa_login_with_pin(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.pesquisa_touch_session(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.pesquisa_revoke_session(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.pesquisa_pwa_get_home(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.pesquisa_pwa_submit_survey(uuid, json) TO anon;
GRANT EXECUTE ON FUNCTION public.pesquisa_pwa_list_recent(uuid, int) TO anon;

------------------------------------------------------------
-- SEEDS
------------------------------------------------------------
DO $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.pesquisa_events (name, location, event_date, active)
  VALUES ('53º JER''s 2026 — Fase Final', 'Manaus - AM', '2026-07-15', true)
  RETURNING id INTO v_event_id;

  INSERT INTO public.pesquisa_researchers (name, event_id, pin_hash, active)
  VALUES ('Pesquisador Demo', v_event_id, extensions.crypt('1234', extensions.gen_salt('bf')), true);
END;
$$;

