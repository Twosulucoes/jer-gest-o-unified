-- Adicionar políticas para super_admin na tabela people
CREATE POLICY "Super admin full access people" 
ON public.people 
FOR ALL 
TO authenticated 
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- A política de super_admin para participants já existe (visto no dump anterior), 
-- mas vamos garantir que cubra todas as operações se houver dúvida.
-- "Super admin can do everything on participants" já existe para ALL.

-- Caso existam outras tabelas relacionadas acessadas na PessoasPage:
-- A consulta na PessoasPage também acessa 'participants' para contagem.
