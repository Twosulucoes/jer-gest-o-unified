-- 1. Adicionar coluna event_stage_id (nullable inicialmente para backfill)
ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS event_stage_id uuid REFERENCES public.event_stages(id);

-- 2. Backfill: vincular cada venue à primeira etapa ativa do seu evento (ordenada por sort_order)
UPDATE public.venues v
SET event_stage_id = sub.stage_id
FROM (
  SELECT DISTINCT ON (es.event_id)
    es.event_id,
    es.id AS stage_id
  FROM public.event_stages es
  WHERE es.status = 'active'
  ORDER BY es.event_id, es.sort_order ASC, es.created_at ASC
) sub
WHERE v.event_id = sub.event_id
  AND v.event_stage_id IS NULL;

-- 2b. Fallback: para eventos sem etapa ativa, usar a primeira etapa qualquer
UPDATE public.venues v
SET event_stage_id = sub.stage_id
FROM (
  SELECT DISTINCT ON (es.event_id)
    es.event_id,
    es.id AS stage_id
  FROM public.event_stages es
  ORDER BY es.event_id, es.sort_order ASC, es.created_at ASC
) sub
WHERE v.event_id = sub.event_id
  AND v.event_stage_id IS NULL;

-- 3. Tornar obrigatório (apenas se todos foram preenchidos)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.venues WHERE event_stage_id IS NULL) THEN
    ALTER TABLE public.venues ALTER COLUMN event_stage_id SET NOT NULL;
  END IF;
END $$;

-- 4. Trigger de validação: etapa deve pertencer ao mesmo evento
CREATE OR REPLACE FUNCTION public.validate_venue_stage_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_event uuid;
BEGIN
  IF NEW.event_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT event_id INTO stage_event
  FROM public.event_stages
  WHERE id = NEW.event_stage_id;

  IF stage_event IS NULL THEN
    RAISE EXCEPTION 'Etapa do evento não encontrada';
  END IF;

  IF stage_event <> NEW.event_id THEN
    RAISE EXCEPTION 'A etapa selecionada pertence a outro evento';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_venue_stage_event ON public.venues;
CREATE TRIGGER trg_validate_venue_stage_event
  BEFORE INSERT OR UPDATE ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_venue_stage_event();

-- 5. Índice para buscas por etapa
CREATE INDEX IF NOT EXISTS idx_venues_event_stage_id ON public.venues(event_stage_id);