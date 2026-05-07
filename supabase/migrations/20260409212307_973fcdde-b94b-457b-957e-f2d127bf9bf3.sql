
-- Table for match attachments/evidence
CREATE TABLE public.match_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.competition_matches(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'other',
  file_name text NOT NULL,
  notes text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access match_attachments"
  ON public.match_attachments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Coordenacao tecnica can manage match_attachments"
  ON public.match_attachments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica')) WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'));

CREATE POLICY "Secretaria can manage match_attachments"
  ON public.match_attachments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));

CREATE TRIGGER update_match_attachments_updated_at
  BEFORE UPDATE ON public.match_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_match_attachments_match ON public.match_attachments(match_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('match-attachments', 'match-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated can read match attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'match-attachments');

CREATE POLICY "Admin can upload match attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'match-attachments' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Secretaria can upload match attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'match-attachments' AND has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Coordenacao can upload match attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'match-attachments' AND has_role(auth.uid(), 'coordenacao_tecnica'));

CREATE POLICY "Admin can delete match attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'match-attachments' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Secretaria can delete match attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'match-attachments' AND has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Coordenacao can delete match attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'match-attachments' AND has_role(auth.uid(), 'coordenacao_tecnica'));
