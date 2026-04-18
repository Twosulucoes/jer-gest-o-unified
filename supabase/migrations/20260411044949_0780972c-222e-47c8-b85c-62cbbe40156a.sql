
-- 1) Create user_delegations table FIRST
CREATE TABLE IF NOT EXISTS public.user_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delegation_id uuid NOT NULL REFERENCES public.delegations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_delegations_user UNIQUE (user_id)
);

ALTER TABLE public.user_delegations ENABLE ROW LEVEL SECURITY;

-- 2) Security definer function (table exists now)
CREATE OR REPLACE FUNCTION public.get_user_delegation_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT delegation_id
  FROM public.user_delegations
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- 3) Policies for user_delegations
CREATE POLICY "Users can read own delegation link"
ON public.user_delegations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admin full access user_delegations"
ON public.user_delegations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria full access user_delegations"
ON public.user_delegations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'secretaria'::app_role))
WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

-- 4) Replace delegacao policy on delegations
DROP POLICY IF EXISTS "Delegacao can read delegations" ON public.delegations;
CREATE POLICY "Delegacao can read own delegation"
ON public.delegations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'delegacao'::app_role)
  AND id = public.get_user_delegation_id(auth.uid())
);

-- 5) Add delegacao policy on participants
CREATE POLICY "Delegacao can read own participants"
ON public.participants
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'delegacao'::app_role)
  AND delegation_id = public.get_user_delegation_id(auth.uid())
);

-- 6) Replace delegacao policy on participant_credentials
DROP POLICY IF EXISTS "Delegacao can read own credentials" ON public.participant_credentials;
CREATE POLICY "Delegacao can read own delegation credentials"
ON public.participant_credentials
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'delegacao'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.participants p
    WHERE p.id = participant_credentials.participant_id
      AND p.delegation_id = public.get_user_delegation_id(auth.uid())
  )
);

-- 7) Restrict institutions for delegacao
DROP POLICY IF EXISTS "Delegacao can read institutions" ON public.institutions;
CREATE POLICY "Delegacao can read own institution"
ON public.institutions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'delegacao'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.delegations d
    WHERE d.id = public.get_user_delegation_id(auth.uid())
      AND d.institution_id = institutions.id
  )
);
