-- ============================================
-- FASE 4b: Tabela de atribuições de usuário por etapa + enforcement RLS
-- ============================================

-- Tabela de atribuições explícitas: um usuário pode ser restrito a etapas específicas
CREATE TABLE IF NOT EXISTS public.user_stage_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_stage_id UUID NOT NULL REFERENCES public.event_stages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_stage_assignment UNIQUE (user_id, event_stage_id)
);

CREATE INDEX IF NOT EXISTS idx_user_stage_assignments_user ON public.user_stage_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stage_assignments_stage ON public.user_stage_assignments(event_stage_id);

ALTER TABLE public.user_stage_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage stage assignments"
  ON public.user_stage_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can view own stage assignments"
  ON public.user_stage_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Atualiza helper: admin/secretaria/coordenacao_tecnica têm acesso irrestrito.
-- Demais perfis operacionais: se existir ao menos uma atribuição explícita para o usuário
-- neste evento, exige que a etapa solicitada esteja na lista; caso contrário, libera (backward-compat).
CREATE OR REPLACE FUNCTION public.user_can_access_stage(_user_id uuid, _stage_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_stages es
    WHERE es.id = _stage_id
  )
  AND (
    -- Perfis irrestrítos sempre podem acessar qualquer etapa
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'super_admin')
    OR public.has_role(_user_id, 'secretaria')
    OR public.has_role(_user_id, 'coordenacao_tecnica')
    OR (
      -- Perfis operacionais: verifica se há atribuição explícita;
      -- se não houver nenhuma atribuição para o usuário neste evento, libera (backward-compat)
      (
        public.has_role(_user_id, 'alojamento')
        OR public.has_role(_user_id, 'alimentacao')
        OR public.has_role(_user_id, 'transporte')
        OR public.has_role(_user_id, 'coordenador_modalidade')
        OR public.has_role(_user_id, 'delegacao')
      )
      AND (
        -- Sem nenhuma atribuição explícita → acesso liberado (backward-compat)
        NOT EXISTS (
          SELECT 1 FROM public.user_stage_assignments usa2
          JOIN public.event_stages es2 ON es2.id = usa2.event_stage_id
          WHERE usa2.user_id = _user_id
            AND es2.event_id = (SELECT event_id FROM public.event_stages WHERE id = _stage_id)
        )
        -- Com atribuições explícitas → exige que a etapa solicitada esteja na lista
        OR EXISTS (
          SELECT 1 FROM public.user_stage_assignments usa
          WHERE usa.user_id = _user_id
            AND usa.event_stage_id = _stage_id
        )
      )
    )
  );
$$;

COMMENT ON FUNCTION public.user_can_access_stage IS
'Fase 4b: admin/secretaria/coordenacao_tecnica têm acesso irrestrito. Perfis operacionais (alojamento, alimentacao, transporte, coordenador_modalidade, delegacao) respeitam atribuições explícitas em user_stage_assignments quando presentes; sem atribuições, acesso liberado para compatibilidade retroativa.';

COMMENT ON TABLE public.user_stage_assignments IS
'Atribuições explícitas de usuários a etapas. Quando presente, restringe usuários operacionais a operar somente nas etapas listadas.';

-- Registrar conclusão da Fase 4b
INSERT INTO public.audit_events (action, table_name, record_id, payload)
VALUES (
  'rls_audit_phase4b',
  'event_stages',
  gen_random_uuid(),
  jsonb_build_object(
    'phase', '4b',
    'description', 'user_stage_assignments criada; user_can_access_stage atualizado para enforcement por etapa com backward-compat.',
    'tables_added', ARRAY['user_stage_assignments']
  )
);
