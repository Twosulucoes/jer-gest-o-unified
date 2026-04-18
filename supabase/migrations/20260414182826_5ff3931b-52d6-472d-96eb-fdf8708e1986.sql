
-- Create user_sessions table for login tracking
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  logout_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Admin/secretaria can view all sessions
CREATE POLICY "Admins can view all sessions"
  ON public.user_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretaria'));

-- Users can view own sessions
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Only service role inserts (via edge function)
CREATE POLICY "Service role inserts sessions"
  ON public.user_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
