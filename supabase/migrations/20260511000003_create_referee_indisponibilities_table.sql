-- Cria tabela referee_indisponibilities que existia apenas em produção (criada via dashboard).
-- Necessário antes de 20260511000010 que aplica políticas RLS nesta tabela.

CREATE TABLE IF NOT EXISTS public.referee_indisponibilities (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referee_id      uuid,
  event_stage_id  uuid,
  start_date      timestamptz,
  end_date        timestamptz,
  reason          text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.referee_indisponibilities ENABLE ROW LEVEL SECURITY;
