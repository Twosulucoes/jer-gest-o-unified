
CREATE TABLE public.import_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  import_log_id uuid REFERENCES public.import_logs(id) ON DELETE SET NULL,
  source_file_name text,
  source_row_number integer NOT NULL,
  raw_payload_json jsonb,
  normalized_name text,
  raw_cpf text,
  raw_birth_date text,
  modality_raw text,
  prova_raw text,
  institution_raw text,
  pending_reason_code text NOT NULL,
  pending_reason_detail text,
  fallback_fingerprint text,
  candidate_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  resolution_status text NOT NULL DEFAULT 'pending',
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_pendencias_event ON public.import_pendencias(event_id);
CREATE INDEX idx_import_pendencias_status ON public.import_pendencias(resolution_status);
CREATE INDEX idx_import_pendencias_reason ON public.import_pendencias(pending_reason_code);
CREATE INDEX idx_import_pendencias_fingerprint ON public.import_pendencias(fallback_fingerprint);
CREATE INDEX idx_import_pendencias_log ON public.import_pendencias(import_log_id);

ALTER TABLE public.import_pendencias ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_import_pendencias_updated_at
  BEFORE UPDATE ON public.import_pendencias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Admin full access on import_pendencias"
  ON public.import_pendencias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Secretaria full access on import_pendencias"
  ON public.import_pendencias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Coordenacao tecnica read import_pendencias"
  ON public.import_pendencias FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'));
