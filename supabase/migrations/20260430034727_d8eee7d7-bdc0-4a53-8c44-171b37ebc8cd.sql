-- Create remediation_logs for high-impact technical actions
CREATE TABLE public.remediation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    action_key TEXT NOT NULL,
    target_id TEXT,
    target_name TEXT,
    severity TEXT,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.remediation_logs ENABLE ROW LEVEL SECURITY;

-- Policies for remediation_logs
CREATE POLICY "Admins can view remediation logs" 
ON public.remediation_logs FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
));

CREATE POLICY "Admins can insert remediation logs" 
ON public.remediation_logs FOR INSERT 
WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
));

-- Optimize audit_events
CREATE INDEX IF NOT EXISTS idx_audit_events_record_id ON public.audit_events (record_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_table_name ON public.audit_events (table_name);
-- GIN index for fast JSONB search in audit payloads
CREATE INDEX IF NOT EXISTS idx_audit_events_payload_gin ON public.audit_events USING GIN (payload);

-- Optimize monitoring_errors
CREATE INDEX IF NOT EXISTS idx_monitoring_errors_user_id ON public.monitoring_errors (user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_errors_created_at_desc ON public.monitoring_errors (created_at DESC);

-- Ensure db_operation_logs has optimized index for critical status
CREATE INDEX IF NOT EXISTS idx_db_logs_critical ON public.db_operation_logs (created_at DESC) 
WHERE is_success = false;
