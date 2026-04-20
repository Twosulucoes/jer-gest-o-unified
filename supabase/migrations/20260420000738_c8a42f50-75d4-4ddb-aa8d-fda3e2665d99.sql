DROP VIEW IF EXISTS public.vw_person_logistics_consumption CASCADE;

CREATE VIEW public.vw_person_logistics_consumption
WITH (security_invoker = true) AS
SELECT
  p.id AS person_id,
  p.full_name,
  p.cpf,
  pa.id AS participant_id,
  pa.event_id,
  pa.delegation_id,
  d.school_name AS delegation_name,
  pa.participant_type,
  pa.needs_transport,
  pa.needs_meals,
  pa.needs_lodging,
  COALESCE((
    SELECT COUNT(*) FROM public.transport_passengers tp
    WHERE tp.participant_id = pa.id AND tp.boarded_at IS NOT NULL
  ), 0) AS transport_boardings,
  COALESCE((
    SELECT COUNT(*) FROM public.meal_consumptions mc
    WHERE mc.participant_id = pa.id
  ), 0) AS meals_consumed,
  COALESCE((
    SELECT COUNT(*) FROM public.lodging_occupancies lo
    WHERE lo.participant_id = pa.id
  ), 0) AS lodging_nights,
  COALESCE((
    SELECT SUM(sv.current_uses)::int FROM public.service_vouchers sv
    WHERE sv.participant_id = pa.id
  ), 0) AS voucher_uses_total
FROM public.people p
JOIN public.participants pa ON pa.person_id = p.id
LEFT JOIN public.delegations d ON d.id = pa.delegation_id;

GRANT SELECT ON public.vw_person_logistics_consumption TO authenticated;