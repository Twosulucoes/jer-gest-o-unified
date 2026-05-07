-- Tabela de identidade visual por evento
CREATE TABLE public.event_branding (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  logos jsonb NOT NULL DEFAULT '[]'::jsonb,
  nome_oficial text,
  subtitulo text,
  rodape_texto text,
  local_ano text,
  assinatura_nome text,
  assinatura_cargo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

ALTER TABLE public.event_branding ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer autenticado
CREATE POLICY "event_branding_select_authenticated"
  ON public.event_branding FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: apenas admin
CREATE POLICY "event_branding_insert_admin"
  ON public.event_branding FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "event_branding_update_admin"
  ON public.event_branding FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "event_branding_delete_admin"
  ON public.event_branding FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER trg_event_branding_updated_at
  BEFORE UPDATE ON public.event_branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket público para logos de relatório
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-assets', 'report-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas do bucket: leitura pública (bucket público), upload/update/delete só admin
CREATE POLICY "report_assets_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'report-assets');

CREATE POLICY "report_assets_insert_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'report-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "report_assets_update_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'report-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "report_assets_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'report-assets' AND public.has_role(auth.uid(), 'admin'));