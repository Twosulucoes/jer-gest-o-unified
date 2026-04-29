-- Ensure service_vouchers has all expected columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_vouchers' AND column_name = 'voucher_type') THEN
        ALTER TABLE public.service_vouchers ADD COLUMN voucher_type TEXT DEFAULT 'nominal' CHECK (voucher_type IN ('nominal', 'aggregate'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_vouchers' AND column_name = 'label') THEN
        ALTER TABLE public.service_vouchers ADD COLUMN label TEXT;
    END IF;
END $$;

-- Ensure service_voucher_batches has all expected columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_voucher_batches' AND column_name = 'service_type') THEN
        ALTER TABLE public.service_voucher_batches ADD COLUMN service_type TEXT CHECK (service_type IN ('meals', 'transport', 'lodging'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_voucher_batches' AND column_name = 'label') THEN
        ALTER TABLE public.service_voucher_batches ADD COLUMN label TEXT;
    END IF;
END $$;

-- Explicitly grant permissions to ensure no RLS/permission side-effects block the schema refresh
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- Force PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
