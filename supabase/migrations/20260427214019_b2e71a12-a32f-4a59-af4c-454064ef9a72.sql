-- Tabela para armazenar os lotes de vouchers
CREATE TABLE IF NOT EXISTS public.service_voucher_batches (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    label TEXT, -- Rótulo opcional do lote
    service_type TEXT NOT NULL, -- 'meals', 'transport', 'lodging'
    target_meal_window_id UUID REFERENCES public.meal_windows(id) ON DELETE SET NULL,
    target_trip_id UUID REFERENCES public.transport_trips(id) ON DELETE SET NULL,
    target_facility_id UUID REFERENCES public.lodging_locations(id) ON DELETE SET NULL,
    target_date DATE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.service_voucher_batches ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para service_voucher_batches
CREATE POLICY "Leitura de lotes por perfis autorizados"
ON public.service_voucher_batches FOR SELECT
USING (
    auth.uid() IN (
        SELECT id FROM auth.users 
        WHERE (raw_user_meta_data->>'app_role')::text IN ('admin', 'secretaria', 'super_admin', 'coordenacao_tecnica')
    )
);

CREATE POLICY "Escrita de lotes por admin e secretaria"
ON public.service_voucher_batches FOR ALL
USING (
    auth.uid() IN (
        SELECT id FROM auth.users 
        WHERE (raw_user_meta_data->>'app_role')::text IN ('admin', 'secretaria', 'super_admin')
    )
)
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM auth.users 
        WHERE (raw_user_meta_data->>'app_role')::text IN ('admin', 'secretaria', 'super_admin')
    )
);

-- Gatilho de timestamps
CREATE TRIGGER trg_service_voucher_batches_touch
BEFORE UPDATE ON public.service_voucher_batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vincular service_vouchers à tabela de lotes
ALTER TABLE public.service_vouchers
ADD CONSTRAINT fk_voucher_batch FOREIGN KEY (batch_id) REFERENCES public.service_voucher_batches(id) ON DELETE SET NULL;

-- Gatilho de auditoria para lotes
CREATE TRIGGER trg_audit_service_voucher_batches
AFTER INSERT OR UPDATE OR DELETE ON public.service_voucher_batches
FOR EACH ROW EXECUTE FUNCTION public.audit_people_voucher_changes();
