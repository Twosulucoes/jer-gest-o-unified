-- ============================================================
-- Etapa 2.3 — Ativa CHECK (cpf OR rne) em referee_profiles
-- ============================================================
-- Auditoria: docs/modulos/arbitros-auditoria.md (Etapa 2.3)
--
-- O CHECK foi adiado da Etapa 2.1 porque o PWA RefereeProfilePage
-- permitia salvar com só full_name (e teria quebrado o primeiro Save
-- de árbitros novos). Agora que:
--   (a) o PWA valida CPF OU RNE antes do Save (RefereeProfilePage.tsx),
--   (b) a edge function `import-referees` rejeita linhas sem CPF e
--       sem RNE (validateRow),
-- podemos ativar o constraint.
--
-- Estratégia:
--   1. ADD CONSTRAINT ... NOT VALID (não bloqueia deploy se houver
--      linhas legadas sem CPF nem RNE).
--   2. VALIDATE CONSTRAINT (separado): roda uma única vez para validar
--      todas as linhas; se falhar, devs precisam corrigir as linhas
--      legadas manualmente (consulta abaixo).
--
-- Para encontrar linhas órfãs antes do VALIDATE:
--   SELECT id, full_name, email FROM referee_profiles
--   WHERE cpf IS NULL AND rne IS NULL;
-- ============================================================

-- 1. Adiciona o constraint sem validar linhas existentes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'referee_profiles_cpf_or_rne_required'
  ) THEN
    ALTER TABLE public.referee_profiles
      ADD CONSTRAINT referee_profiles_cpf_or_rne_required
      CHECK (cpf IS NOT NULL OR rne IS NOT NULL) NOT VALID;
  END IF;
END $$;

-- 2. Tenta validar as linhas existentes. Se falhar (linhas legadas
--    sem CPF e sem RNE), o erro é capturado e logado como NOTICE,
--    mantendo o constraint NOT VALID. INSERTs e UPDATEs futuros
--    continuam sendo enforceados.
DO $$
BEGIN
  ALTER TABLE public.referee_profiles
    VALIDATE CONSTRAINT referee_profiles_cpf_or_rne_required;
  RAISE NOTICE 'CHECK referee_profiles_cpf_or_rne_required validado em todas as linhas existentes.';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'Linhas legadas em referee_profiles sem CPF e sem RNE — constraint mantido como NOT VALID. Corrija e rode manualmente: ALTER TABLE referee_profiles VALIDATE CONSTRAINT referee_profiles_cpf_or_rne_required;';
END $$;

COMMENT ON CONSTRAINT referee_profiles_cpf_or_rne_required ON public.referee_profiles IS
  'Aceita estrangeiros com RNE sem CPF. Aplicado na Etapa 2.3 da auditoria de Arbitragem após edge function import-referees + PWA validarem o invariante.';
