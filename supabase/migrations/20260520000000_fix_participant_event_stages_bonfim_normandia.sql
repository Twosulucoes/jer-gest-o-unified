-- Correção de participant_event_stages para Bonfim e Normandia
--
-- Problema: em 14-15/05/2026 todos os 6.221 participantes do evento foram
-- importados em massa para ambas as etapas (Bonfim e Normandia), quando cada
-- participante pertence somente à sua etapa específica.
--
-- Critério de remoção (por etapa):
--   - Participante NÃO tem participant_sport_events nessa etapa
--   - E também NÃO tem consumo de alimentação registrado nessa etapa
--
-- O que fica (legítimo):
--   - Atletas com inscrições em provas da etapa (participant_sport_events)
--   - Staff, técnicos, chefes de delegação, árbitros, etc. que consumiram
--     alimentação nessa etapa (presença confirmada via meal_consumptions)
--
-- Resultado esperado pós-migration:
--   Bonfim:    6.221 → 841  (730 atletas + 111 staff/técnicos/chefes)
--   Normandia: 6.221 → 559  (545 atletas + 14 staff/colaboradores/árbitros)

-- Bonfim / Cantá
DELETE FROM participant_event_stages
WHERE event_stage_id = '014641c9-ee48-4ee8-9556-5f9fc6bdf186'
  AND participant_id NOT IN (
    SELECT DISTINCT participant_id
    FROM participant_sport_events
    WHERE event_stage_id = '014641c9-ee48-4ee8-9556-5f9fc6bdf186'
  )
  AND participant_id NOT IN (
    SELECT DISTINCT mc.participant_id
    FROM meal_consumptions mc
    JOIN meal_windows mw ON mc.meal_window_id = mw.id
    WHERE mw.event_stage_id = '014641c9-ee48-4ee8-9556-5f9fc6bdf186'
  );

-- Normandia
DELETE FROM participant_event_stages
WHERE event_stage_id = '58c8ea06-4652-4099-8aed-c05b0838a7d1'
  AND participant_id NOT IN (
    SELECT DISTINCT participant_id
    FROM participant_sport_events
    WHERE event_stage_id = '58c8ea06-4652-4099-8aed-c05b0838a7d1'
  )
  AND participant_id NOT IN (
    SELECT DISTINCT mc.participant_id
    FROM meal_consumptions mc
    JOIN meal_windows mw ON mc.meal_window_id = mw.id
    WHERE mw.event_stage_id = '58c8ea06-4652-4099-8aed-c05b0838a7d1'
  );
