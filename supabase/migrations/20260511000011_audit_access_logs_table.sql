-- ============================================================
-- access_logs: records denied / error access attempts so admins
-- can audit who tried to access what and why they were blocked.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.access_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email  text,
  action      text NOT NULL,   -- 'route_access' | 'data_access' | 'login'
  resource    text,            -- route path or table name attempted
  status      text NOT NULL,   -- 'denied' | 'error'
  error_code  text,            -- e.g. '42501', 'PGRST301'
  error_msg   text,
  metadata    jsonb,           -- extra context (roles, stage, event)
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Only admins/super_admin/secretaria can read logs
CREATE POLICY "access_logs_select_admin"
ON public.access_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'secretaria'::app_role)
);

-- Any authenticated user can insert their own denied access events
-- (via security-definer helper function below, not direct INSERT)
CREATE POLICY "access_logs_insert_own"
ON public.access_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Security-definer function so the frontend can log access errors
-- without needing a direct INSERT policy (bypasses RLS safely).
CREATE OR REPLACE FUNCTION public.log_access_error(
  p_action      text,
  p_resource    text,
  p_status      text,
  p_error_code  text DEFAULT NULL,
  p_error_msg   text DEFAULT NULL,
  p_metadata    jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.access_logs (
    user_id, user_email, action, resource, status, error_code, error_msg, metadata
  )
  SELECT
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    p_action,
    p_resource,
    p_status,
    p_error_code,
    p_error_msg,
    p_metadata;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.log_access_error TO authenticated;

-- Index for admin queries
CREATE INDEX IF NOT EXISTS access_logs_user_id_idx ON public.access_logs(user_id);
CREATE INDEX IF NOT EXISTS access_logs_created_at_idx ON public.access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS access_logs_status_idx ON public.access_logs(status);
