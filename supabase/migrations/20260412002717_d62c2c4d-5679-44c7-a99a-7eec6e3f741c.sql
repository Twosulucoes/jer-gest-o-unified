
-- RPC: Count sport_events with enrolled participants but no matches
CREATE OR REPLACE FUNCTION public.rpc_kpi_provas_sem_partidas(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int;
  v_items json;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaria') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  ) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  WITH provas_sem AS (
    SELECT se.id, se.name AS sport_event_name, s.name AS sport_name,
           COUNT(DISTINCT pse.id) AS enrolled_count
    FROM sport_events se
    JOIN sports s ON s.id = se.sport_id
    JOIN participant_sport_events pse ON pse.sport_event_id = se.id
    WHERE se.event_id = p_event_id
      AND NOT EXISTS (
        SELECT 1 FROM competition_matches cm
        WHERE cm.sport_event_id = se.id AND cm.event_id = p_event_id
      )
    GROUP BY se.id, se.name, s.name
    ORDER BY s.name, se.name
  )
  SELECT COUNT(*), COALESCE(json_agg(row_to_json(provas_sem)), '[]'::json)
    INTO v_count, v_items
  FROM provas_sem;

  RETURN json_build_object('count', v_count, 'items', v_items);
END;
$$;

-- RPC: Count matches without any result
CREATE OR REPLACE FUNCTION public.rpc_kpi_partidas_sem_resultado(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int;
  v_items json;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaria') OR
    public.has_role(auth.uid(), 'coordenacao_tecnica')
  ) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  WITH sem_resultado AS (
    SELECT cm.id AS match_id, cm.match_number, cm.match_date, cm.start_time, cm.status,
           se.name AS sport_event_name, s.name AS sport_name,
           cp.name AS phase_name
    FROM competition_matches cm
    JOIN sport_events se ON se.id = cm.sport_event_id
    JOIN sports s ON s.id = se.sport_id
    JOIN competition_phases cp ON cp.id = cm.phase_id
    WHERE cm.event_id = p_event_id
      AND NOT EXISTS (
        SELECT 1 FROM competition_match_results cmr
        JOIN competition_match_entries cme ON cme.id = cmr.match_entry_id
        WHERE cme.match_id = cm.id
      )
    ORDER BY s.name, se.name, cm.match_number NULLS LAST
    LIMIT 100
  )
  SELECT COUNT(*), COALESCE(json_agg(row_to_json(sem_resultado)), '[]'::json)
    INTO v_count, v_items
  FROM sem_resultado;

  RETURN json_build_object('count', v_count, 'items', v_items);
END;
$$;
