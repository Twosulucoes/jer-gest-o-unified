
-- =============================================
-- participant_credentials
-- =============================================

CREATE TABLE public.participant_credentials (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id            uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  event_id                  uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,

  -- Vínculo com sistema externo
  external_system           text NOT NULL DEFAULT 'seduc_rr',
  external_registration_id  text,
  external_participant_id   text,

  -- Credencial operacional
  credential_code           text NOT NULL,
  qr_code_value             text NOT NULL,

  -- Origem e ciclo de vida
  binding_source            text NOT NULL DEFAULT 'import'
                            CHECK (binding_source IN ('import','manual','api_sync')),
  status                    text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','active','suspended','revoked')),
  issued_at                 timestamptz,
  activated_at              timestamptz,
  revoked_at                timestamptz,
  last_validated_at         timestamptz,

  -- Payload bruto (auditoria)
  raw_payload               jsonb,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT uq_credential_qr       UNIQUE (qr_code_value),
  CONSTRAINT uq_participant_event   UNIQUE (participant_id, event_id),
  CONSTRAINT uq_event_credential    UNIQUE (event_id, credential_code)
);

-- Índices para reconciliação com sistema externo
CREATE INDEX idx_pc_ext_participant
  ON public.participant_credentials (external_system, external_participant_id);

CREATE INDEX idx_pc_ext_registration
  ON public.participant_credentials (external_system, external_registration_id);

-- Trigger: updated_at (nome específico da tabela)
CREATE TRIGGER set_participant_credentials_updated_at
  BEFORE UPDATE ON public.participant_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Trigger: coerência event_id
-- =============================================
CREATE OR REPLACE FUNCTION public.validate_credential_event_consistency()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_participant_event_id uuid;
BEGIN
  SELECT event_id INTO v_participant_event_id
    FROM public.participants WHERE id = NEW.participant_id;

  IF v_participant_event_id IS DISTINCT FROM NEW.event_id THEN
    RAISE EXCEPTION
      'credential event_id (%) does not match participant event_id (%)',
      NEW.event_id, v_participant_event_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_credential_event
  BEFORE INSERT OR UPDATE ON public.participant_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_credential_event_consistency();

-- =============================================
-- RLS
-- =============================================
ALTER TABLE public.participant_credentials ENABLE ROW LEVEL SECURITY;

-- Admin: ALL
CREATE POLICY "Admin full access participant_credentials"
  ON public.participant_credentials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Secretaria: SELECT / INSERT / UPDATE
CREATE POLICY "Secretaria can read participant_credentials"
  ON public.participant_credentials FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Secretaria can insert participant_credentials"
  ON public.participant_credentials FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Secretaria can update participant_credentials"
  ON public.participant_credentials FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

-- Coordenacao tecnica: SELECT
CREATE POLICY "Coordenacao tecnica can read participant_credentials"
  ON public.participant_credentials FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'));

-- Transporte: SELECT
CREATE POLICY "Transporte can read participant_credentials"
  ON public.participant_credentials FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'transporte'));

-- Alimentacao: SELECT
CREATE POLICY "Alimentacao can read participant_credentials"
  ON public.participant_credentials FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alimentacao'));
