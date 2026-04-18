-- Add competition phase and custom questions config to pesquisa_events
ALTER TABLE public.pesquisa_events
  ADD COLUMN IF NOT EXISTS event_stage_id uuid REFERENCES public.event_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS questions_config jsonb DEFAULT NULL;

-- Index for phase lookups
CREATE INDEX IF NOT EXISTS idx_pesquisa_events_stage ON public.pesquisa_events (event_stage_id)
  WHERE event_stage_id IS NOT NULL;

-- Public RPC: return event config (questions + phase) for the PWA
-- Called with anon key; event_id comes from the validated session stored on device.
CREATE OR REPLACE FUNCTION public.pesquisa_get_event_config(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'questions_config', e.questions_config,
      'event_stage', CASE
        WHEN e.event_stage_id IS NOT NULL THEN (
          SELECT jsonb_build_object('id', es.id, 'name', es.name, 'kind', es.kind)
          FROM public.event_stages es
          WHERE es.id = e.event_stage_id
        )
        ELSE NULL
      END
    )
    FROM public.pesquisa_events e
    WHERE e.id = p_event_id AND e.active = true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pesquisa_get_event_config(uuid) TO anon, authenticated;
