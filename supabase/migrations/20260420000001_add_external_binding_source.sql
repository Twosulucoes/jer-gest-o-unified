-- Adiciona 'external' como valor válido para binding_source em participant_credentials
ALTER TABLE public.participant_credentials
  DROP CONSTRAINT IF EXISTS participant_credentials_binding_source_check;

ALTER TABLE public.participant_credentials
  ADD CONSTRAINT participant_credentials_binding_source_check
  CHECK (binding_source IN ('import', 'manual', 'api_sync', 'external'));
