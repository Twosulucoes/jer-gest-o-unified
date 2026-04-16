-- =========================================================
-- Fase 0: event_stages + participant_event_stages + colunas
-- =========================================================

-- 1) event_stages
CREATE TABLE IF NOT EXISTS public.event_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  kind text NOT NULL DEFAULT 'classificatoria', -- classificatoria | semifinal | final | legado | outro
  sort_order int NOT NULL DEFAULT 0,
  starts_at date NULL,
  ends_at date NULL,
  status text NOT NULL DEFAULT 'active', -- active | archived
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL,
  CONSTRAINT event_stages_event_slug_uniq UNIQUE (event_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_event_stages_event ON public.event_stages(event_id);

ALTER TABLE public.event_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_stages_admin_all" ON public.event_stages;
CREATE POLICY "event_stages_admin_all" ON public.event_stages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'secretaria'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'secretaria'));

DROP POLICY IF EXISTS "event_stages_read_all_authenticated" ON public.event_stages;
CREATE POLICY "event_stages_read_all_authenticated" ON public.event_stages
  FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_event_stages_updated_at
  BEFORE UPDATE ON public.event_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) participant_event_stages
CREATE TABLE IF NOT EXISTS public.participant_event_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  event_stage_id uuid NOT NULL REFERENCES public.event_stages(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  CONSTRAINT pes_participant_stage_uniq UNIQUE (participant_id, event_stage_id)
);

CREATE INDEX IF NOT EXISTS idx_pes_event_stage ON public.participant_event_stages(event_stage_id);
CREATE INDEX IF NOT EXISTS idx_pes_participant ON public.participant_event_stages(participant_id);

ALTER TABLE public.participant_event_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pes_admin_all" ON public.participant_event_stages;
CREATE POLICY "pes_admin_all" ON public.participant_event_stages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'secretaria'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'secretaria'));

DROP POLICY IF EXISTS "pes_read_authenticated" ON public.participant_event_stages;
CREATE POLICY "pes_read_authenticated" ON public.participant_event_stages
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_pes_updated_at
  BEFORE UPDATE ON public.participant_event_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.1) Trigger validando coerência stage <-> event
CREATE OR REPLACE FUNCTION public.validate_pes_event_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_event uuid;
  v_participant_event uuid;
BEGIN
  SELECT event_id INTO v_stage_event FROM public.event_stages WHERE id = NEW.event_stage_id;
  SELECT event_id INTO v_participant_event FROM public.participants WHERE id = NEW.participant_id;
  IF v_stage_event IS NULL OR v_participant_event IS NULL THEN
    RAISE EXCEPTION 'event_stage_id ou participant_id inválido';
  END IF;
  IF v_stage_event <> NEW.event_id OR v_participant_event <> NEW.event_id THEN
    RAISE EXCEPTION 'event_stage_id e participant_id devem pertencer ao mesmo event_id (%).', NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pes_validate_event ON public.participant_event_stages;
CREATE TRIGGER trg_pes_validate_event
  BEFORE INSERT OR UPDATE ON public.participant_event_stages
  FOR EACH ROW EXECUTE FUNCTION public.validate_pes_event_consistency();

-- 3) Adicionar event_stage_id em import_logs / import_pendencias / participant_sport_events
ALTER TABLE public.import_logs
  ADD COLUMN IF NOT EXISTS event_stage_id uuid NULL REFERENCES public.event_stages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_import_logs_stage ON public.import_logs(event_stage_id);

ALTER TABLE public.import_pendencias
  ADD COLUMN IF NOT EXISTS event_stage_id uuid NULL REFERENCES public.event_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_phase_name text NULL,
  ADD COLUMN IF NOT EXISTS source_phase_slug text NULL;
CREATE INDEX IF NOT EXISTS idx_import_pendencias_stage ON public.import_pendencias(event_stage_id);

ALTER TABLE public.participant_sport_events
  ADD COLUMN IF NOT EXISTS event_stage_id uuid NULL REFERENCES public.event_stages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pse_event_stage ON public.participant_sport_events(event_stage_id);

-- 4) Trocar unicidade do PSE para (participant_id, sport_event_id, event_stage_id)
--    Mantém comportamento legado (NULL) através de índice parcial.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.participant_sport_events'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%participant_id%sport_event_id%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%event_stage_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.participant_sport_events DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Drop possíveis índices únicos antigos equivalentes
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'participant_sport_events'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%participant_id%sport_event_id%'
      AND indexdef NOT ILIKE '%event_stage_id%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indexname);
  END LOOP;
END $$;

-- Novo índice único: trata NULL como valor distinto via COALESCE para zero-uuid
CREATE UNIQUE INDEX IF NOT EXISTS pse_participant_sport_stage_uniq
  ON public.participant_sport_events (
    participant_id,
    sport_event_id,
    COALESCE(event_stage_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- 5) Backfill: criar stage 'legado' por evento e atribuir aos registros antigos
INSERT INTO public.event_stages (event_id, name, slug, kind, sort_order)
SELECT e.id, 'Legado', 'legado', 'legado', -1
FROM public.events e
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_stages s WHERE s.event_id = e.id AND s.slug = 'legado'
);

UPDATE public.import_logs il
SET event_stage_id = s.id
FROM public.event_stages s
WHERE il.event_stage_id IS NULL
  AND s.event_id = il.event_id
  AND s.slug = 'legado';

UPDATE public.import_pendencias ip
SET event_stage_id = s.id
FROM public.event_stages s
WHERE ip.event_stage_id IS NULL
  AND s.event_id = ip.event_id
  AND s.slug = 'legado';

UPDATE public.participant_sport_events pse
SET event_stage_id = s.id
FROM public.participants p
JOIN public.event_stages s ON s.event_id = p.event_id AND s.slug = 'legado'
WHERE pse.event_stage_id IS NULL
  AND pse.participant_id = p.id;