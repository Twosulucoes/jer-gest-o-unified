
-- Create user_sport_links table
CREATE TABLE public.user_sport_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(user_id, sport_id, event_id)
);

ALTER TABLE public.user_sport_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access user_sport_links"
  ON public.user_sport_links FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "CoordTec read user_sport_links"
  ON public.user_sport_links FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

CREATE POLICY "Secretaria read user_sport_links"
  ON public.user_sport_links FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Coordenador modalidade read own links"
  ON public.user_sport_links FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenador_modalidade'::app_role) AND user_id = auth.uid());

-- Create match_user_assignments table
CREATE TABLE public.match_user_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.competition_matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'mesario',
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(match_id, user_id, role)
);

ALTER TABLE public.match_user_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access match_user_assignments"
  ON public.match_user_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "CoordTec manage match_user_assignments"
  ON public.match_user_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

CREATE POLICY "CoordModalidade manage match_user_assignments"
  ON public.match_user_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordenador_modalidade'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordenador_modalidade'::app_role));

CREATE POLICY "Mesario read own assignments"
  ON public.match_user_assignments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'mesario'::app_role) AND user_id = auth.uid());

CREATE POLICY "Secretaria read match_user_assignments"
  ON public.match_user_assignments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'secretaria'::app_role));
