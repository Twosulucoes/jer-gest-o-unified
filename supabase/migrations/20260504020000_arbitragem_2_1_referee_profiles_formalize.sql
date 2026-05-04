-- ============================================================
-- Etapa 2.1 — Formalização de referee_profiles + RLS
-- ============================================================
-- Auditoria: docs/modulos/arbitros-auditoria.md (Etapa 2.1)
--
-- Objetivos:
--   1. Versionar `referee_profiles` no repositório (até hoje só existia
--      no banco, sem migração rastreável — gap crítico de PII).
--   2. Adicionar coluna `person_id` (FK -> people.id), populada na 2.3.
--   3. Adicionar `CHECK (cpf IS NOT NULL OR rne IS NOT NULL)` para
--      suportar árbitros estrangeiros (RNE) sem CPF.
--   4. Constraints de unicidade e FK ausentes hoje.
--   5. Habilitar RLS com políticas baseadas em `has_role()`.
--
-- Idempotência: tudo via IF NOT EXISTS / DO blocks, seguro de rodar em
-- ambientes onde a tabela já existe (produção atual).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabela (retroativa)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  person_id UUID,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  rg TEXT,
  rne TEXT,
  rne_validity DATE,
  birth_date DATE,
  gender TEXT,
  nationality TEXT,
  pis_pasep TEXT,
  zip_code TEXT,
  street_address TEXT,
  address_complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  bank_name TEXT,
  bank_branch TEXT,
  bank_account TEXT,
  modalities TEXT,
  categories TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  registration_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2. Coluna person_id (FK -> people) — nullable até a Etapa 2.3
-- ------------------------------------------------------------
ALTER TABLE public.referee_profiles
  ADD COLUMN IF NOT EXISTS person_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'referee_profiles_person_id_fkey'
  ) THEN
    ALTER TABLE public.referee_profiles
      ADD CONSTRAINT referee_profiles_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. FK user_id -> auth.users (estava implícita)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'referee_profiles_user_id_fkey'
  ) THEN
    ALTER TABLE public.referee_profiles
      ADD CONSTRAINT referee_profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Constraints de identificação
--    - cpf único quando preenchido (parcial)
--    - user_id único quando preenchido
--
--    Nota: o CHECK (cpf IS NOT NULL OR rne IS NOT NULL) decidido na
--    auditoria fica para a Etapa 2.3, depois que:
--      (a) o importer canônico garantir que toda nova linha tem ao
--          menos um dos dois;
--      (b) a tela PWA RefereeProfilePage validar antes do Save.
--    Adicionar agora quebraria o primeiro Save de árbitro novo no PWA
--    (que hoje permite salvar só com full_name).
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS referee_profiles_cpf_unique
  ON public.referee_profiles(cpf)
  WHERE cpf IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS referee_profiles_user_id_unique
  ON public.referee_profiles(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS referee_profiles_person_id_idx
  ON public.referee_profiles(person_id)
  WHERE person_id IS NOT NULL;

-- ------------------------------------------------------------
-- 5. Trigger de updated_at
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS update_referee_profiles_updated_at ON public.referee_profiles;
CREATE TRIGGER update_referee_profiles_updated_at
  BEFORE UPDATE ON public.referee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 6. RLS — habilita e define políticas canônicas
-- ------------------------------------------------------------
ALTER TABLE public.referee_profiles ENABLE ROW LEVEL SECURITY;

-- Drop policies legadas que possam existir (cobre nomes diversos)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.referee_profiles'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.referee_profiles', r.polname);
  END LOOP;
END $$;

-- Admin: ALL
CREATE POLICY "referee_profiles admin full access"
  ON public.referee_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Secretaria: ALL
CREATE POLICY "referee_profiles secretaria full access"
  ON public.referee_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));

-- Coordenação técnica: SELECT (escala precisa ler dados básicos)
CREATE POLICY "referee_profiles coord_tecnica read"
  ON public.referee_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));

-- Coordenador de modalidade: SELECT (também precisa para escalar)
CREATE POLICY "referee_profiles coord_modalidade read"
  ON public.referee_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenador_modalidade'::public.app_role));

-- Próprio árbitro: SELECT da própria linha
CREATE POLICY "referee_profiles own read"
  ON public.referee_profiles FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'arbitragem'::public.app_role)
    AND user_id = auth.uid()
  );

-- Próprio árbitro: UPDATE da própria linha (não pode trocar user_id)
CREATE POLICY "referee_profiles own update"
  ON public.referee_profiles FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'arbitragem'::public.app_role)
    AND user_id = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'arbitragem'::public.app_role)
    AND user_id = auth.uid()
  );

-- Próprio árbitro: INSERT da própria linha (PWA RefereeProfilePage usa
-- upsert; precisa permitir o INSERT do upsert quando ainda não existe)
CREATE POLICY "referee_profiles own insert"
  ON public.referee_profiles FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'arbitragem'::public.app_role)
    AND user_id = auth.uid()
  );

-- DELETE: somente admin (reforço explícito; já coberto pela policy ALL,
-- mas evita pegadinhas se algum dia trocarmos a policy de admin para
-- algo mais restritivo).
-- (não precisa de policy adicional — sem policy, INSERT/UPDATE/DELETE
-- ficam negados para quem não casa com nenhuma das policies acima.)

-- ------------------------------------------------------------
-- 7. Comentários (documentação inline)
-- ------------------------------------------------------------
COMMENT ON TABLE public.referee_profiles IS
  'Cadastro técnico de árbitros. Quadrante: Pessoa (master). Vinculada a auth.users (user_id) e people (person_id, populado na Etapa 2.3 da auditoria de arbitragem).';
COMMENT ON COLUMN public.referee_profiles.person_id IS
  'FK opcional para people. Populada pela importação canônica (Etapa 2.3). Permite que o mesmo CPF seja reutilizado quando a pessoa já existe como atleta/coach.';
