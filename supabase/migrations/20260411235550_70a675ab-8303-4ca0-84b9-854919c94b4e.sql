
UPDATE public.competition_match_results
SET result_status = 'publicado'
WHERE result_status = 'published'
  AND published_bulletin_id = '4f935fb0-4fe1-4584-8f6d-ff127afc1a68';
