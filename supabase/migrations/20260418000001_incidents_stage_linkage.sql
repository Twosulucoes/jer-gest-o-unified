-- Add event_stage_id to operational_incidents for per-stage isolation
ALTER TABLE public.operational_incidents
  ADD COLUMN IF NOT EXISTS event_stage_id UUID REFERENCES public.event_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_operational_incidents_stage
  ON public.operational_incidents(event_stage_id);
