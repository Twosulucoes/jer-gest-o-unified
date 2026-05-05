-- Fase F3 da Normalização (docs/dominio-canonico.md §6, §8)
-- Aplica a lei de escopo do canônico ao quadrante 4 EXECUTIVO:
-- competition_phases ganha event_stage_id NOT NULL.
--
-- Por quê: uma fase eliminatória pertence à etapa Caracaraí; a fase final
-- pertence à etapa de Boa Vista. Sem event_stage_id na phase, "fase
-- eliminatória de futsal" e "fase final de futsal" são ambíguas em
-- consultas e relatórios por etapa.
--
-- Backfill: cada phase recebe o primeiro event_stage active (sort_order
-- asc) do evento. Sistema sem produção; aborta se algum órfão restar.

-- ============================================================
-- 1. ADD COLUMN nullable
-- ============================================================
ALTER TABLE public.competition_phases
  ADD COLUMN IF NOT EXISTS event_stage_id UUID;

-- ============================================================
-- 2. Backfill com primeiro stage active do evento
-- ============================================================
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  UPDATE public.competition_phases AS cp
  SET event_stage_id = es.id
  FROM (
    SELECT DISTINCT ON (event_id) id, event_id
    FROM public.event_stages
    WHERE status = 'active'
    ORDER BY event_id, sort_order ASC, created_at ASC
  ) es
  WHERE cp.event_stage_id IS NULL AND cp.event_id = es.event_id;

  SELECT COUNT(*) INTO orphan_count
    FROM public.competition_phases
    WHERE event_stage_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      '% competition_phases sem event_stage_id e sem event_stage active no evento — limpe ou crie a etapa antes.',
      orphan_count;
  END IF;
END $$;

-- ============================================================
-- 3. FK + NOT NULL + INDEX
-- ============================================================
ALTER TABLE public.competition_phases
  DROP CONSTRAINT IF EXISTS competition_phases_event_stage_id_fkey;
ALTER TABLE public.competition_phases
  ADD CONSTRAINT competition_phases_event_stage_id_fkey
    FOREIGN KEY (event_stage_id) REFERENCES public.event_stages(id) ON DELETE RESTRICT;

ALTER TABLE public.competition_phases
  ALTER COLUMN event_stage_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competition_phases_event_stage_id
  ON public.competition_phases (event_stage_id);

COMMENT ON COLUMN public.competition_phases.event_stage_id IS
  'Etapa em que a fase ocorre. NOT NULL desde a Fase F3 (canônico §6).';
