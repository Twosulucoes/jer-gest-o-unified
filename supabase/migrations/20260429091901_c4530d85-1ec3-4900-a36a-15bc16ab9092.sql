-- Add missing columns to service_vouchers
ALTER TABLE public.service_vouchers 
ADD COLUMN IF NOT EXISTS voucher_type TEXT DEFAULT 'nominal' CHECK (voucher_type IN ('nominal', 'aggregate')),
ADD COLUMN IF NOT EXISTS label TEXT;

-- Add missing columns to service_voucher_batches
ALTER TABLE public.service_voucher_batches 
ADD COLUMN IF NOT EXISTS service_type TEXT CHECK (service_type IN ('meals', 'transport', 'lodging')),
ADD COLUMN IF NOT EXISTS label TEXT;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
