-- Adiciona colunas para suporte a validação de relatórios via QR Code
ALTER TABLE public.audit_events 
ADD COLUMN IF NOT EXISTS report_id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS validation_token TEXT;

-- Cria um índice para busca rápida de tokens de validação
CREATE INDEX IF NOT EXISTS idx_audit_events_validation_token ON public.audit_events(validation_token);

-- Comentário explicativo
COMMENT ON COLUMN public.audit_events.report_id IS 'Identificador único do relatório gerado para vínculo com QR Code.';
COMMENT ON COLUMN public.audit_events.validation_token IS 'Token curto para URL de validação pública.';