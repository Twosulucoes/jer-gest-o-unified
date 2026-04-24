-- Migration: separate participants into Delegação and Organização
DO $$ BEGIN
    CREATE TYPE public.participant_category AS ENUM ('delegation', 'organization');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS category public.participant_category NOT NULL DEFAULT 'delegation',
  ADD COLUMN IF NOT EXISTS organization_subtype text,
  ADD COLUMN IF NOT EXISTS role_function text,
  ADD COLUMN IF NOT EXISTS sector_area text,
  ADD COLUMN IF NOT EXISTS responsibilities text,
  ADD COLUMN IF NOT EXISTS access_permissions text,
  ADD COLUMN IF NOT EXISTS observations text;

-- Update existing participants
UPDATE public.participants
SET category = 'organization'
WHERE participant_type IN (
  'motorista','agente_operacao','logistica','cozinheira','guia',
  'secretaria','mesario','arbitro','delegado','fiscal',
  'operador_pesquisa','tecnico_ti','terceiro','colaborador'
);

-- Note: Existing RLS policies might need to be adjusted via a separate migration or here.
-- But the system might auto-apply migrations if I create the file.
