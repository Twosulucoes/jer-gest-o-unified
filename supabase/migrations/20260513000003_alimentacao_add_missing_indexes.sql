-- Índices faltantes — seq scan em relatórios, timeline e foreign keys não indexadas
CREATE INDEX IF NOT EXISTS idx_meal_consumptions_participant
  ON meal_consumptions(participant_id);

CREATE INDEX IF NOT EXISTS idx_meal_consumptions_registered_by
  ON meal_consumptions(registered_by);

CREATE INDEX IF NOT EXISTS idx_meal_consumptions_window_time
  ON meal_consumptions(meal_window_id, consumed_at DESC);

CREATE INDEX IF NOT EXISTS idx_meal_incidents_window
  ON meal_incidents(meal_window_id);

CREATE INDEX IF NOT EXISTS idx_meal_incidents_participant
  ON meal_incidents(participant_id);

CREATE INDEX IF NOT EXISTS idx_meal_locations_event
  ON meal_locations(event_id);

CREATE INDEX IF NOT EXISTS idx_meal_window_patterns_event
  ON meal_window_patterns(event_id);
