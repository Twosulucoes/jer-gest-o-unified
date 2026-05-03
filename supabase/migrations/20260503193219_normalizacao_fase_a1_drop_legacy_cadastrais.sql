-- Fase A1 da Normalização (docs/dominio-canonico.md §3, §8)
-- Remove de `participants` colunas cadastrais civis que já existem em `people`.
-- O sistema ainda não está em produção; não há backfill necessário.
--
-- Colunas removidas (todas duplicatas de people):
--   - birth_date     → use people.birth_date
--   - biological_sex → use people.gender
--   - disability_type → use people.disability_type
--
-- Auditoria de uso (feita antes da migration):
--   - import-inscricoes (Edge Function): grava em people, nunca em participants.
--   - PesquisaNovaPage (PWA): refatorada na mesma PR para JOIN com people.
--   - validate-qr (Edge Function): já lia de people via JOIN.
--   - PessoasPage: lê people diretamente.
--   - ParticipantResumoTab: lê people via prop person.
--
-- Cadastrais que continuam em participants nesta etapa (Fase A2):
--   coach_name/phone, guardian_name/phone, eja_flag,
--   wheelchair_user_flag, national_ban_until, enrollment_date,
--   school_role_label. Migrarão para people após criar as colunas
--   correspondentes lá.

ALTER TABLE public.participants
  DROP COLUMN IF EXISTS birth_date,
  DROP COLUMN IF EXISTS biological_sex,
  DROP COLUMN IF EXISTS disability_type;
