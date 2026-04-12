
-- =====================================================
-- SCHEMA LOGISTICA
-- =====================================================
CREATE SCHEMA IF NOT EXISTS logistica;

-- A) checkpoints
CREATE TABLE logistica.checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  domain text NOT NULL CHECK (domain IN ('transporte','alimentacao','alojamento')),
  name text NOT NULL,
  location text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, domain, name)
);
ALTER TABLE logistica.checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access logistica.checkpoints" ON logistica.checkpoints FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access logistica.checkpoints" ON logistica.checkpoints FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "CoordTec read logistica.checkpoints" ON logistica.checkpoints FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));
CREATE POLICY "Transporte read own domain checkpoints" ON logistica.checkpoints FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'transporte'::public.app_role) AND domain = 'transporte');
CREATE POLICY "Alimentacao read own domain checkpoints" ON logistica.checkpoints FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alimentacao'::public.app_role) AND domain = 'alimentacao');
CREATE POLICY "Alojamento read own domain checkpoints" ON logistica.checkpoints FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role) AND domain = 'alojamento');

-- B) qr_tokens
CREATE TABLE logistica.qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  qr_type text NOT NULL CHECK (qr_type IN ('pessoa','delegacao','veiculo','voucher','match','outro')),
  entity_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  last_used_at timestamptz,
  use_count int NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_qr_tokens_active ON logistica.qr_tokens (event_id, qr_type, entity_id) WHERE active = true;
ALTER TABLE logistica.qr_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access logistica.qr_tokens" ON logistica.qr_tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access logistica.qr_tokens" ON logistica.qr_tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));

-- C) checkins
CREATE TABLE logistica.checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  domain text NOT NULL CHECK (domain IN ('transporte','alimentacao','alojamento')),
  checkpoint_id uuid REFERENCES logistica.checkpoints(id),
  entity_type text NOT NULL CHECK (entity_type IN ('pessoa','delegacao','veiculo','voucher','outro')),
  entity_id uuid,
  qr_token text,
  action text NOT NULL CHECK (action IN ('entrada','saida','validacao')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  performed_by uuid REFERENCES auth.users(id),
  device_id text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  error_code text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkins_event_domain ON logistica.checkins (event_id, domain, occurred_at DESC);
CREATE INDEX idx_checkins_performed_by ON logistica.checkins (performed_by, occurred_at DESC);
ALTER TABLE logistica.checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access logistica.checkins" ON logistica.checkins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access logistica.checkins" ON logistica.checkins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "Transporte read own checkins" ON logistica.checkins FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'transporte'::public.app_role) AND domain = 'transporte');
CREATE POLICY "Transporte insert own checkins" ON logistica.checkins FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'transporte'::public.app_role) AND domain = 'transporte' AND performed_by = auth.uid());
CREATE POLICY "Alimentacao read own checkins" ON logistica.checkins FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alimentacao'::public.app_role) AND domain = 'alimentacao');
CREATE POLICY "Alimentacao insert own checkins" ON logistica.checkins FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'alimentacao'::public.app_role) AND domain = 'alimentacao' AND performed_by = auth.uid());
CREATE POLICY "Alojamento read own checkins" ON logistica.checkins FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role) AND domain = 'alojamento');
CREATE POLICY "Alojamento insert own checkins" ON logistica.checkins FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'alojamento'::public.app_role) AND domain = 'alojamento' AND performed_by = auth.uid());

-- D) incidents
CREATE TABLE logistica.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  domain text NOT NULL CHECK (domain IN ('transporte','alimentacao','alojamento','geral')),
  checkpoint_id uuid REFERENCES logistica.checkpoints(id),
  related_entity_type text,
  related_entity_id uuid,
  severity text NOT NULL DEFAULT 'baixa' CHECK (severity IN ('baixa','media','alta')),
  category text NOT NULL DEFAULT 'geral',
  description text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_atendimento','resolvida')),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_incidents_event_domain ON logistica.incidents (event_id, domain, occurred_at DESC);
ALTER TABLE logistica.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access logistica.incidents" ON logistica.incidents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access logistica.incidents" ON logistica.incidents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "Transporte manage own incidents" ON logistica.incidents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'transporte'::public.app_role) AND domain = 'transporte')
  WITH CHECK (public.has_role(auth.uid(), 'transporte'::public.app_role) AND domain = 'transporte');
CREATE POLICY "Alimentacao manage own incidents" ON logistica.incidents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'alimentacao'::public.app_role) AND domain = 'alimentacao')
  WITH CHECK (public.has_role(auth.uid(), 'alimentacao'::public.app_role) AND domain = 'alimentacao');
CREATE POLICY "Alojamento manage own incidents" ON logistica.incidents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role) AND domain = 'alojamento')
  WITH CHECK (public.has_role(auth.uid(), 'alojamento'::public.app_role) AND domain = 'alojamento');

-- =====================================================
-- SCHEMA ARBITRAGEM
-- =====================================================
CREATE SCHEMA IF NOT EXISTS arbitragem;

-- A) officials
CREATE TABLE arbitragem.officials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('arbitro','mesario','delegado_partida','anotador','cronometrista','outro')),
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, full_name, role)
);
ALTER TABLE arbitragem.officials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access arbitragem.officials" ON arbitragem.officials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access arbitragem.officials" ON arbitragem.officials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "CoordTec manage arbitragem.officials" ON arbitragem.officials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));
CREATE POLICY "Arbitragem read officials" ON arbitragem.officials FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'arbitragem'::public.app_role));

-- B) match_officials
CREATE TABLE arbitragem.match_officials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  match_id uuid NOT NULL,
  official_id uuid NOT NULL REFERENCES arbitragem.officials(id) ON DELETE RESTRICT,
  duty_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, official_id)
);
ALTER TABLE arbitragem.match_officials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access arbitragem.match_officials" ON arbitragem.match_officials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access arbitragem.match_officials" ON arbitragem.match_officials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "CoordTec manage arbitragem.match_officials" ON arbitragem.match_officials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));
CREATE POLICY "Arbitragem read match_officials" ON arbitragem.match_officials FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'arbitragem'::public.app_role));

-- C) results
CREATE TABLE arbitragem.results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  match_id uuid NOT NULL,
  modality_id uuid,
  phase text,
  result_status text NOT NULL DEFAULT 'rascunho' CHECK (result_status IN ('rascunho','enviado','publicado','retificado')),
  score_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  report_text text NOT NULL DEFAULT '',
  has_incident boolean NOT NULL DEFAULT false,
  incident_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  submitted_at timestamptz,
  submitted_by uuid REFERENCES auth.users(id),
  published_at timestamptz,
  published_by uuid REFERENCES auth.users(id)
);
CREATE UNIQUE INDEX idx_results_match_active ON arbitragem.results (match_id) WHERE result_status IN ('enviado','publicado','retificado');
CREATE INDEX idx_results_event_match ON arbitragem.results (event_id, match_id);
CREATE INDEX idx_results_event_created ON arbitragem.results (event_id, created_at DESC);
ALTER TABLE arbitragem.results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access arbitragem.results" ON arbitragem.results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access arbitragem.results" ON arbitragem.results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "CoordTec manage arbitragem.results" ON arbitragem.results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));
CREATE POLICY "Arbitragem read results" ON arbitragem.results FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'arbitragem'::public.app_role));
CREATE POLICY "Arbitragem update own drafts" ON arbitragem.results FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'arbitragem'::public.app_role) AND created_by = auth.uid() AND result_status = 'rascunho')
  WITH CHECK (public.has_role(auth.uid(), 'arbitragem'::public.app_role) AND result_status = 'rascunho');
CREATE POLICY "Arbitragem insert results" ON arbitragem.results FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'arbitragem'::public.app_role) AND created_by = auth.uid());

-- D) result_files
CREATE TABLE arbitragem.result_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  result_id uuid NOT NULL REFERENCES arbitragem.results(id) ON DELETE CASCADE,
  file_type text NOT NULL CHECK (file_type IN ('sumula','mini_relatorio','evidencia_foto','outro')),
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_name text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_result_files_result ON arbitragem.result_files (result_id, file_type);
ALTER TABLE arbitragem.result_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access arbitragem.result_files" ON arbitragem.result_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access arbitragem.result_files" ON arbitragem.result_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "CoordTec manage arbitragem.result_files" ON arbitragem.result_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));
CREATE POLICY "Arbitragem manage own result_files" ON arbitragem.result_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'arbitragem'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'arbitragem'::public.app_role));

-- E) result_responsibles
CREATE TABLE arbitragem.result_responsibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL REFERENCES arbitragem.results(id) ON DELETE CASCADE,
  official_id uuid NOT NULL REFERENCES arbitragem.officials(id),
  duty_role text NOT NULL,
  present boolean NOT NULL DEFAULT true,
  notes text,
  UNIQUE(result_id, official_id)
);
ALTER TABLE arbitragem.result_responsibles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access arbitragem.result_responsibles" ON arbitragem.result_responsibles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access arbitragem.result_responsibles" ON arbitragem.result_responsibles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "CoordTec manage arbitragem.result_responsibles" ON arbitragem.result_responsibles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));
CREATE POLICY "Arbitragem manage result_responsibles" ON arbitragem.result_responsibles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'arbitragem'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'arbitragem'::public.app_role));

-- F) submission_events
CREATE TABLE arbitragem.submission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL REFERENCES arbitragem.results(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('create','save_draft','submit','publish','rectify','attach_file')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  by_user uuid REFERENCES auth.users(id),
  device_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_submission_events_result ON arbitragem.submission_events (result_id, occurred_at DESC);
ALTER TABLE arbitragem.submission_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access arbitragem.submission_events" ON arbitragem.submission_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria read arbitragem.submission_events" ON arbitragem.submission_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "CoordTec read arbitragem.submission_events" ON arbitragem.submission_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));
CREATE POLICY "Arbitragem insert submission_events" ON arbitragem.submission_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'arbitragem'::public.app_role) AND by_user = auth.uid());
CREATE POLICY "Arbitragem read own submission_events" ON arbitragem.submission_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'arbitragem'::public.app_role));

-- =====================================================
-- SCHEMA CDE
-- =====================================================
CREATE SCHEMA IF NOT EXISTS cde;

CREATE SEQUENCE IF NOT EXISTS cde.case_number_seq START 1;

-- A) cases
CREATE TABLE cde.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  case_number text NOT NULL,
  match_id uuid,
  origin text NOT NULL CHECK (origin IN ('arbitragem_ocorrencia','recurso_protesto','outro')),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_analise','aguardando_documentos','decidido','arquivado')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa','normal','alta')),
  subject text NOT NULL,
  description text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opened_by uuid REFERENCES auth.users(id),
  related_result_id uuid,
  decision_text text,
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id),
  UNIQUE(event_id, case_number)
);
CREATE INDEX idx_cases_event_status ON cde.cases (event_id, status, opened_at DESC);
ALTER TABLE cde.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access cde.cases" ON cde.cases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access cde.cases" ON cde.cases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "CDE manage cases" ON cde.cases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'cde'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'cde'::public.app_role));
CREATE POLICY "CoordTec read cde.cases" ON cde.cases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));

-- B) case_files
CREATE TABLE cde.case_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cde.cases(id) ON DELETE CASCADE,
  file_type text NOT NULL CHECK (file_type IN ('recurso','evidencia','documento','outro')),
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id),
  notes text
);
CREATE INDEX idx_case_files_case ON cde.case_files (case_id, uploaded_at DESC);
ALTER TABLE cde.case_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access cde.case_files" ON cde.case_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access cde.case_files" ON cde.case_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "CDE manage case_files" ON cde.case_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'cde'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'cde'::public.app_role));

-- C) case_events
CREATE TABLE cde.case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cde.cases(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('open','add_file','comment','change_status','decision')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  by_user uuid REFERENCES auth.users(id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_case_events_case ON cde.case_events (case_id, occurred_at DESC);
ALTER TABLE cde.case_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access cde.case_events" ON cde.case_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access cde.case_events" ON cde.case_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "CDE manage case_events" ON cde.case_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'cde'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'cde'::public.app_role));
CREATE POLICY "CoordTec read cde.case_events" ON cde.case_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));

-- D) notifications
CREATE TABLE cde.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  to_role text NOT NULL CHECK (to_role IN ('cde','admin','secretaria','coordenacao_tecnica')),
  title text NOT NULL,
  message text NOT NULL,
  link_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  read_by jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX idx_notifications_event ON cde.notifications (event_id, created_at DESC);
ALTER TABLE cde.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access cde.notifications" ON cde.notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria read cde.notifications" ON cde.notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "CDE manage notifications" ON cde.notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'cde'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'cde'::public.app_role));
CREATE POLICY "CoordTec read cde.notifications" ON cde.notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('sumulas', 'sumulas', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('relatorios-arbitragem', 'relatorios-arbitragem', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('evidencias-partida', 'evidencias-partida', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('recursos-cde', 'recursos-cde', false) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Auth users upload sumulas" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sumulas' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'secretaria'::public.app_role) OR
    public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role) OR
    public.has_role(auth.uid(), 'arbitragem'::public.app_role)
  ));
CREATE POLICY "Auth users read sumulas" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sumulas' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'secretaria'::public.app_role) OR
    public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role) OR
    public.has_role(auth.uid(), 'arbitragem'::public.app_role)
  ));
CREATE POLICY "Auth users upload evidencias" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidencias-partida' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'secretaria'::public.app_role) OR
    public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role) OR
    public.has_role(auth.uid(), 'arbitragem'::public.app_role)
  ));
CREATE POLICY "Auth users read evidencias" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'evidencias-partida' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'secretaria'::public.app_role) OR
    public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role) OR
    public.has_role(auth.uid(), 'arbitragem'::public.app_role)
  ));
CREATE POLICY "Auth users upload recursos-cde" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recursos-cde' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'secretaria'::public.app_role) OR
    public.has_role(auth.uid(), 'cde'::public.app_role)
  ));
CREATE POLICY "Auth users read recursos-cde" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recursos-cde' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'secretaria'::public.app_role) OR
    public.has_role(auth.uid(), 'cde'::public.app_role)
  ));
CREATE POLICY "Auth users upload relatorios-arbitragem" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'relatorios-arbitragem' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'secretaria'::public.app_role) OR
    public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role) OR
    public.has_role(auth.uid(), 'arbitragem'::public.app_role)
  ));
CREATE POLICY "Auth users read relatorios-arbitragem" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'relatorios-arbitragem' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'secretaria'::public.app_role) OR
    public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role) OR
    public.has_role(auth.uid(), 'arbitragem'::public.app_role)
  ));

-- =====================================================
-- GRANT USAGE on new schemas
-- =====================================================
GRANT USAGE ON SCHEMA logistica TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA logistica TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA logistica TO anon, authenticated, service_role;

GRANT USAGE ON SCHEMA arbitragem TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA arbitragem TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA arbitragem TO anon, authenticated, service_role;

GRANT USAGE ON SCHEMA cde TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA cde TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA cde TO anon, authenticated, service_role;
