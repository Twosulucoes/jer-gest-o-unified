-- Fase A2 da Normalização (docs/dominio-canonico.md §3, §4, §8)
-- Move para `people` colunas que estão em `participants` mas representam
-- atributos cadastrais civis (atravessam eventos). Em seguida, remove
-- de `participants`. Sistema ainda não em produção; o backfill abaixo
-- copia o valor mais recente caso já exista algum dado de teste.
--
-- Colunas que migram (participants → people):
--   coach_name, coach_phone           — vínculo civil técnico/professor.
--   guardian_name, guardian_phone     — responsável legal.
--   eja_flag                          — Educação de Jovens e Adultos.
--   wheelchair_user_flag              — usa cadeira de rodas (acessibilidade).
--   national_ban_until                — banimento federal (atravessa eventos).
--   school_role_label                 — rótulo de papel escolar.
--
-- Colunas que somem sem migrar:
--   enrollment_date                   — redundante com `created_at`.

-- ============================================================
-- 1. ADD COLUMN em people
-- ============================================================
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS coach_name           TEXT,
  ADD COLUMN IF NOT EXISTS coach_phone          TEXT,
  ADD COLUMN IF NOT EXISTS guardian_name        TEXT,
  ADD COLUMN IF NOT EXISTS guardian_phone       TEXT,
  ADD COLUMN IF NOT EXISTS eja_flag             BOOLEAN,
  ADD COLUMN IF NOT EXISTS wheelchair_user_flag BOOLEAN,
  ADD COLUMN IF NOT EXISTS national_ban_until   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS school_role_label    TEXT;

COMMENT ON COLUMN public.people.coach_name IS
  'Técnico/professor responsável pela pessoa (cadastral civil; pode ser sobrescrito por evento via outras tabelas se necessário).';
COMMENT ON COLUMN public.people.guardian_name IS
  'Responsável legal (cadastral civil).';
COMMENT ON COLUMN public.people.eja_flag IS
  'Educação de Jovens e Adultos (cadastral escolar).';
COMMENT ON COLUMN public.people.wheelchair_user_flag IS
  'Acessibilidade — cadeira de rodas (cadastral civil).';
COMMENT ON COLUMN public.people.national_ban_until IS
  'Banimento federal vigente até esta data (cadastral civil; atravessa eventos).';

-- ============================================================
-- 2. Backfill: copia o valor mais recente de participants para people
--    (se houver). DISTINCT ON garante uma linha por person_id.
-- ============================================================
WITH last_per_person AS (
  SELECT DISTINCT ON (p.person_id)
    p.person_id,
    p.coach_name,
    p.coach_phone,
    p.guardian_name,
    p.guardian_phone,
    p.eja_flag,
    p.wheelchair_user_flag,
    p.national_ban_until,
    p.school_role_label
  FROM public.participants p
  WHERE
    p.coach_name IS NOT NULL
    OR p.coach_phone IS NOT NULL
    OR p.guardian_name IS NOT NULL
    OR p.guardian_phone IS NOT NULL
    OR p.eja_flag IS NOT NULL
    OR p.wheelchair_user_flag IS NOT NULL
    OR p.national_ban_until IS NOT NULL
    OR p.school_role_label IS NOT NULL
  ORDER BY p.person_id, p.updated_at DESC NULLS LAST, p.created_at DESC
)
UPDATE public.people pe
SET coach_name           = COALESCE(pe.coach_name,           lp.coach_name),
    coach_phone          = COALESCE(pe.coach_phone,          lp.coach_phone),
    guardian_name        = COALESCE(pe.guardian_name,        lp.guardian_name),
    guardian_phone       = COALESCE(pe.guardian_phone,       lp.guardian_phone),
    eja_flag             = COALESCE(pe.eja_flag,             lp.eja_flag),
    wheelchair_user_flag = COALESCE(pe.wheelchair_user_flag, lp.wheelchair_user_flag),
    national_ban_until   = COALESCE(pe.national_ban_until,   lp.national_ban_until),
    school_role_label    = COALESCE(pe.school_role_label,    lp.school_role_label)
FROM last_per_person lp
WHERE pe.id = lp.person_id;

-- ============================================================
-- 3. DROP COLUMN em participants (8 cadastrais migrados + enrollment_date)
-- ============================================================
ALTER TABLE public.participants
  DROP COLUMN IF EXISTS coach_name,
  DROP COLUMN IF EXISTS coach_phone,
  DROP COLUMN IF EXISTS guardian_name,
  DROP COLUMN IF EXISTS guardian_phone,
  DROP COLUMN IF EXISTS eja_flag,
  DROP COLUMN IF EXISTS wheelchair_user_flag,
  DROP COLUMN IF EXISTS national_ban_until,
  DROP COLUMN IF EXISTS school_role_label,
  DROP COLUMN IF EXISTS enrollment_date;
