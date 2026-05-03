-- Etapa 2 da Auditoria do Módulo de Alimentação
-- Introduz o conceito de "saída antecipada do evento", independente de
-- alojamento, fechando a trava de presença para todos os caminhos de
-- registro de consumo de refeição.
--
-- Quando preenchido:
--   * left_event_at  : instante da saída registrada;
--   * left_event_reason : motivo (texto livre, sugestões na UI: desistência,
--     problema de saúde, convocação, outro);
--   * left_event_by  : auth.users.id de quem registrou a saída.
--
-- Regra de negócio (espelhada no trigger abaixo):
--   Pode consumir refeição em uma janela cuja service_date < left_event_at::date.
--   service_date >= left_event_at::date é bloqueado pelo banco.

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS left_event_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS left_event_reason TEXT,
  ADD COLUMN IF NOT EXISTS left_event_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.participants.left_event_at IS
  'Instante de saída antecipada do evento. Se preenchido, encerra a elegibilidade '
  'para serviços operacionais (ex.: alimentação) a partir da data informada.';

CREATE INDEX IF NOT EXISTS idx_participants_left_event_at
  ON public.participants (left_event_at)
  WHERE left_event_at IS NOT NULL;

-- =====================================================================
-- Trigger: bloqueia INSERT em meal_consumptions quando o participante já
-- registrou saída antecipada anterior à service_date da janela.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.check_meal_consumption_left_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_left_event_at TIMESTAMPTZ;
  v_service_date  DATE;
BEGIN
  SELECT left_event_at
    INTO v_left_event_at
    FROM public.participants
    WHERE id = NEW.participant_id;

  IF v_left_event_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT service_date
    INTO v_service_date
    FROM public.meal_windows
    WHERE id = NEW.meal_window_id;

  IF v_service_date IS NOT NULL AND v_service_date >= v_left_event_at::date THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = format(
        'Participante registrou saída antecipada do evento em %s; consumo bloqueado para a data %s.',
        to_char(v_left_event_at, 'DD/MM/YYYY HH24:MI'),
        to_char(v_service_date, 'DD/MM/YYYY')
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ck_meal_consumption_left_event ON public.meal_consumptions;
CREATE TRIGGER ck_meal_consumption_left_event
  BEFORE INSERT ON public.meal_consumptions
  FOR EACH ROW EXECUTE FUNCTION public.check_meal_consumption_left_event();
