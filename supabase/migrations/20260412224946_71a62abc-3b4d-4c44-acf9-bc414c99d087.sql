
-- Adicionar campos de liberação para pré-validação
ALTER TABLE public.sport_event_rules
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_by uuid;

-- Índice para filtrar provas liberadas rapidamente
CREATE INDEX IF NOT EXISTS idx_sport_event_rules_released
  ON public.sport_event_rules (released_at)
  WHERE released_at IS NOT NULL;
