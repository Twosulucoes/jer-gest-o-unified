
ALTER TABLE public.competition_match_results
  ADD COLUMN published_by uuid,
  ADD COLUMN published_at timestamptz;

-- Public read access for published results only (future public page)
CREATE POLICY "Public can read published results"
  ON public.competition_match_results FOR SELECT TO anon
  USING (result_status = 'publicado');
