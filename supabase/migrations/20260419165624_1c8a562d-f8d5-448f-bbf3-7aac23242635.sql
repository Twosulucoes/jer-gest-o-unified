-- =====================================================================
-- 1. operational_incidents: adicionar event_stage_id (NOT NULL com backfill)
-- =====================================================================

ALTER TABLE public.operational_incidents
  ADD COLUMN IF NOT EXISTS event_stage_id uuid REFERENCES public.event_stages(id) ON DELETE RESTRICT;

WITH default_stage AS (
  SELECT DISTINCT ON (event_id)
    event_id,
    id AS stage_id
  FROM public.event_stages
  ORDER BY event_id,
           (status = 'active') DESC,
           sort_order ASC,
           created_at ASC
)
UPDATE public.operational_incidents oi
   SET event_stage_id = ds.stage_id
  FROM default_stage ds
 WHERE oi.event_stage_id IS NULL
   AND oi.event_id = ds.event_id;

INSERT INTO public.event_stages (event_id, name, slug, kind, status, sort_order)
SELECT DISTINCT oi.event_id, 'Geral', 'geral', 'general', 'active', 0
  FROM public.operational_incidents oi
 WHERE oi.event_stage_id IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.event_stages es WHERE es.event_id = oi.event_id
   );

WITH fallback_stage AS (
  SELECT DISTINCT ON (event_id)
    event_id,
    id AS stage_id
  FROM public.event_stages
  ORDER BY event_id, sort_order ASC, created_at ASC
)
UPDATE public.operational_incidents oi
   SET event_stage_id = fs.stage_id
  FROM fallback_stage fs
 WHERE oi.event_stage_id IS NULL
   AND oi.event_id = fs.event_id;

ALTER TABLE public.operational_incidents
  ALTER COLUMN event_stage_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_incidents_event_stage_id
  ON public.operational_incidents(event_stage_id);

-- =====================================================================
-- 2. user_stage_assignments
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_stage_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_stage_id uuid NOT NULL REFERENCES public.event_stages(id) ON DELETE CASCADE,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_stage_id)
);

CREATE INDEX IF NOT EXISTS idx_user_stage_assignments_user
  ON public.user_stage_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stage_assignments_stage
  ON public.user_stage_assignments(event_stage_id);

ALTER TABLE public.user_stage_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage stage assignments" ON public.user_stage_assignments;
CREATE POLICY "Admins manage stage assignments"
  ON public.user_stage_assignments
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'secretaria')
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'secretaria')
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "Users see own assignments" ON public.user_stage_assignments;
CREATE POLICY "Users see own assignments"
  ON public.user_stage_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_user_stage_assignments_updated_at ON public.user_stage_assignments;
CREATE TRIGGER trg_user_stage_assignments_updated_at
  BEFORE UPDATE ON public.user_stage_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 3. user_can_access_stage: enforcement com fallback permissivo
-- =====================================================================

CREATE OR REPLACE FUNCTION public.user_can_access_stage(_user_id uuid, _stage_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'secretaria')
    OR public.has_role(_user_id, 'super_admin')
    OR public.has_role(_user_id, 'coordenacao_tecnica')
    OR EXISTS (
      SELECT 1 FROM public.user_stage_assignments usa
       WHERE usa.user_id = _user_id
         AND usa.event_stage_id = _stage_id
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.user_stage_assignments usa
       WHERE usa.user_id = _user_id
    );
$$;

COMMENT ON FUNCTION public.user_can_access_stage IS
'Acesso por etapa: admin/secretaria/super_admin/coordenacao_tecnica sempre passam. Demais perfis precisam de vínculo em user_stage_assignments. Usuários sem nenhum vínculo cadastrado mantêm acesso total (compatibilidade retroativa).';

-- =====================================================================
-- 4. public_results_view: incluir event_stage_id
-- =====================================================================

DROP VIEW IF EXISTS public.public_results_view;
CREATE VIEW public.public_results_view AS
SELECT
  cm.event_id,
  e.name AS event_name,
  e.year AS event_year,
  se.id AS sport_event_id,
  se.name AS sport_event_name,
  s.id AS sport_id,
  s.name AS sport_name,
  c.name AS category_name,
  cm.id AS match_id,
  cm.match_number,
  cm.match_date,
  cm.start_time,
  v.name AS venue_name,
  CASE
    WHEN cme.team_id IS NOT NULL THEN 'team'::text
    ELSE 'athlete'::text
  END AS entry_type,
  COALESCE(t.name, ppl.full_name) AS display_name,
  inst.name AS institution_name,
  cmr.outcome,
  cmr.score,
  cmr.time_ms,
  cmr.distance_cm,
  cmr.points,
  cmr."position",
  cmr.result_status,
  b.number AS bulletin_number,
  b.title AS bulletin_title,
  b.published_at AS bulletin_published_at,
  -- event_stage_id: para inscrição individual vem direto de pse;
  -- para entrada por equipe, deriva de qualquer inscrição da mesma delegação na mesma prova
  COALESCE(pse.event_stage_id, t_pse.event_stage_id) AS event_stage_id
FROM competition_match_results cmr
  JOIN competition_match_entries cme ON cme.id = cmr.match_entry_id
  JOIN competition_matches cm ON cm.id = cmr.match_id
  JOIN events e ON e.id = cm.event_id
  JOIN sport_events se ON se.id = cm.sport_event_id
  JOIN sports s ON s.id = se.sport_id
  LEFT JOIN categories c ON c.id = se.category_id
  LEFT JOIN venues v ON v.id = cm.venue_id
  LEFT JOIN teams t ON t.id = cme.team_id
  LEFT JOIN participant_sport_events pse ON pse.id = cme.participant_sport_event_id
  LEFT JOIN participants part ON part.id = pse.participant_id
  LEFT JOIN people ppl ON ppl.id = part.person_id
  LEFT JOIN delegations d ON d.id = COALESCE(t.delegation_id, part.delegation_id)
  LEFT JOIN institutions inst ON inst.id = d.institution_id
  LEFT JOIN official_bulletins b ON b.id = cmr.published_bulletin_id
  LEFT JOIN LATERAL (
    SELECT pse2.event_stage_id
      FROM participant_sport_events pse2
      JOIN participants p2 ON p2.id = pse2.participant_id
     WHERE pse2.sport_event_id = t.sport_event_id
       AND p2.delegation_id = t.delegation_id
       AND pse2.event_stage_id IS NOT NULL
     LIMIT 1
  ) t_pse ON t.id IS NOT NULL
WHERE cmr.result_status = 'publicado';