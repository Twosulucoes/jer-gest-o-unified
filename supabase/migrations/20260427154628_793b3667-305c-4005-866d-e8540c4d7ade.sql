ALTER TABLE public.credential_scans 
ADD COLUMN IF NOT EXISTS legacy_format BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_credential_scans_legacy_format ON public.credential_scans(legacy_format) WHERE legacy_format = true;
