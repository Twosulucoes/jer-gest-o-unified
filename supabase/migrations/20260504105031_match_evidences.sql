-- ============================================================
-- Lançamento simplificado de evidências de partida
-- ============================================================
-- Tabela `public.match_evidences` para anexar à uma partida:
--   - Súmula (PDF)
--   - Fotos (evidência fotográfica)
--   - Relatório livre (texto)
--   - Outros documentos
--
-- Schema decisão: em `public` (não em arbitragem.*) para que possa
-- ser consumida diretamente pelo Supabase JS client sem RPC.
--
-- Buckets `sumulas` e `evidencias-partida` já foram criados na
-- migração de bootstrap do schema arbitragem.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.match_evidences (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     uuid NOT NULL,
  event_id     uuid NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('sumula','foto','relatorio','outro')),
  storage_bucket text,
  storage_path  text,
  file_name     text,
  mime_type     text,
  notes         text,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  uploaded_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_evidences_match_id_fkey') THEN
    ALTER TABLE public.match_evidences
      ADD CONSTRAINT match_evidences_match_id_fkey
      FOREIGN KEY (match_id) REFERENCES public.competition_matches(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_evidences_event_id_fkey') THEN
    ALTER TABLE public.match_evidences
      ADD CONSTRAINT match_evidences_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS match_evidences_match_idx
  ON public.match_evidences(match_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS match_evidences_event_type_idx
  ON public.match_evidences(event_id, evidence_type);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.match_evidences ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT polname FROM pg_policy WHERE polrelid = 'public.match_evidences'::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.match_evidences', r.polname);
  END LOOP;
END $$;

CREATE POLICY "match_evidences admin full access"
  ON public.match_evidences FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "match_evidences secretaria full access"
  ON public.match_evidences FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));

CREATE POLICY "match_evidences coord_tecnica full access"
  ON public.match_evidences FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));

-- Árbitros: podem CRIAR evidência só para partidas em que estão escalados,
-- e podem LER todas as evidências do evento.
CREATE POLICY "match_evidences arbitragem read"
  ON public.match_evidences FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'arbitragem'::public.app_role));

CREATE POLICY "match_evidences arbitragem insert own assignments"
  ON public.match_evidences FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'arbitragem'::public.app_role)
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.match_user_assignments mua
      WHERE mua.match_id = match_evidences.match_id
        AND mua.user_id = auth.uid()
    )
  );

-- Mesário: mesmas permissões que árbitro.
CREATE POLICY "match_evidences mesario read"
  ON public.match_evidences FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'mesario'::public.app_role));

CREATE POLICY "match_evidences mesario insert own assignments"
  ON public.match_evidences FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'mesario'::public.app_role)
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.match_user_assignments mua
      WHERE mua.match_id = match_evidences.match_id
        AND mua.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.match_evidences IS
  'Evidências anexadas a uma partida (súmula, fotos, relatório). Source-of-truth para upload de comprovantes do lançamento operacional. Não substitui competition_match_results (resultado oficial via rpc_launch_match_result).';
