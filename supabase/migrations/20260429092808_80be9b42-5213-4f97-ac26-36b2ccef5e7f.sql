-- Grant SELECT on user_roles so policies can check roles
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_roles TO service_role;

-- Set defaults for audit and batch tables to use auth.uid() automatically
ALTER TABLE public.service_voucher_batches 
ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.service_voucher_audit 
ALTER COLUMN issuer_id SET DEFAULT auth.uid();

-- Ensure authenticated users have access to the tables
GRANT ALL ON public.service_vouchers TO authenticated;
GRANT ALL ON public.service_voucher_batches TO authenticated;
GRANT ALL ON public.service_eventual_people TO authenticated;
GRANT ALL ON public.service_voucher_audit TO authenticated;

-- Ensure service_role has access
GRANT ALL ON public.service_vouchers TO service_role;
GRANT ALL ON public.service_voucher_batches TO service_role;
GRANT ALL ON public.service_eventual_people TO service_role;
GRANT ALL ON public.service_voucher_audit TO service_role;

-- Force PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
