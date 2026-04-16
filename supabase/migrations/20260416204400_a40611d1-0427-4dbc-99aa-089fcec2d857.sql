ALTER TABLE public.import_logs 
  ADD COLUMN IF NOT EXISTS source_phase_name text,
  ADD COLUMN IF NOT EXISTS source_phase_slug text;

COMMENT ON COLUMN public.import_logs.source_phase_name IS 'Nome legível da etapa (denormalizado para auditoria histórica, ex.: "Caracaraí")';
COMMENT ON COLUMN public.import_logs.source_phase_slug IS 'Slug da etapa (denormalizado para auditoria histórica, ex.: "caracarai")';