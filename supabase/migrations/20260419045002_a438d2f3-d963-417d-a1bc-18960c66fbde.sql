WITH novos AS (
  SELECT
    p.id AS participant_id,
    p.event_id,
    p.credentialed_at,
    p.credentialed_by,
    upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10)) AS code
  FROM public.participants p
  WHERE p.status = 'credentialed'
    AND NOT EXISTS (SELECT 1 FROM public.participant_credentials pc WHERE pc.participant_id = p.id)
)
INSERT INTO public.participant_credentials (
  participant_id, event_id, credential_code, qr_code_value,
  status, is_active, binding_source,
  issued_at, issued_by, activated_at, activated_by
)
SELECT
  participant_id, event_id, code,
  'jer:' || event_id || ':' || participant_id || ':' || code,
  'active', true, 'manual',
  COALESCE(credentialed_at, now()), credentialed_by,
  COALESCE(credentialed_at, now()), credentialed_by
FROM novos;