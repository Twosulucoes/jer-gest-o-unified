-- Command bus for global operator actions (e.g., force refresh on connected clients)
CREATE TABLE IF NOT EXISTS public.system_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_commands_command_check CHECK (command IN ('refresh_all'))
);

ALTER TABLE public.system_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read system commands"
  ON public.system_commands
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin can insert system commands"
  ON public.system_commands
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
