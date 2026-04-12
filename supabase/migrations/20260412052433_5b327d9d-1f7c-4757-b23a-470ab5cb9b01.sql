
-- Create report_presets table
CREATE TABLE public.report_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NULL REFERENCES public.events(id) ON DELETE CASCADE,
  report_id text NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  columns jsonb NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_report_presets_report_id ON public.report_presets (report_id);
CREATE INDEX idx_report_presets_created_by ON public.report_presets (created_by);
CREATE INDEX idx_report_presets_event ON public.report_presets (event_id);

-- Enable RLS
ALTER TABLE public.report_presets ENABLE ROW LEVEL SECURITY;

-- Owner CRUD
CREATE POLICY "Users can manage own presets"
ON public.report_presets
FOR ALL
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Admin can view all
CREATE POLICY "Admin can view all presets"
ON public.report_presets
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Coordenacao tecnica can view all
CREATE POLICY "CoordTec can view all presets"
ON public.report_presets
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::app_role));
