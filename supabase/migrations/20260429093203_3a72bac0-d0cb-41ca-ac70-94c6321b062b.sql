-- 1. Ensure Table Structure is Synchronized
DO $$ 
BEGIN 
    -- service_vouchers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_vouchers' AND column_name = 'voucher_type') THEN
        ALTER TABLE public.service_vouchers ADD COLUMN voucher_type TEXT DEFAULT 'nominal' CHECK (voucher_type IN ('nominal', 'aggregate'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_vouchers' AND column_name = 'label') THEN
        ALTER TABLE public.service_vouchers ADD COLUMN label TEXT;
    END IF;

    -- service_voucher_batches
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_voucher_batches' AND column_name = 'service_type') THEN
        ALTER TABLE public.service_voucher_batches ADD COLUMN service_type TEXT CHECK (service_type IN ('meals', 'transport', 'lodging'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_voucher_batches' AND column_name = 'label') THEN
        ALTER TABLE public.service_voucher_batches ADD COLUMN label TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_voucher_batches' AND column_name = 'created_by') THEN
        ALTER TABLE public.service_voucher_batches ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 2. Reset Defaults
ALTER TABLE public.service_voucher_batches ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.service_voucher_audit ALTER COLUMN issuer_id SET DEFAULT auth.uid();

-- 3. Re-verify RLS Policies
-- Drop to avoid conflicts
DROP POLICY IF EXISTS "Admins and secretaria can manage service vouchers" ON public.service_vouchers;
DROP POLICY IF EXISTS "Operacional roles can view service vouchers" ON public.service_vouchers;
DROP POLICY IF EXISTS "Admins and secretaria can manage voucher batches" ON public.service_voucher_batches;
DROP POLICY IF EXISTS "Operacional roles can view voucher batches" ON public.service_voucher_batches;
DROP POLICY IF EXISTS "Admins and secretaria can manage eventual people" ON public.service_eventual_people;
DROP POLICY IF EXISTS "Operacional roles can view eventual people" ON public.service_eventual_people;
DROP POLICY IF EXISTS "Admins and secretaria can view voucher audit" ON public.service_voucher_audit;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.service_voucher_audit;

-- Re-create
CREATE POLICY "Admins and secretaria can manage service vouchers" ON public.service_vouchers FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin')))) WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin'))));
CREATE POLICY "Operacional roles can view service vouchers" ON public.service_vouchers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role::text IN ('transporte', 'alimentacao', 'alojamento', 'coordenacao_tecnica'))));
CREATE POLICY "Admins and secretaria can manage voucher batches" ON public.service_voucher_batches FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin')))) WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin'))));
CREATE POLICY "Operacional roles can view voucher batches" ON public.service_voucher_batches FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role::text IN ('transporte', 'alimentacao', 'alojamento', 'coordenacao_tecnica'))));
CREATE POLICY "Admins and secretaria can manage eventual people" ON public.service_eventual_people FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin')))) WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin'))));
CREATE POLICY "Operacional roles can view eventual people" ON public.service_eventual_people FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role::text IN ('transporte', 'alimentacao', 'alojamento', 'coordenacao_tecnica'))));
CREATE POLICY "Admins and secretaria can view voucher audit" ON public.service_voucher_audit FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin'))));
CREATE POLICY "System can insert audit logs" ON public.service_voucher_audit FOR INSERT TO authenticated WITH CHECK (auth.uid() = issuer_id);

-- 4. Re-verify Permissions
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.service_vouchers TO authenticated;
GRANT ALL ON public.service_voucher_batches TO authenticated;
GRANT ALL ON public.service_eventual_people TO authenticated;
GRANT ALL ON public.service_voucher_audit TO authenticated;

-- 5. Force Cache Reload
NOTIFY pgrst, 'reload schema';
