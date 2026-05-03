-- Fase B3 da Normalização (docs/dominio-canonico.md §3, §4, §8)
-- Conclui a desfusão delegations × institutions:
--   * remove os 3 triggers bidirecionais de sincronia espelhada
--   * remove as 3 functions associadas
--   * remove o índice único delegations_school_slug_event_key
--   * remove as 11 colunas `school_*` de `delegations`
--
-- Após esta migration:
--   - `institutions` é cadastro mestre civil (canônico).
--   - `delegations` carrega só o vínculo evento×instituição + chefia + status + notes.
--   - Toda leitura/escrita do nome da escola passa por `institutions(name)`.
--
-- Pré-requisitos (já cumpridos):
--   * Fase B1: 27 arquivos passaram a ler institutions(name) via JOIN.
--   * Fase B2: DelegationFormDialog + DelegacoesPage escrevem direto em
--     institutions e delegations sem dependência das colunas espelhadas.
--
-- Sistema ainda não em produção; sem backfill defensivo.

-- ============================================================
-- 1. Remover triggers de sincronia
-- ============================================================
DROP TRIGGER IF EXISTS trg_delegations_autocreate_institution ON public.delegations;
DROP TRIGGER IF EXISTS trg_delegations_sync_to_institution    ON public.delegations;
DROP TRIGGER IF EXISTS trg_institutions_sync_to_delegations   ON public.institutions;

-- ============================================================
-- 2. Remover functions associadas
-- ============================================================
DROP FUNCTION IF EXISTS public.delegations_autocreate_institution();
DROP FUNCTION IF EXISTS public.delegations_sync_to_institution();
DROP FUNCTION IF EXISTS public.institutions_sync_to_delegations();

-- ============================================================
-- 3. Remover índice único legado
-- ============================================================
DROP INDEX IF EXISTS public.delegations_school_slug_event_key;

-- ============================================================
-- 4. DROP COLUMN das 11 colunas espelhadas
-- ============================================================
ALTER TABLE public.delegations
  DROP COLUMN IF EXISTS school_name,
  DROP COLUMN IF EXISTS school_official_name,
  DROP COLUMN IF EXISTS school_slug,
  DROP COLUMN IF EXISTS school_network_type,
  DROP COLUMN IF EXISTS school_city,
  DROP COLUMN IF EXISTS school_state,
  DROP COLUMN IF EXISTS school_district,
  DROP COLUMN IF EXISTS school_contact_name,
  DROP COLUMN IF EXISTS school_contact_phone,
  DROP COLUMN IF EXISTS school_contact_email,
  DROP COLUMN IF EXISTS school_is_active;
