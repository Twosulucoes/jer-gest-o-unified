
-- Tabela para erros por linha de importação
CREATE TABLE IF NOT EXISTS public.import_row_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  import_log_id uuid NULL,
  row_number int NOT NULL,
  entity text NULL,
  error_code text NULL,
  error_message text NOT NULL,
  payload jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);

ALTER TABLE public.import_row_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access import_row_errors"
  ON public.import_row_errors FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria can read import_row_errors"
  ON public.import_row_errors FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Secretaria can insert import_row_errors"
  ON public.import_row_errors FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Coordenacao tecnica can read import_row_errors"
  ON public.import_row_errors FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));
