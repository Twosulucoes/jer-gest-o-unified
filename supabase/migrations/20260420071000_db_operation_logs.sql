-- Create table for tracking database operation statistics (PWA Telemetry)
CREATE TABLE IF NOT EXISTS public.db_operation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_role public.app_role,
  module_name text NOT NULL,
  table_name text NOT NULL,
  operation text NOT NULL, -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  is_success boolean DEFAULT true,
  error_code text,
  rows_affected integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for common queries in the dashboard
CREATE INDEX IF NOT EXISTS idx_db_operation_logs_module ON public.db_operation_logs(module_name);
CREATE INDEX IF NOT EXISTS idx_db_operation_logs_table ON public.db_operation_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_db_operation_logs_role ON public.db_operation_logs(user_role);
CREATE INDEX IF NOT EXISTS idx_db_operation_logs_event ON public.db_operation_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_db_operation_logs_created_at ON public.db_operation_logs(created_at);

-- Enable RLS
ALTER TABLE public.db_operation_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own logs
CREATE POLICY "Authenticated users can insert db logs"
ON public.db_operation_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only admins and super_admins can read all logs
CREATE POLICY "Admins can read db logs"
ON public.db_operation_logs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'super_admin')
);

-- Grant permissions
GRANT SELECT, INSERT ON public.db_operation_logs TO authenticated;
GRANT SELECT, INSERT ON public.db_operation_logs TO service_role;
