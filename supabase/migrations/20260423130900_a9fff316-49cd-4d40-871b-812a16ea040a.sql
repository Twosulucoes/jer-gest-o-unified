-- Add visibility controls to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS public_agenda_published boolean DEFAULT false;

-- Update RLS for events (allow anonymous to see public events)
CREATE POLICY "Public can view public events" 
ON public.events FOR SELECT 
USING (is_public = true);

-- Update RLS for competition_matches (allow anonymous to view matches of events with published agenda)
CREATE POLICY "Public can view matches of events with published agenda" 
ON public.competition_matches FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.events 
    WHERE events.id = competition_matches.event_id 
    AND events.public_agenda_published = true
  )
);

-- Update RLS for competition_match_entries (allow anonymous to view entries of visible matches)
CREATE POLICY "Public can view match entries of visible matches" 
ON public.competition_match_entries FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.competition_matches
    JOIN public.events ON events.id = competition_matches.event_id
    WHERE competition_matches.id = competition_match_entries.match_id
    AND events.public_agenda_published = true
  )
);
