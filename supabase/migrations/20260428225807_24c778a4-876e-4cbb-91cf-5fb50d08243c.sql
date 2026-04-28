-- 1. Evolução da Sigla de Etapa
ALTER TABLE public.event_stages ADD COLUMN IF NOT EXISTS stage_code TEXT;

-- 2. Estrutura de Boletins Oficiais
ALTER TABLE public.official_bulletins ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES public.event_stages(id);
ALTER TABLE public.official_bulletins ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('daily', 'final')) DEFAULT 'daily';
ALTER TABLE public.official_bulletins ADD COLUMN IF NOT EXISTS bulletin_code TEXT;
ALTER TABLE public.official_bulletins ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 3. Função para numeração automática
CREATE OR REPLACE FUNCTION public.get_next_bulletin_number(p_event_id UUID, p_stage_id UUID, p_type TEXT)
RETURNS TEXT AS $$
DECLARE
    v_stage_code TEXT;
    v_next_num INTEGER;
BEGIN
    -- Obter sigla da etapa ou do evento
    IF p_stage_id IS NOT NULL THEN
        SELECT COALESCE(stage_code, UPPER(LEFT(name, 3))) INTO v_stage_code 
        FROM public.event_stages WHERE id = p_stage_id;
    ELSE
        SELECT UPPER(LEFT(name, 3)) INTO v_stage_code 
        FROM public.events WHERE id = p_event_id;
    END IF;

    IF p_type = 'final' THEN
        RETURN v_stage_code || '-FIN';
    ELSE
        SELECT COALESCE(MAX(number), 0) + 1 INTO v_next_num
        FROM public.official_bulletins
        WHERE event_id = p_event_id 
          AND (stage_id = p_stage_id OR (stage_id IS NULL AND p_stage_id IS NULL))
          AND type = 'daily';
        
        RETURN v_stage_code || '-' || LPAD(v_next_num::TEXT, 3, '0');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Atualização da public_results_view
-- Drop original para recriar com suporte a simple matches e novos campos
DROP VIEW IF EXISTS public.public_results_view;

CREATE VIEW public.public_results_view AS
 SELECT cm.event_id,
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
        WHEN (cme.team_id IS NOT NULL) THEN 'team'::text
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
    COALESCE(b.bulletin_code, b.number::text) AS bulletin_number,
    b.title AS bulletin_title,
    b.published_at AS bulletin_published_at,
    COALESCE(pse.event_stage_id, t_pse.event_stage_id, cm.event_stage_id) AS event_stage_id
   FROM (((((((((((((((public.competition_match_results cmr
     JOIN public.competition_match_entries cme ON ((cme.id = cmr.match_entry_id)))
     JOIN public.competition_matches cm ON ((cm.id = cmr.match_id)))
     JOIN public.events e ON ((e.id = cm.event_id)))
     JOIN public.sport_events se ON ((se.id = cm.sport_event_id)))
     JOIN public.sports s ON ((s.id = se.sport_id)))
     LEFT JOIN public.categories c ON ((c.id = se.category_id)))
     LEFT JOIN public.venues v ON ((v.id = cm.venue_id)))
     LEFT JOIN public.teams t ON ((t.id = cme.team_id)))
     LEFT JOIN public.participant_sport_events pse ON ((pse.id = cme.participant_sport_event_id)))
     LEFT JOIN public.participants part ON ((part.id = pse.participant_id)))
     LEFT JOIN public.people ppl ON ((ppl.id = part.person_id)))
     LEFT JOIN public.delegations d ON ((d.id = COALESCE(t.delegation_id, part.delegation_id))))
     LEFT JOIN public.institutions inst ON ((inst.id = d.institution_id)))
     LEFT JOIN public.official_bulletins b ON ((b.id = cmr.published_bulletin_id)))
     LEFT JOIN LATERAL ( SELECT pse2.event_stage_id
           FROM (public.participant_sport_events pse2
             JOIN public.participants p2 ON ((p2.id = pse2.participant_id)))
          WHERE ((pse2.sport_event_id = t.sport_event_id) AND (p2.delegation_id = t.delegation_id) AND (pse2.event_stage_id IS NOT NULL))
         LIMIT 1) t_pse ON ((t.id IS NOT NULL)))
  WHERE (cmr.result_status = 'publicado'::public.match_result_status);

-- 5. RLS Adicional
-- Usando auth.uid() e verificando em user_roles se existir
CREATE POLICY "Super admin can do everything on event_stages" ON public.event_stages
    FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));
