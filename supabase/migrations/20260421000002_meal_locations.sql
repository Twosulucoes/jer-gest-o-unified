-- Create meal_locations table
CREATE TABLE IF NOT EXISTS public.meal_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  capacity INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS
ALTER TABLE public.meal_locations ENABLE ROW LEVEL SECURITY;

-- Admins and food staff can manage
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage meal_locations') THEN
        CREATE POLICY "Admins can manage meal_locations" ON public.meal_locations
          FOR ALL TO authenticated
          USING (
            EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'alimentacao', 'secretaria'))
          )
          WITH CHECK (
            EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'alimentacao', 'secretaria'))
          );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read meal_locations') THEN
        CREATE POLICY "Authenticated users can read meal_locations" ON public.meal_locations
          FOR SELECT TO authenticated
          USING (true);
    END IF;
END $$;

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_meal_locations_updated_at') THEN
        CREATE TRIGGER update_meal_locations_updated_at
          BEFORE UPDATE ON public.meal_locations
          FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;

-- Update meal_windows
ALTER TABLE public.meal_windows ADD COLUMN IF NOT EXISTS meal_window_location_id UUID REFERENCES public.meal_locations(id) ON DELETE SET NULL;

-- Data Migration
DO $$
DECLARE
    r RECORD;
    new_loc_id UUID;
BEGIN
    FOR r IN SELECT DISTINCT location, event_id FROM public.meal_windows WHERE location IS NOT NULL AND location <> '' LOOP
        SELECT id INTO new_loc_id FROM public.meal_locations WHERE name = r.location AND event_id = r.event_id;
        
        IF new_loc_id IS NULL THEN
            INSERT INTO public.meal_locations (event_id, name)
            VALUES (r.event_id, r.location)
            RETURNING id INTO new_loc_id;
        END IF;

        UPDATE public.meal_windows
        SET meal_window_location_id = new_loc_id
        WHERE location = r.location AND event_id = r.event_id;
    END LOOP;
END $$;
