
-- Add fields to transport_trips
ALTER TABLE public.transport_trips
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS has_incidents BOOLEAN NOT NULL DEFAULT false;

-- Add fields to transport_passengers
ALTER TABLE public.transport_passengers
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_name TEXT,
  ADD COLUMN IF NOT EXISTS manual_cpf TEXT,
  ADD COLUMN IF NOT EXISTS identity_photo_url TEXT;

-- Create storage bucket for passenger identity photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('transport-passenger-docs', 'transport-passenger-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload transport docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'transport-passenger-docs');

CREATE POLICY "Authenticated users can view transport docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'transport-passenger-docs');
