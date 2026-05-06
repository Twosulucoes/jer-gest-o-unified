-- Auditoria PWA Alimentação (bloqueador 6): trigger de elegibilidade.
--
-- A trava de presença (`is_active`, `needs_meals`, `credentialed_at`)
-- existia apenas no PWA. Caminhos alternativos — INSERT direto via
-- Admin/Studio, sync da fila offline (que insere mais tarde, quando o
-- estado pode ter mudado), ou qualquer integração futura — passavam por
-- baixo da regra. Este trigger é o cinto e suspensório no banco,
-- complementando `ck_meal_consumption_left_event` da Etapa 2.
--
-- Comportamento:
--   * Bloqueia INSERT em `meal_consumptions` quando o participante:
--       - tem `is_active = false`;
--       - tem `needs_meals = false`;
--       - não tem `credentialed_at`.
--   * Mensagens claras para a UI mapear (já há toasts equivalentes no
--     scanner via `evaluateMealEligibility`).
--   * `SECURITY DEFINER` para ler `participants` ignorando RLS do
--     chamador, mantendo o mesmo padrão do trigger de saída antecipada.

CREATE OR REPLACE FUNCTION public.check_meal_consumption_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_active        BOOLEAN;
  v_needs_meals      BOOLEAN;
  v_credentialed_at  TIMESTAMPTZ;
BEGIN
  SELECT is_active, needs_meals, credentialed_at
    INTO v_is_active, v_needs_meals, v_credentialed_at
    FROM public.participants
    WHERE id = NEW.participant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Participante não encontrado para registro de consumo.';
  END IF;

  IF v_is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Participante está inativo; consumo bloqueado.';
  END IF;

  IF v_needs_meals IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Participante não declarou necessidade de alimentação; consumo bloqueado.';
  END IF;

  IF v_credentialed_at IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Participante sem credencial ativa; consumo bloqueado.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ck_meal_consumption_eligibility ON public.meal_consumptions;
CREATE TRIGGER ck_meal_consumption_eligibility
  BEFORE INSERT ON public.meal_consumptions
  FOR EACH ROW EXECUTE FUNCTION public.check_meal_consumption_eligibility();

COMMENT ON FUNCTION public.check_meal_consumption_eligibility() IS
  'Bloqueia INSERT em meal_consumptions quando o participante não atende '
  'aos critérios de presença efetiva (is_active, needs_meals, credentialed_at). '
  'Complementa ck_meal_consumption_left_event para fechar a trava no banco.';
