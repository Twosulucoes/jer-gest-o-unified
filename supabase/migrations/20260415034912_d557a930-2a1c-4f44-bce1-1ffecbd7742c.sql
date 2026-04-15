ALTER TABLE public.transport_passengers
  ADD COLUMN IF NOT EXISTS no_show BOOLEAN NOT NULL DEFAULT false;