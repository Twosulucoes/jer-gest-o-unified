-- ============================================================================
-- ALIMENTAÇÃO — Enum de motivos de estorno
-- Idempotente: cria apenas se não existir.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_consumption_reverse_reason') THEN
    CREATE TYPE public.meal_consumption_reverse_reason AS ENUM (
      'duplicidade',
      'participante_errado',
      'janela_errada',
      'lancamento_acidental',
      'incidente_operacional'
    );
  END IF;
END $$;

COMMENT ON TYPE public.meal_consumption_reverse_reason IS
  'Motivos canônicos de estorno/cancelamento de consumo de refeição.';
