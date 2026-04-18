-- Tabela de erros capturados
CREATE TABLE public.monitoring_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('frontend', 'edge_function', 'postgres', 'business')),
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  message text NOT NULL,
  stack text,
  url text,
  user_id uuid,
  user_email text,
  context jsonb DEFAULT '{}'::jsonb,
  user_agent text,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_monitoring_errors_created_at ON public.monitoring_errors(created_at DESC);
CREATE INDEX idx_monitoring_errors_source ON public.monitoring_errors(source);
CREATE INDEX idx_monitoring_errors_severity ON public.monitoring_errors(severity);
CREATE INDEX idx_monitoring_errors_acknowledged ON public.monitoring_errors(acknowledged) WHERE acknowledged = false;

ALTER TABLE public.monitoring_errors ENABLE ROW LEVEL SECURITY;

-- Super admin tem acesso total
CREATE POLICY "Super admin manages errors"
  ON public.monitoring_errors
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Usuários autenticados podem reportar erros do frontend (apenas inserir)
CREATE POLICY "Authenticated users can report frontend errors"
  ON public.monitoring_errors
  FOR INSERT
  TO authenticated
  WITH CHECK (source = 'frontend' AND user_id = auth.uid());

-- Tabela de métricas agregadas
CREATE TABLE public.monitoring_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_at timestamptz NOT NULL,
  bucket_size text NOT NULL DEFAULT '1min' CHECK (bucket_size IN ('1min', '5min', '1hour')),
  requests_count integer NOT NULL DEFAULT 0,
  active_users integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0,
  new_inscriptions integer NOT NULL DEFAULT 0,
  new_matches integer NOT NULL DEFAULT 0,
  new_results integer NOT NULL DEFAULT 0,
  edge_function_calls integer NOT NULL DEFAULT 0,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_monitoring_metrics_bucket ON public.monitoring_metrics(bucket_at, bucket_size);
CREATE INDEX idx_monitoring_metrics_bucket_at ON public.monitoring_metrics(bucket_at DESC);

ALTER TABLE public.monitoring_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin reads metrics"
  ON public.monitoring_metrics
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Feed de eventos de negócio
CREATE TABLE public.monitoring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('inscription', 'match_created', 'result_published', 'login', 'high_load')),
  event_id uuid,
  entity_id uuid,
  entity_label text,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_monitoring_events_created_at ON public.monitoring_events(created_at DESC);
CREATE INDEX idx_monitoring_events_type ON public.monitoring_events(event_type);

ALTER TABLE public.monitoring_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin reads events"
  ON public.monitoring_events
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Assinaturas Web Push
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id) WHERE active = true;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admin reads all subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Estado de alertas (anti-duplicação)
CREATE TABLE public.monitoring_alert_state (
  alert_key text PRIMARY KEY,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.monitoring_alert_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages alert state"
  ON public.monitoring_alert_state
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));