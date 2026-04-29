-- Force PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';

-- Ensure all columns have correct permissions (grants to authenticated)
GRANT ALL ON TABLE public.service_vouchers TO authenticated;
GRANT ALL ON TABLE public.service_voucher_batches TO authenticated;
GRANT ALL ON TABLE public.service_eventual_people TO authenticated;
GRANT ALL ON TABLE public.service_voucher_audit TO authenticated;
