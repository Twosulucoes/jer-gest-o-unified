-- Alojamento role can READ locations
CREATE POLICY "Alojamento can read lodging_locations"
  ON public.lodging_locations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::app_role));

-- Alojamento role can READ units
CREATE POLICY "Alojamento can read lodging_units"
  ON public.lodging_units
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::app_role));

-- Alojamento role can SELECT occupancies
CREATE POLICY "Alojamento can read lodging_occupancies"
  ON public.lodging_occupancies
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::app_role));

-- Alojamento role can INSERT occupancies
CREATE POLICY "Alojamento can insert lodging_occupancies"
  ON public.lodging_occupancies
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'alojamento'::app_role));

-- Alojamento role can UPDATE occupancies
CREATE POLICY "Alojamento can update lodging_occupancies"
  ON public.lodging_occupancies
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::app_role));

-- Also need to let alojamento read participants and people for guest lists
CREATE POLICY "Alojamento can read participants"
  ON public.participants
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::app_role));

-- Also let alojamento update participant contacts (guardian/coach phone)
CREATE POLICY "Alojamento can update participants"
  ON public.participants
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::app_role));

CREATE POLICY "Alojamento can read people"
  ON public.people
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::app_role));

CREATE POLICY "Alojamento can read delegations"
  ON public.delegations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::app_role));

CREATE POLICY "Alojamento can read institutions"
  ON public.institutions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::app_role));