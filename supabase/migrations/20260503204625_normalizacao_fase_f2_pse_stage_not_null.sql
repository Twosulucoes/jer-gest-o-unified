-- Fase F2 da Normalização (docs/dominio-canonico.md §4, §8)
-- Aplica a lei de escopo do canônico ao quadrante 2 (Inscrição esportiva):
-- `participant_sport_events.event_stage_id` passa a ser NOT NULL e a
-- unicidade vira (participant_id, sport_event_id, event_stage_id) sem
-- COALESCE, refletindo a regra "uma linha por inscrição esportiva por
-- etapa".
--
-- Backfill: linhas sem event_stage_id recebem o primeiro stage active
-- (sort_order asc) do evento. Se não houver stage active no evento,
-- a migration aborta.
--
-- FK: troca ON DELETE SET NULL → ON DELETE RESTRICT (a coluna passa a
-- ser NOT NULL, então SET NULL ficaria incompatível).

-- ============================================================
-- 1. Backfill de event_stage_id
-- ============================================================
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  UPDATE public.participant_sport_events AS pse
  SET event_stage_id = es.id
  FROM public.participants p
  JOIN (
    SELECT DISTINCT ON (event_id) id, event_id
    FROM public.event_stages
    WHERE status = 'active'
    ORDER BY event_id, sort_order ASC, created_at ASC
  ) es ON es.event_id = p.event_id
  WHERE pse.event_stage_id IS NULL
    AND pse.participant_id = p.id;

  SELECT COUNT(*) INTO orphan_count
    FROM public.participant_sport_events
    WHERE event_stage_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      '% participant_sport_events sem event_stage_id e sem event_stage active no evento — limpe ou crie a etapa antes.',
      orphan_count;
  END IF;
END $$;

-- ============================================================
-- 2. Trocar FK para ON DELETE RESTRICT (coluna vai virar NOT NULL).
-- ============================================================
ALTER TABLE public.participant_sport_events
  DROP CONSTRAINT IF EXISTS participant_sport_events_event_stage_id_fkey;
ALTER TABLE public.participant_sport_events
  ADD CONSTRAINT participant_sport_events_event_stage_id_fkey
    FOREIGN KEY (event_stage_id) REFERENCES public.event_stages(id) ON DELETE RESTRICT;

-- ============================================================
-- 3. SET NOT NULL
-- ============================================================
ALTER TABLE public.participant_sport_events
  ALTER COLUMN event_stage_id SET NOT NULL;

-- ============================================================
-- 4. Substituir índice único legado (com COALESCE para zero-uuid) por
--    índice direto agora que a coluna é NOT NULL.
-- ============================================================
DROP INDEX IF EXISTS public.pse_participant_sport_stage_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS uq_participant_sport_event_stage
  ON public.participant_sport_events
  (participant_id, sport_event_id, event_stage_id);

COMMENT ON COLUMN public.participant_sport_events.event_stage_id IS
  'Etapa em que a inscrição esportiva é válida (canônico §4). NOT NULL desde a Fase F2.';
