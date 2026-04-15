
-- Add driver assignment and trip lifecycle columns
ALTER TABLE public.transport_trips
  ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS driver_checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trip_status TEXT NOT NULL DEFAULT 'scheduled';

-- Add validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_trip_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.trip_status NOT IN ('scheduled', 'in_progress', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid trip_status: %', NEW.trip_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_trip_status
  BEFORE INSERT OR UPDATE ON public.transport_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_trip_status();

-- Index for fast lookups by driver
CREATE INDEX IF NOT EXISTS idx_transport_trips_driver ON public.transport_trips(assigned_driver_id);

-- RLS policy: allow update only if trip has no driver assigned OR the current user is the assigned driver
-- First drop any existing update policies that might conflict
DO $$
BEGIN
  -- Drop existing update policies if any
  DROP POLICY IF EXISTS "transport_trips_update_driver" ON public.transport_trips;
END;
$$;

CREATE POLICY "transport_trips_update_driver"
  ON public.transport_trips
  FOR UPDATE
  TO authenticated
  USING (
    assigned_driver_id IS NULL
    OR assigned_driver_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    assigned_driver_id IS NULL
    OR assigned_driver_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
