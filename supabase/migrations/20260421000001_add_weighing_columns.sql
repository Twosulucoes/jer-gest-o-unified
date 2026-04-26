-- Step 3: Add weighing columns to participant_sport_events
ALTER TABLE public.participant_sport_events
  ADD COLUMN IF NOT EXISTS official_weight numeric(5,2),
  ADD COLUMN IF NOT EXISTS weighing_status text DEFAULT 'pending' CHECK (weighing_status IN ('pending', 'confirmed', 'overweight')),
  ADD COLUMN IF NOT EXISTS weighed_at timestamptz,
  ADD COLUMN IF NOT EXISTS weighed_by uuid REFERENCES public.profiles(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_participant_sport_events_weighing_status 
  ON public.participant_sport_events(weighing_status);

-- RLS Policies for weighing
-- Only admin and coordination can update weighing info
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'participant_sport_events' AND policyname = 'Allow admin and coordination to update weighing'
  ) THEN
    CREATE POLICY "Allow admin and coordination to update weighing" ON public.participant_sport_events
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid()
          AND r.name IN ('admin', 'coordenacao_tecnica')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid()
          AND r.name IN ('admin', 'coordenacao_tecnica')
        )
      );
  END IF;
END $$;
