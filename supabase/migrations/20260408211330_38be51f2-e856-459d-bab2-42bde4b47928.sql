-- 1. Add credentialing columns to participants
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS credentialed_at timestamptz,
  ADD COLUMN IF NOT EXISTS credentialed_by uuid;

-- 2. Add issuer/activator columns to participant_credentials
ALTER TABLE public.participant_credentials
  ADD COLUMN IF NOT EXISTS issued_by uuid,
  ADD COLUMN IF NOT EXISTS activated_by uuid;

-- 3. Events read for transporte and alimentacao (needed for QR validation context)
CREATE POLICY "Transporte can read events"
  ON public.events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'transporte'::app_role));

CREATE POLICY "Alimentacao can read events"
  ON public.events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'alimentacao'::app_role));

-- 4. Coordenacao tecnica can read credential_scans
CREATE POLICY "Coordenacao tecnica can read credential_scans"
  ON public.credential_scans FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- 5. Coordenacao tecnica can insert credential_scans (for credentialing operations)
CREATE POLICY "Coordenacao tecnica can insert credential_scans"
  ON public.credential_scans FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role) AND scanned_by = auth.uid());

-- 6. Secretaria can insert credential_scans
CREATE POLICY "Secretaria can insert credential_scans"
  ON public.credential_scans FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role) AND scanned_by = auth.uid());

-- 7. Secretaria can update participants (for credentialing)
-- Already exists, but need admin to also update credential fields
-- Coordenacao tecnica can update participants for credentialing
CREATE POLICY "Coordenacao tecnica can update participants"
  ON public.participants FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- 8. Coordenacao tecnica can insert participant_credentials
CREATE POLICY "Coordenacao tecnica can insert participant_credentials"
  ON public.participant_credentials FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- 9. Coordenacao tecnica can update participant_credentials
CREATE POLICY "Coordenacao tecnica can update participant_credentials"
  ON public.participant_credentials FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));