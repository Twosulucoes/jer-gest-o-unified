-- Enable RLS
ALTER TABLE public.service_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_voucher_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_eventual_people ENABLE ROW LEVEL SECURITY;

-- Policies for service_vouchers
CREATE POLICY "Admins and secretaria can manage service vouchers" 
ON public.service_vouchers 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin'))
  )
);

CREATE POLICY "Operacional roles can view service vouchers" 
ON public.service_vouchers 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('transporte', 'alimentacao', 'alojamento', 'coordenacao_tecnica'))
  )
);

-- Policies for service_voucher_batches
CREATE POLICY "Admins and secretaria can manage voucher batches" 
ON public.service_voucher_batches 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin'))
  )
);

CREATE POLICY "Operacional roles can view voucher batches" 
ON public.service_voucher_batches 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('transporte', 'alimentacao', 'alojamento', 'coordenacao_tecnica'))
  )
);

-- Policies for service_eventual_people
CREATE POLICY "Admins and secretaria can manage eventual people" 
ON public.service_eventual_people 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin'))
  )
);

CREATE POLICY "Operacional roles can view eventual people" 
ON public.service_eventual_people 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('transporte', 'alimentacao', 'alojamento', 'coordenacao_tecnica'))
  )
);
