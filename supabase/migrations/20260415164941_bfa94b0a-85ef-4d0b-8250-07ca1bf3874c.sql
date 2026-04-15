
-- Drop overly permissive policies
DROP POLICY "Authenticated users can insert event rules" ON public.event_edition_rules;
DROP POLICY "Authenticated users can update event rules" ON public.event_edition_rules;
DROP POLICY "Authenticated users can insert audit log" ON public.event_rules_audit_log;

-- Tighter insert policy
CREATE POLICY "Admin/secretaria/coord can insert event rules"
  ON public.event_edition_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaria') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  );

-- Tighter update policy
CREATE POLICY "Admin/secretaria/coord can update event rules"
  ON public.event_edition_rules FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaria') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  );

-- Tighter audit insert policy
CREATE POLICY "Admin/secretaria/coord can insert audit"
  ON public.event_rules_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaria') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  );
