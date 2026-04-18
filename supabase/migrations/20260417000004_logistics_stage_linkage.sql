-- ============================================================
-- Vincula toda a estrutura logística a uma etapa da competição
-- event_stage_id nullable para compatibilidade com dados antigos
-- ============================================================

ALTER TABLE public.transport_vehicles
  ADD COLUMN IF NOT EXISTS event_stage_id uuid REFERENCES public.event_stages(id) ON DELETE SET NULL;

ALTER TABLE public.transport_routes
  ADD COLUMN IF NOT EXISTS event_stage_id uuid REFERENCES public.event_stages(id) ON DELETE SET NULL;

ALTER TABLE public.transport_trips
  ADD COLUMN IF NOT EXISTS event_stage_id uuid REFERENCES public.event_stages(id) ON DELETE SET NULL;

ALTER TABLE public.meal_types
  ADD COLUMN IF NOT EXISTS event_stage_id uuid REFERENCES public.event_stages(id) ON DELETE SET NULL;

ALTER TABLE public.meal_windows
  ADD COLUMN IF NOT EXISTS event_stage_id uuid REFERENCES public.event_stages(id) ON DELETE SET NULL;

ALTER TABLE public.lodging_locations
  ADD COLUMN IF NOT EXISTS event_stage_id uuid REFERENCES public.event_stages(id) ON DELETE SET NULL;

ALTER TABLE public.lodging_units
  ADD COLUMN IF NOT EXISTS event_stage_id uuid REFERENCES public.event_stages(id) ON DELETE SET NULL;

ALTER TABLE public.lodging_occupancies
  ADD COLUMN IF NOT EXISTS event_stage_id uuid REFERENCES public.event_stages(id) ON DELETE SET NULL;

-- Índices para performance nas consultas por etapa
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_stage  ON public.transport_vehicles(event_stage_id)  WHERE event_stage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transport_routes_stage    ON public.transport_routes(event_stage_id)    WHERE event_stage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transport_trips_stage     ON public.transport_trips(event_stage_id)     WHERE event_stage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meal_types_stage          ON public.meal_types(event_stage_id)          WHERE event_stage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meal_windows_stage        ON public.meal_windows(event_stage_id)        WHERE event_stage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lodging_locations_stage   ON public.lodging_locations(event_stage_id)   WHERE event_stage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lodging_units_stage       ON public.lodging_units(event_stage_id)       WHERE event_stage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lodging_occupancies_stage ON public.lodging_occupancies(event_stage_id) WHERE event_stage_id IS NOT NULL;
