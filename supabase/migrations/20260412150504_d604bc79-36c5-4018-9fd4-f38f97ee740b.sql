
-- Enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 3) Token generator using extensions.gen_random_bytes
CREATE OR REPLACE FUNCTION public.generate_public_token()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT replace(replace(replace(
    encode(extensions.gen_random_bytes(16), 'base64'),
    '+', '-'), '/', '_'), '=', '')
$$;

-- 4) Admin upsert/rotate
CREATE OR REPLACE FUNCTION public.admin_upsert_athlete_public_token(
  p_athlete_id uuid,
  p_expires_at timestamptz DEFAULT NULL,
  p_rotate boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing record;
  v_new_token text;
  v_result record;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_existing
  FROM athlete_public_tokens
  WHERE athlete_id = p_athlete_id AND active = true;

  IF v_existing IS NOT NULL AND p_rotate = false THEN
    RETURN json_build_object(
      'id', v_existing.id,
      'token', v_existing.token,
      'athlete_id', v_existing.athlete_id,
      'expires_at', v_existing.expires_at,
      'active', v_existing.active
    );
  END IF;

  IF v_existing IS NOT NULL THEN
    UPDATE athlete_public_tokens SET active = false WHERE id = v_existing.id;
  END IF;

  v_new_token := generate_public_token();

  INSERT INTO athlete_public_tokens (athlete_id, token, active, expires_at, rotated_from, created_by)
  VALUES (p_athlete_id, v_new_token, true, p_expires_at,
          CASE WHEN p_rotate THEN v_existing.id ELSE NULL END,
          auth.uid())
  RETURNING * INTO v_result;

  RETURN json_build_object(
    'id', v_result.id,
    'token', v_result.token,
    'athlete_id', v_result.athlete_id,
    'expires_at', v_result.expires_at,
    'active', v_result.active
  );
END;
$$;

-- 5) Admin deactivate
CREATE OR REPLACE FUNCTION public.admin_deactivate_athlete_public_token(p_athlete_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE athlete_public_tokens SET active = false WHERE athlete_id = p_athlete_id AND active = true;
END;
$$;

-- 6) Public RPC
CREATE OR REPLACE FUNCTION public.get_athlete_public_profile(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok record;
  v_participant record;
  v_person record;
  v_delegation record;
  v_institution record;
  v_modalities json;
  v_results json;
  v_schedule json;
BEGIN
  SELECT * INTO v_tok
  FROM athlete_public_tokens
  WHERE token = p_token AND active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF v_tok IS NULL THEN
    RETURN json_build_object('error', 'invalid_or_expired', 'message', 'QR inválido ou expirado');
  END IF;

  UPDATE athlete_public_tokens
  SET last_used_at = now(), use_count = use_count + 1
  WHERE id = v_tok.id;

  SELECT * INTO v_participant FROM participants WHERE id = v_tok.athlete_id;
  IF v_participant IS NULL THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  SELECT id, full_name, gender, extract(year from birth_date::date)::int as birth_year, photo_url
  INTO v_person
  FROM people WHERE id = v_participant.person_id;

  SELECT * INTO v_delegation FROM delegations WHERE id = v_participant.delegation_id;
  SELECT * INTO v_institution FROM institutions WHERE id = v_delegation.institution_id;

  SELECT json_agg(row_to_json(m)) INTO v_modalities
  FROM (
    SELECT s.name as sport_name, se.name as event_name, c.name as category_name,
           s.is_collective, pse.status as enrollment_status
    FROM participant_sport_events pse
    JOIN sport_events se ON se.id = pse.sport_event_id
    JOIN sports s ON s.id = se.sport_id
    JOIN categories c ON c.id = se.category_id
    WHERE pse.participant_id = v_tok.athlete_id
    ORDER BY s.name, se.name
  ) m;

  SELECT json_agg(row_to_json(r)) INTO v_results
  FROM (
    SELECT s.name as sport_name, se.name as event_name,
           cmr.position, cmr.score, cmr.result_text, cmr.outcome,
           cm.match_date
    FROM competition_match_results cmr
    JOIN competition_match_entries cme ON cme.id = cmr.match_entry_id
    JOIN competition_matches cm ON cm.id = cmr.match_id
    LEFT JOIN sport_events se ON se.id = cm.sport_event_id
    LEFT JOIN sports s ON s.id = se.sport_id
    WHERE (cme.participant_sport_event_id IN (
      SELECT pse2.id FROM participant_sport_events pse2 WHERE pse2.participant_id = v_tok.athlete_id
    ) OR cme.team_id IN (
      SELECT tm.team_id FROM team_members tm WHERE tm.participant_id = v_tok.athlete_id
    ))
    AND cmr.result_status = 'publicado'
    ORDER BY cm.match_date DESC NULLS LAST
    LIMIT 20
  ) r;

  SELECT json_agg(row_to_json(sc)) INTO v_schedule
  FROM (
    SELECT s.name as sport_name, se.name as event_name,
           cm.match_date, cm.start_time, v.name as venue_name
    FROM competition_matches cm
    LEFT JOIN sport_events se ON se.id = cm.sport_event_id
    LEFT JOIN sports s ON s.id = se.sport_id
    LEFT JOIN venues v ON v.id = cm.venue_id
    JOIN competition_match_entries cme ON cme.match_id = cm.id
    WHERE (cme.participant_sport_event_id IN (
      SELECT pse3.id FROM participant_sport_events pse3 WHERE pse3.participant_id = v_tok.athlete_id
    ) OR cme.team_id IN (
      SELECT tm2.team_id FROM team_members tm2 WHERE tm2.participant_id = v_tok.athlete_id
    ))
    AND cm.status IN ('scheduled', 'in_progress')
    AND (cm.match_date >= current_date OR cm.match_date IS NULL)
    ORDER BY cm.match_date ASC NULLS LAST, cm.start_time ASC NULLS LAST
    LIMIT 10
  ) sc;

  RETURN json_build_object(
    'athlete', json_build_object(
      'full_name', v_person.full_name,
      'gender', v_person.gender,
      'birth_year', v_person.birth_year,
      'photo_url', v_person.photo_url,
      'participant_type', v_participant.participant_type,
      'status', v_participant.status
    ),
    'delegation', json_build_object(
      'name', v_institution.name,
      'city', v_institution.city,
      'state', v_institution.state
    ),
    'modalities', COALESCE(v_modalities, '[]'::json),
    'schedule_next', COALESCE(v_schedule, '[]'::json),
    'results_public', COALESCE(v_results, '[]'::json),
    'updated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_athlete_public_profile(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_public_profile(text) TO authenticated;
