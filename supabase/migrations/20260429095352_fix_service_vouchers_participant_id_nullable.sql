-- participant_id era NOT NULL mas vouchers eventuais não têm participant (só eventual_person_id)
ALTER TABLE public.service_vouchers ALTER COLUMN participant_id DROP NOT NULL;

-- is_contingency referenciado no frontend mas ausente no BD
ALTER TABLE public.service_vouchers ADD COLUMN IF NOT EXISTS is_contingency BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
