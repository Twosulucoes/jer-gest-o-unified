
-- ============================================
-- FASE 4a: Auditoria RLS + helper de etapa
-- ============================================

-- 1) Substituir policy de institutions que referenciava institutions diretamente.
--    Agora delegacao lê sua própria institution via delegations (sem auto-referência).
DROP POLICY IF EXISTS "Delegacao can read own institution" ON public.institutions;

CREATE POLICY "Delegacao can read own institution"
ON public.institutions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'delegacao'::app_role)
  AND id IN (
    SELECT d.institution_id
    FROM public.delegations d
    WHERE d.id = public.get_user_delegation_id(auth.uid())
  )
);

-- 2) Helper: verifica se o usuário pode acessar uma etapa específica.
--    Hoje retorna TRUE para qualquer perfil operacional do evento da etapa.
--    Servirá de base para enforcement RLS por etapa na Fase 4b (após backfill).
CREATE OR REPLACE FUNCTION public.user_can_access_stage(_user_id uuid, _stage_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_stages es
    WHERE es.id = _stage_id
      AND (
        public.has_role(_user_id, 'admin'::app_role)
        OR public.has_role(_user_id, 'super_admin'::app_role)
        OR public.has_role(_user_id, 'secretaria'::app_role)
        OR public.has_role(_user_id, 'coordenacao_tecnica'::app_role)
        OR public.has_role(_user_id, 'alojamento'::app_role)
        OR public.has_role(_user_id, 'alimentacao'::app_role)
        OR public.has_role(_user_id, 'transporte'::app_role)
        OR public.has_role(_user_id, 'coordenador_modalidade'::app_role)
        OR public.has_role(_user_id, 'delegacao'::app_role)
      )
  );
$$;

COMMENT ON FUNCTION public.user_can_access_stage IS
'Helper para verificar acesso a uma etapa. Atualmente permissivo (qualquer perfil operacional). Será restringido na Fase 4b após backfill de event_stage_id em todas as tabelas operacionais.';

-- 3) Auditoria: registrar conclusão da Fase 4a no audit_events.
INSERT INTO public.audit_events (action, table_name, record_id, payload)
VALUES (
  'rls_audit_phase4a',
  'event_stages',
  gen_random_uuid(),
  jsonb_build_object(
    'phase', '4a',
    'description', 'Helper user_can_access_stage criado; policy de institutions normalizada.',
    'next_phase', '4b: enforcement por etapa após backfill de event_stage_id'
  )
);
