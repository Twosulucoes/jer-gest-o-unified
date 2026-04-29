-- Create audit table
CREATE TABLE IF NOT EXISTS public.service_voucher_audit (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL,
    issuer_id UUID NOT NULL REFERENCES auth.users(id),
    voucher_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_voucher_audit ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins and secretaria can view voucher audit" 
ON public.service_voucher_audit 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND (role::text IN ('admin', 'secretaria', 'super_admin'))
  )
);

CREATE POLICY "System can insert audit logs" 
ON public.service_voucher_audit 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = issuer_id);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
