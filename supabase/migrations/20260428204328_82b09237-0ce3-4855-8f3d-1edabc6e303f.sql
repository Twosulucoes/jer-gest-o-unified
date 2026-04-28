-- Garantir que super_admin tenha acesso total à configuração OSC
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Super admin tem acesso total osc_configs') THEN
        DROP POLICY "Super admin tem acesso total osc_configs" ON public.event_osc_configs;
    END IF;
END $$;

CREATE POLICY "Super admin tem acesso total osc_configs" 
ON public.event_osc_configs 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Garantir que super_admin tenha acesso total às evidências
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Super admin tem acesso total evidencias') THEN
        DROP POLICY "Super admin tem acesso total evidencias" ON public.operational_evidence;
    END IF;
END $$;

CREATE POLICY "Super admin tem acesso total evidencias" 
ON public.operational_evidence 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Garantir permissão de inserção em audit_events para usuários autenticados
-- (Normalmente já existe, mas reforçamos para a trilha de auditoria da geração)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own audit events' AND tablename = 'audit_events') THEN
        CREATE POLICY "Users can insert their own audit events" 
        ON public.audit_events 
        FOR INSERT 
        TO authenticated 
        WITH CHECK (auth.uid() = created_by);
    END IF;
END $$;
