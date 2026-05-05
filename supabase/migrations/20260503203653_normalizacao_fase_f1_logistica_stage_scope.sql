-- Fase F1 da Normalização (docs/dominio-canonico.md §2, §5, §8)
-- Aplica a lei de escopo do canônico ao quadrante 3 (Operação/Logística):
-- toda entidade de operação tem `event_stage_id NOT NULL`.
--
-- Mudanças nesta migration:
--   1. meal_types.event_stage_id → NOT NULL (backfill com primeiro stage
--      active do evento se houver linhas sem stage).
--   2. meal_locations.event_stage_id → NOT NULL (mesmo backfill).
--   3. service_vouchers ganha event_stage_id NOT NULL (ADD COLUMN, backfill
--      e SET NOT NULL). Voucher é "consumo da etapa" (canônico §11.5).
--
-- Sistema ainda não em produção; o backfill copia o stage active mais
-- antigo (sort_order asc) do evento da linha. Se não houver stage active,
-- a migration aborta — operador deve criar a etapa antes.

-- ============================================================
-- Helper: backfill_event_stage(t)
--   Para cada linha de t com event_stage_id IS NULL e event_id NOT NULL,
--   preenche com o primeiro event_stage active do evento.
-- ============================================================

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  -- 1. meal_types
  UPDATE public.meal_types AS mt
  SET event_stage_id = es.id
  FROM (
    SELECT DISTINCT ON (event_id) id, event_id
    FROM public.event_stages
    WHERE status = 'active'
    ORDER BY event_id, sort_order ASC, created_at ASC
  ) es
  WHERE mt.event_stage_id IS NULL AND mt.event_id = es.event_id;

  SELECT COUNT(*) INTO orphan_count FROM public.meal_types WHERE event_stage_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION '% meal_types sem event_stage_id e sem event_stage active no evento — limpe ou crie a etapa antes.', orphan_count;
  END IF;

  -- 2. meal_locations
  UPDATE public.meal_locations AS ml
  SET event_stage_id = es.id
  FROM (
    SELECT DISTINCT ON (event_id) id, event_id
    FROM public.event_stages
    WHERE status = 'active'
    ORDER BY event_id, sort_order ASC, created_at ASC
  ) es
  WHERE ml.event_stage_id IS NULL AND ml.event_id = es.event_id;

  SELECT COUNT(*) INTO orphan_count FROM public.meal_locations WHERE event_stage_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION '% meal_locations sem event_stage_id e sem event_stage active no evento — limpe ou crie a etapa antes.', orphan_count;
  END IF;
END $$;

-- ============================================================
-- 3. SET NOT NULL em meal_types e meal_locations
-- ============================================================
ALTER TABLE public.meal_types     ALTER COLUMN event_stage_id SET NOT NULL;
ALTER TABLE public.meal_locations ALTER COLUMN event_stage_id SET NOT NULL;

-- ============================================================
-- 4. service_vouchers: ADD COLUMN + backfill + NOT NULL
-- ============================================================
ALTER TABLE public.service_vouchers
  ADD COLUMN IF NOT EXISTS event_stage_id UUID;

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  UPDATE public.service_vouchers AS sv
  SET event_stage_id = es.id
  FROM (
    SELECT DISTINCT ON (event_id) id, event_id
    FROM public.event_stages
    WHERE status = 'active'
    ORDER BY event_id, sort_order ASC, created_at ASC
  ) es
  WHERE sv.event_stage_id IS NULL AND sv.event_id = es.event_id;

  SELECT COUNT(*) INTO orphan_count FROM public.service_vouchers WHERE event_stage_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION '% service_vouchers sem event_stage_id e sem event_stage active no evento — limpe ou crie a etapa antes.', orphan_count;
  END IF;
END $$;

ALTER TABLE public.service_vouchers
  DROP CONSTRAINT IF EXISTS service_vouchers_event_stage_id_fkey;
ALTER TABLE public.service_vouchers
  ADD CONSTRAINT service_vouchers_event_stage_id_fkey
    FOREIGN KEY (event_stage_id) REFERENCES public.event_stages(id) ON DELETE RESTRICT;
ALTER TABLE public.service_vouchers ALTER COLUMN event_stage_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_vouchers_event_stage_id
  ON public.service_vouchers (event_stage_id);

-- Cobertura por etapa para o uso de voucher (importante para queries
-- de relatório por etapa).
COMMENT ON COLUMN public.service_vouchers.event_stage_id IS
  'Etapa em que o voucher é válido. Voucher é consumo da etapa (canônico §11.5).';
