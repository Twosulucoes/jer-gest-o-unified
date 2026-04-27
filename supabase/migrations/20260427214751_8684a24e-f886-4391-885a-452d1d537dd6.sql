-- Adicionando colunas para suporte a reemissão
ALTER TABLE public.service_vouchers 
ADD COLUMN IF NOT EXISTS replaces_voucher_id UUID REFERENCES public.service_vouchers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reissued_at TIMESTAMP WITH TIME ZONE;

-- Índices para performance na auditoria e histórico
CREATE INDEX IF NOT EXISTS idx_vouchers_replaces ON public.service_vouchers(replaces_voucher_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_status_event ON public.service_vouchers(status, event_id);

-- Comentários de schema
COMMENT ON COLUMN public.service_vouchers.replaces_voucher_id IS 'ID do voucher original que este novo voucher substitui (caso de extravio/erro)';
COMMENT ON COLUMN public.service_vouchers.reissued_at IS 'Data/hora em que este voucher foi gerado como uma reemissão';
