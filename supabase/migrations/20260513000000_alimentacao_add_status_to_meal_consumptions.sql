-- Adiciona coluna status a meal_consumptions e recria o índice único
-- como parcial (WHERE status = 'active') para suportar estornos (status='revoked')
-- sem violar a restrição de unicidade por janela.
--
-- Necessário antes de 20260513000004 (RPC record_meal_consumption) que
-- insere com status='active' e usa ON CONFLICT (meal_window_id, participant_id)
-- WHERE (status = 'active').

-- 1. Adiciona coluna status (default 'active' para linhas existentes)
ALTER TABLE public.meal_consumptions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'revoked'));

-- 2. Remove índice único completo (não suporta múltiplos registros por janela
--    quando status != 'active')
DROP INDEX IF EXISTS uq_meal_consumption_participant_window;

-- 3. Cria índice único parcial — apenas um consumo 'active' por participante/janela
CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_consumptions_active_window
  ON public.meal_consumptions (meal_window_id, participant_id)
  WHERE (status = 'active');
