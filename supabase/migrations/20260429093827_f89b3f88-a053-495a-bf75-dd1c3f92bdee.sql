-- Function to check schema integrity
CREATE OR REPLACE FUNCTION public.check_voucher_schema_integrity()
RETURNS BOOLEAN AS $$
DECLARE
    missing_cols TEXT;
BEGIN
    -- Check for critical columns in service_vouchers
    SELECT string_agg(col, ', ') INTO missing_cols
    FROM (
        SELECT 'voucher_type' AS col WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_vouchers' AND column_name = 'voucher_type')
        UNION ALL
        SELECT 'eventual_person_id' WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_vouchers' AND column_name = 'eventual_person_id')
        UNION ALL
        SELECT 'batch_id' WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_vouchers' AND column_name = 'batch_id')
    ) s;

    IF missing_cols IS NOT NULL THEN
        RAISE EXCEPTION 'DATABASE_SCHEMA_INCONSISTENT: Missing columns in service_vouchers: %', missing_cols;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to validate before insert
CREATE OR REPLACE FUNCTION public.validate_voucher_before_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Perform schema check
    PERFORM public.check_voucher_schema_integrity();
    
    -- Ensure voucher_type is consistent with is_nominal
    IF NEW.is_nominal = true AND (NEW.voucher_type IS NULL OR NEW.voucher_type != 'nominal') THEN
        NEW.voucher_type := 'nominal';
    ELSIF NEW.is_nominal = false AND (NEW.voucher_type IS NULL OR NEW.voucher_type != 'aggregate') THEN
        NEW.voucher_type := 'aggregate';
    END IF;

    -- Ensure eventual_person_id is present if nominal
    IF NEW.is_nominal = true AND NEW.eventual_person_id IS NULL AND NEW.participant_id IS NULL THEN
        RAISE EXCEPTION 'NOMINAL_VOUCHER_REQUIRED_HOLDER: Nominal vouchers must have a participant or eventual person assigned.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Set up the trigger
DROP TRIGGER IF EXISTS trg_validate_voucher_schema ON public.service_vouchers;
CREATE TRIGGER trg_validate_voucher_schema
BEFORE INSERT ON public.service_vouchers
FOR EACH ROW
EXECUTE FUNCTION public.validate_voucher_before_insert();

-- Refresh PostgREST
NOTIFY pgrst, 'reload schema';
