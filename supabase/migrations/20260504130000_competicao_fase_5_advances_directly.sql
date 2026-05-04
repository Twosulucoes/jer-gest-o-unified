-- ============================================================
-- Auditoria de Competição Fase 5 — flag "classificado direto"
-- ============================================================
-- Auditoria: docs/auditoria-competicao.md (Fase 5)
--
-- Adiciona um marcador booleano em participant_sport_events e
-- teams indicando que o inscrito **classifica direto** (skipa a
-- fase classificatória e entra direto na próxima fase, ex:
-- semifinal/final).
--
-- Caso de uso real (regra do organizador):
--   - Modalidade com 1 único inscrito → ele já está classificado.
--   - Modalidade que classifica N direto + tem classificatória
--     pra disputar as vagas restantes (decisão manual do
--     organizador, não inferida automaticamente).
--
-- Default false: pode ser ativado pela UI no tab Inscritos.
-- ============================================================

-- A) participant_sport_events
ALTER TABLE public.participant_sport_events
  ADD COLUMN IF NOT EXISTS advances_directly boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS participant_sport_events_advances_idx
  ON public.participant_sport_events(sport_event_id)
  WHERE advances_directly IS TRUE;

COMMENT ON COLUMN public.participant_sport_events.advances_directly IS
  'Se TRUE, este inscrito classifica direto para a próxima fase (skipa classificatória). Decisão manual do organizador. Lido pelo gerador de chaves (Fase 6) para excluir o inscrito da chave classificatória.';

-- B) teams
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS advances_directly boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS teams_advances_idx
  ON public.teams(sport_event_id)
  WHERE advances_directly IS TRUE;

COMMENT ON COLUMN public.teams.advances_directly IS
  'Se TRUE, esta equipe classifica direto para a próxima fase (skipa classificatória). Decisão manual do organizador. Mesma semântica de participant_sport_events.advances_directly.';
