
-- Create credential_templates table
CREATE TABLE public.credential_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  name text NOT NULL,
  background_url text,
  width integer NOT NULL DEFAULT 600,
  height integer NOT NULL DEFAULT 400,
  field_config jsonb NOT NULL DEFAULT '{
    "full_name": {"x": 300, "y": 180, "fontSize": 24, "fontColor": "#000000", "align": "center", "visible": true},
    "institution": {"x": 300, "y": 220, "fontSize": 14, "fontColor": "#333333", "align": "center", "visible": true},
    "participant_type": {"x": 300, "y": 250, "fontSize": 12, "fontColor": "#666666", "align": "center", "visible": true},
    "sport_event": {"x": 300, "y": 270, "fontSize": 12, "fontColor": "#666666", "align": "center", "visible": true},
    "credential_code": {"x": 300, "y": 350, "fontSize": 10, "fontColor": "#999999", "align": "center", "visible": true},
    "qr_code": {"x": 250, "y": 290, "width": 100, "height": 100, "visible": true},
    "photo": {"x": 250, "y": 40, "width": 100, "height": 120, "visible": false}
  }'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credential_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin full access credential_templates"
  ON public.credential_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria can manage credential_templates"
  ON public.credential_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role))
  WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Coordenacao tecnica can read credential_templates"
  ON public.credential_templates FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_credential_templates_updated_at
  BEFORE UPDATE ON public.credential_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for template backgrounds
INSERT INTO storage.buckets (id, name, public)
VALUES ('credential-templates', 'credential-templates', true);

-- Storage policies
CREATE POLICY "Anyone can read credential template files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'credential-templates');

CREATE POLICY "Admin can upload credential templates"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'credential-templates' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria can upload credential templates"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'credential-templates' AND has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Admin can update credential templates"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'credential-templates' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria can update credential templates"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'credential-templates' AND has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Admin can delete credential templates"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'credential-templates' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria can delete credential templates"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'credential-templates' AND has_role(auth.uid(), 'secretaria'::app_role));
