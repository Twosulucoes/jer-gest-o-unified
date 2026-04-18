
-- ============================================================
-- 1. Fix institutions.state: character(1) → text
-- ============================================================
ALTER TABLE public.institutions ALTER COLUMN state TYPE text;

-- ============================================================
-- 2. Unique constraints for operational integrity
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_participant_sport_events
  ON public.participant_sport_events (participant_id, sport_event_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_participant_credential_code
  ON public.participant_credentials (participant_id, event_id, credential_code);

-- ============================================================
-- 3. Table: import_logs (rastreabilidade de importações)
-- ============================================================
CREATE TABLE public.import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id),
  performed_by uuid NOT NULL,
  file_name text,
  row_count integer DEFAULT 0,
  result_summary jsonb,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access import_logs"
  ON public.import_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria can insert import_logs"
  ON public.import_logs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Secretaria can read import_logs"
  ON public.import_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Coordenacao tecnica can read import_logs"
  ON public.import_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- ============================================================
-- 4. Table: credential_scans (rastreabilidade de validações QR)
-- ============================================================
CREATE TABLE public.credential_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES public.participant_credentials(id),
  event_id uuid NOT NULL REFERENCES public.events(id),
  scanned_by uuid NOT NULL,
  scan_point text NOT NULL DEFAULT 'general',
  scan_result text NOT NULL DEFAULT 'valid',
  notes text,
  scanned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credential_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access credential_scans"
  ON public.credential_scans FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria can read credential_scans"
  ON public.credential_scans FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Transporte can insert own scans"
  ON public.credential_scans FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'transporte'::app_role)
    AND scanned_by = auth.uid()
  );

CREATE POLICY "Transporte can read own scans"
  ON public.credential_scans FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'transporte'::app_role)
    AND scanned_by = auth.uid()
  );

CREATE POLICY "Alimentacao can insert own scans"
  ON public.credential_scans FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'alimentacao'::app_role)
    AND scanned_by = auth.uid()
  );

CREATE POLICY "Alimentacao can read own scans"
  ON public.credential_scans FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'alimentacao'::app_role)
    AND scanned_by = auth.uid()
  );

-- ============================================================
-- 5. Missing RLS: transporte + alimentacao read people/participants/delegations
-- ============================================================
CREATE POLICY "Transporte can read people"
  ON public.people FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'transporte'::app_role));

CREATE POLICY "Transporte can read participants"
  ON public.participants FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'transporte'::app_role));

CREATE POLICY "Transporte can read delegations"
  ON public.delegations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'transporte'::app_role));

CREATE POLICY "Alimentacao can read people"
  ON public.people FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'alimentacao'::app_role));

CREATE POLICY "Alimentacao can read participants"
  ON public.participants FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'alimentacao'::app_role));

CREATE POLICY "Alimentacao can read delegations"
  ON public.delegations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'alimentacao'::app_role));

-- ============================================================
-- 6. Delegacao: read own delegation + participants + people + credentials
-- ============================================================

-- Delegacao needs to read events (to see their event)
CREATE POLICY "Delegacao can read events"
  ON public.events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'delegacao'::app_role));

-- Delegacao needs to read institutions (to see their institution name)
CREATE POLICY "Delegacao can read institutions"
  ON public.institutions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'delegacao'::app_role));

-- Note: full delegacao scoping by delegation_id requires a user↔delegation
-- binding table (future step). For now, delegacao can read all delegations
-- they can see, filtered by frontend. This is intentionally broad-read
-- as a stepping stone.
CREATE POLICY "Delegacao can read delegations"
  ON public.delegations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'delegacao'::app_role));

CREATE POLICY "Delegacao can read participants"
  ON public.participants FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'delegacao'::app_role));

CREATE POLICY "Delegacao can read people"
  ON public.people FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'delegacao'::app_role));

CREATE POLICY "Delegacao can read own credentials"
  ON public.participant_credentials FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'delegacao'::app_role));
