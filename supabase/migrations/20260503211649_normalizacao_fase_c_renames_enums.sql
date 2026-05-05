-- Fase C da Normalização (docs/dominio-canonico.md §4, §8)
-- Renomeia ambiguidades e converte CHECK em enum forte.
--
-- C1: participants.category → participants.enrollment_class
--    (evita colisão com a tabela `categories` — faixa etária/gênero).
--    O TYPE existente `participant_category` (delegation/organization)
--    é mantido por simplicidade.
--
-- C2: já feito anteriormente (20260422040921 criou o enum
--    `match_result_status`). Sem operação aqui — apenas documentação.
--
-- C3: participants.participant_type passa de TEXT + CHECK para um enum
--    `participant_type` com os 19 valores em uso.
--    Razão: a CHECK constraint listava apenas 5 valores originais; as
--    migrations seguintes ampliaram para 19 sem virar enum. Operadores
--    digitavam strings sem auto-complete e com risco de typo.
--
-- Sistema sem produção; sem backfill defensivo.

-- ============================================================
-- C1. Renomear participants.category → participants.enrollment_class
-- ============================================================
ALTER TABLE public.participants
  RENAME COLUMN category TO enrollment_class;

COMMENT ON COLUMN public.participants.enrollment_class IS
  'Classe da inscrição: delegation (vinculada a escola) ou organization (apoio). '
  'Renomeado de "category" na Fase C para evitar colisão com a tabela `categories`.';

-- ============================================================
-- C3. participants.participant_type → enum participant_type
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'participant_type') THEN
    CREATE TYPE public.participant_type AS ENUM (
      'athlete',
      'coach',
      'head_of_delegation',
      'official',
      'staff',
      'motorista',
      'agente_operacao',
      'logistica',
      'cozinheira',
      'guia',
      'secretaria',
      'mesario',
      'arbitro',
      'delegado',
      'fiscal',
      'operador_pesquisa',
      'tecnico_ti',
      'terceiro',
      'colaborador'
    );
  END IF;
END $$;

-- 1) Drop constraint CHECK antiga
ALTER TABLE public.participants
  DROP CONSTRAINT IF EXISTS participants_participant_type_check;

-- 2) Drop default temporariamente para permitir o ALTER COLUMN TYPE
ALTER TABLE public.participants ALTER COLUMN participant_type DROP DEFAULT;

-- 3) Converte coluna para enum
ALTER TABLE public.participants
  ALTER COLUMN participant_type TYPE public.participant_type
  USING participant_type::public.participant_type;

-- 4) Restaura default tipado
ALTER TABLE public.participants
  ALTER COLUMN participant_type SET DEFAULT 'athlete'::public.participant_type;

COMMENT ON COLUMN public.participants.participant_type IS
  'Tipo da participação no evento. Enum desde a Fase C, com 19 valores que '
  'cobrem atletas, comissão técnica, organização e equipes operacionais.';
