-- 1. Tabela de Pessoas Eventuais
CREATE TABLE IF NOT EXISTS public.service_eventual_people (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    involvement_type TEXT NOT NULL, -- 'prestador', 'acompanhante', 'visitante', 'outro'
    document_id TEXT,
    organization TEXT,
    notes TEXT,
    authorized_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.service_eventual_people ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para service_eventual_people
CREATE POLICY "Leitura de eventuais por perfis autorizados"
ON public.service_eventual_people FOR SELECT
USING (
    auth.uid() IN (
        SELECT id FROM auth.users 
        WHERE (raw_user_meta_data->>'app_role')::text IN ('admin', 'secretaria', 'super_admin', 'coordenacao_tecnica')
    )
);

CREATE POLICY "Escrita de eventuais por admin e secretaria"
ON public.service_eventual_people FOR ALL
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

-- Gatilho de timestamps para service_eventual_people
CREATE TRIGGER trg_service_eventual_people_touch
BEFORE UPDATE ON public.service_eventual_people
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Gatilho de auditoria para service_eventual_people
CREATE TRIGGER trg_audit_service_eventual_people
AFTER INSERT OR UPDATE OR DELETE ON public.service_eventual_people
FOR EACH ROW EXECUTE FUNCTION public.audit_people_voucher_changes();

-- 2. Evolução da tabela service_vouchers
-- Adicionando colunas necessárias para a reformulação
ALTER TABLE public.service_vouchers 
ADD COLUMN IF NOT EXISTS eventual_person_id UUID REFERENCES public.service_eventual_people(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS batch_id UUID,
ADD COLUMN IF NOT EXISTS is_nominal BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS target_meal_window_id UUID REFERENCES public.meal_windows(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS target_trip_id UUID REFERENCES public.transport_trips(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS target_facility_id UUID REFERENCES public.lodging_locations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS target_date DATE;

-- Comentários para documentação de schema
COMMENT ON COLUMN public.service_vouchers.is_nominal IS 'Indica se o voucher está vinculado a uma pessoa (eventual ou participante legado)';
COMMENT ON COLUMN public.service_vouchers.eventual_person_id IS 'Link para a nova entidade de pessoa eventual (exclusivo para quem não tem credencial)';
COMMENT ON COLUMN public.service_vouchers.target_meal_window_id IS 'Vincula o voucher a uma janela de refeição específica';
COMMENT ON COLUMN public.service_vouchers.target_trip_id IS 'Vincula o voucher a uma viagem de transporte específica';

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_vouchers_eventual_person ON public.service_vouchers(eventual_person_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_batch ON public.service_vouchers(batch_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_meal_window ON public.service_vouchers(target_meal_window_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_trip ON public.service_vouchers(target_trip_id);
