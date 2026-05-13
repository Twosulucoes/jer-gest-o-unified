-- Corrige contradição: ON DELETE SET NULL + NOT NULL em meal_types e meal_locations.
-- SET NULL tornaria event_stage_id NULL ao deletar um event_stage, mas NOT NULL impede.
-- Comportamento correto: RESTRICT — bloqueia a deleção de etapa que ainda tem
-- tipos ou locais de refeição vinculados.

ALTER TABLE public.meal_types
  DROP CONSTRAINT IF EXISTS meal_types_event_stage_id_fkey;

ALTER TABLE public.meal_types
  ADD CONSTRAINT meal_types_event_stage_id_fkey
  FOREIGN KEY (event_stage_id) REFERENCES public.event_stages(id) ON DELETE RESTRICT;

ALTER TABLE public.meal_locations
  DROP CONSTRAINT IF EXISTS meal_locations_event_stage_id_fkey;

ALTER TABLE public.meal_locations
  ADD CONSTRAINT meal_locations_event_stage_id_fkey
  FOREIGN KEY (event_stage_id) REFERENCES public.event_stages(id) ON DELETE RESTRICT;
