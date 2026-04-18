-- Define best_of=5 (fase eliminatória, conforme Art. 11 do regulamento)
-- para as 4 provas de Tênis de Mesa Paralímpico
UPDATE public.sport_event_rules ser
SET rules = jsonb_set(
  ser.rules,
  '{scoring,best_of}',
  '5'::jsonb,
  true
),
updated_at = now()
FROM public.sport_events se
JOIN public.sports s ON s.id = se.sport_id
WHERE ser.sport_event_id = se.id
  AND ser.is_active = true
  AND s.name ILIKE '%Tênis de Mesa Paral%'
  AND (ser.rules->'scoring'->>'best_of') IS NULL;