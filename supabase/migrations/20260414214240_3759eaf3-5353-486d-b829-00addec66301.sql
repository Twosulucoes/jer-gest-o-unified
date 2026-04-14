
-- Create external_credentials table
CREATE TABLE public.external_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  credential_code TEXT NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_by_user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'lost', 'replaced')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique: one code per event
CREATE UNIQUE INDEX uq_external_credentials_event_code
  ON public.external_credentials (event_id, credential_code);

-- Unique partial: one active credential per participant per event
CREATE UNIQUE INDEX uq_external_credentials_active_participant
  ON public.external_credentials (event_id, participant_id)
  WHERE status = 'active';

-- Index for lookups by credential_code (used by scanners)
CREATE INDEX idx_external_credentials_code ON public.external_credentials (credential_code);

-- Enable RLS
ALTER TABLE public.external_credentials ENABLE ROW LEVEL SECURITY;

-- SELECT: admin, secretaria, coordenacao_tecnica, and operational roles
CREATE POLICY "external_credentials_select"
  ON public.external_credentials FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaria') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica') OR
    public.has_role(auth.uid(), 'transporte') OR
    public.has_role(auth.uid(), 'alimentacao') OR
    public.has_role(auth.uid(), 'alojamento') OR
    public.has_role(auth.uid(), 'coordenador_modalidade')
  );

-- INSERT: admin, secretaria, coordenacao_tecnica
CREATE POLICY "external_credentials_insert"
  ON public.external_credentials FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaria') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  );

-- UPDATE: admin, secretaria, coordenacao_tecnica
CREATE POLICY "external_credentials_update"
  ON public.external_credentials FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaria') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  );

-- DELETE: admin only
CREATE POLICY "external_credentials_delete"
  ON public.external_credentials FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
  );

-- Trigger for updated_at
CREATE TRIGGER update_external_credentials_updated_at
  BEFORE UPDATE ON public.external_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
