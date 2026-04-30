-- Tabela para monitoramento de performance do Frontend
CREATE TABLE IF NOT EXISTS public.performance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_name TEXT NOT NULL,
    render_time_ms FLOAT NOT NULL,
    interaction_type TEXT, -- 'render', 'api_call', 'interaction'
    path TEXT,
    user_id UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ativar RLS para performance_logs
ALTER TABLE public.performance_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver logs, todos podem inserir (anonimamente ou logado)
CREATE POLICY "Admins can view performance logs" 
ON public.performance_logs FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')));

CREATE POLICY "Anyone can insert performance logs" 
ON public.performance_logs FOR INSERT 
WITH CHECK (true);

-- Índices adicionais para Etapa 4
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON public.audit_events (action);
CREATE INDEX IF NOT EXISTS idx_db_logs_failures ON public.db_operation_logs (is_success) WHERE is_success = false;
CREATE INDEX IF NOT EXISTS idx_perf_logs_component ON public.performance_logs (component_name);
CREATE INDEX IF NOT EXISTS idx_perf_logs_created_at ON public.performance_logs (created_at DESC);

-- Função de manutenção e limpeza (Housekeeping)
CREATE OR REPLACE FUNCTION public.maintain_system_logs()
RETURNS JSONB AS $$
DECLARE
    deleted_ops INTEGER;
    deleted_audit INTEGER;
    deleted_perf INTEGER;
BEGIN
    -- Limpar logs de operação brutos (mais de 15 dias)
    DELETE FROM public.db_operation_logs 
    WHERE created_at < NOW() - INTERVAL '15 days';
    GET DIAGNOSTICS deleted_ops = ROW_COUNT;

    -- Limpar auditoria (mais de 90 dias)
    DELETE FROM public.audit_events 
    WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_audit = ROW_COUNT;

    -- Limpar logs de performance (mais de 7 dias)
    DELETE FROM public.performance_logs 
    WHERE created_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS deleted_perf = ROW_COUNT;

    RETURN jsonb_build_object(
        'ops_cleaned', deleted_ops,
        'audit_cleaned', deleted_audit,
        'perf_cleaned', deleted_perf,
        'timestamp', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário para documentação
COMMENT ON FUNCTION public.maintain_system_logs IS 'Realiza a limpeza periódica de logs para manter a escalabilidade do banco de dados.';
