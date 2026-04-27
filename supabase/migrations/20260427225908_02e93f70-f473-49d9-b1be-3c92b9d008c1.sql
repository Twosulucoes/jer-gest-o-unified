-- Adiciona colunas para suporte offline e metadados na auditoria de vouchers
ALTER TABLE public.service_voucher_attempts 
ADD COLUMN IF NOT EXISTS is_offline BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS offline_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Comentários para documentação
COMMENT ON COLUMN public.service_voucher_attempts.is_offline IS 'Indica se a tentativa ocorreu enquanto o dispositivo estava offline.';
COMMENT ON COLUMN public.service_voucher_attempts.offline_at IS 'Instante real da leitura capturado pelo dispositivo em campo.';
COMMENT ON COLUMN public.service_voucher_attempts.metadata IS 'Metadados ricos para detalhamento de conflitos (ex: detalhes do consumo anterior, motivo da revogação, etc).';