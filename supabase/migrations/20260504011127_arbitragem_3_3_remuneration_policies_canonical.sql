-- ============================================================
-- Etapa 3.3 — Padronizar policies de referee_remuneration_configs
-- ============================================================
-- Auditoria: docs/modulos/arbitros-auditoria.md (Etapa 3)
--
-- Hoje a tabela usa `EXISTS (SELECT FROM user_roles WHERE ...)`,
-- divergente do padrão canônico do projeto que é `has_role()` +
-- `app_role`. Esta migração troca para o padrão.
--
-- Decisão sobre `public.match_officials`: NÃO removida.
-- Confirmado via grep que tem 4 leitores ativos no front:
--   - src/components/admin/MatchOfficialsCard.tsx
--   - src/components/admin/MatchSummaryDialog.tsx
--   - src/components/admin/IndividualMatchSummaryDialog.tsx
--   - src/hooks/useLancamentoResultados.ts
-- Não é resíduo — é um conceito separado: officials informais por
-- nome (sem vínculo a auth.users nem a arbitragem.officials).
-- Mantida como está; decisão registrada na auditoria.
-- ============================================================

-- Drop policies antigas
DROP POLICY IF EXISTS "Admin full access to remuneration configs" ON public.referee_remuneration_configs;
DROP POLICY IF EXISTS "Others read-only access to remuneration configs" ON public.referee_remuneration_configs;

-- Policies canônicas via has_role + app_role
CREATE POLICY "referee_remuneration_configs admin full access"
  ON public.referee_remuneration_configs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "referee_remuneration_configs secretaria read"
  ON public.referee_remuneration_configs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role));

CREATE POLICY "referee_remuneration_configs coord_tecnica read"
  ON public.referee_remuneration_configs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));

CREATE POLICY "referee_remuneration_configs coord_modalidade read"
  ON public.referee_remuneration_configs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenador_modalidade'::public.app_role));
