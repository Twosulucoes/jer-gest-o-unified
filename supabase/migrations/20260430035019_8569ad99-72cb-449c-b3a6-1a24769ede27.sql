-- 1. Adicionar metadados estendidos à auditoria se não existirem
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'audit_events' AND column_name = 'execution_context') THEN
        ALTER TABLE public.audit_events ADD COLUMN execution_context JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Índices para performance em tempo real de auditoria
CREATE INDEX IF NOT EXISTS idx_audit_events_critical_realtime 
ON public.audit_events (created_at DESC) 
WHERE action IN ('scope_violation', 'error') OR action ILIKE 'REMEDIATION_%';

-- 3. Criar uma tabela de estado de sincronia do sistema para o Dashboard
CREATE TABLE IF NOT EXISTS public.system_sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL UNIQUE,
    last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    row_count_cache BIGINT DEFAULT 0
);

ALTER TABLE public.system_sync_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sync status" ON public.system_sync_status FOR SELECT USING (true);

-- 4. Função para atualizar o status de sincronia
CREATE OR REPLACE FUNCTION public.update_system_sync_status()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.system_sync_status (table_name, last_modified_at)
    VALUES (TG_TABLE_NAME, now())
    ON CONFLICT (table_name) DO UPDATE 
    SET last_modified_at = EXCLUDED.last_modified_at;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Gatilhos em tabelas críticas
DROP TRIGGER IF EXISTS trg_sync_participants ON public.participants;
CREATE TRIGGER trg_sync_participants 
AFTER INSERT OR UPDATE OR DELETE ON public.participants 
FOR EACH STATEMENT EXECUTE FUNCTION public.update_system_sync_status();

DROP TRIGGER IF EXISTS trg_sync_matches ON public.competition_matches;
CREATE TRIGGER trg_sync_matches 
AFTER INSERT OR UPDATE OR DELETE ON public.competition_matches 
FOR EACH STATEMENT EXECUTE FUNCTION public.update_system_sync_status();

DROP TRIGGER IF EXISTS trg_sync_credentials ON public.participant_credentials;
CREATE TRIGGER trg_sync_credentials 
AFTER INSERT OR UPDATE OR DELETE ON public.participant_credentials 
FOR EACH STATEMENT EXECUTE FUNCTION public.update_system_sync_status();
