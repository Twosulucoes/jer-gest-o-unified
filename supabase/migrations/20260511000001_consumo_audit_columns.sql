-- Add audit/sync tracking columns to meal_consumptions.
-- is_offline: true when the record was registered while the device had no internet
-- sync_at: timestamp when the offline record was synced to the server (null = real-time)
-- device_info: browser/device metadata captured at registration time
-- duplicidade_detectada: flagged as a detected duplicate at insert time

ALTER TABLE meal_consumptions
  ADD COLUMN IF NOT EXISTS is_offline BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS device_info JSONB,
  ADD COLUMN IF NOT EXISTS duplicidade_detectada BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN meal_consumptions.is_offline IS 'true when registered offline; synced later via offline queue';
COMMENT ON COLUMN meal_consumptions.sync_at IS 'timestamp of sync from offline queue; null means real-time insert';
COMMENT ON COLUMN meal_consumptions.device_info IS 'browser/device metadata at registration time (userAgent, platform, online flag)';
COMMENT ON COLUMN meal_consumptions.duplicidade_detectada IS 'true when a duplicate consumption was detected and flagged at insert time';
