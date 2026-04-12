
CREATE OR REPLACE FUNCTION public.rpc_seed_sport_event_rules_for_event(
  p_event_id uuid,
  p_mode text DEFAULT 'missing_only',
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
  v_is_coord boolean;
  v_rec record;
  v_preset_key text;
  v_rules jsonb;
  v_sport_name_upper text;
  v_se_name_upper text;
  v_total int := 0;
  v_created int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_by_preset jsonb := '{}'::jsonb;
  v_existing boolean;
BEGIN
  -- Auth check
  v_is_admin := has_role(v_user_id, 'admin');
  v_is_coord := has_role(v_user_id, 'coordenacao_tecnica');

  IF NOT (v_is_admin OR v_is_coord) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: requires admin or coordenacao_tecnica';
  END IF;

  IF p_mode = 'overwrite' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'ACCESS_DENIED: overwrite requires admin';
  END IF;

  IF p_mode NOT IN ('missing_only', 'overwrite') THEN
    RAISE EXCEPTION 'INVALID_MODE: must be missing_only or overwrite';
  END IF;

  FOR v_rec IN
    SELECT se.id AS sport_event_id, se.name AS se_name, s.name AS sport_name, s.is_collective
    FROM sport_events se
    JOIN sports s ON s.id = se.sport_id
    WHERE se.event_id = p_event_id AND se.is_active = true
  LOOP
    v_total := v_total + 1;
    v_sport_name_upper := upper(unaccent(v_rec.sport_name));
    v_se_name_upper := upper(unaccent(v_rec.se_name));

    -- Check existing
    SELECT EXISTS(SELECT 1 FROM sport_event_rules WHERE sport_event_id = v_rec.sport_event_id) INTO v_existing;

    IF v_existing AND p_mode = 'missing_only' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Determine preset_key
    IF v_sport_name_upper LIKE '%FUTSAL%' OR v_se_name_upper LIKE '%FUTSAL%' THEN
      v_preset_key := 'FUTSAL';
    ELSIF v_sport_name_upper LIKE '%FUTEBOL%' OR v_se_name_upper LIKE '%FUTEBOL%' THEN
      v_preset_key := 'FUTEBOL_DE_CAMPO';
    ELSIF v_sport_name_upper LIKE '%HANDEBOL%' OR v_se_name_upper LIKE '%HANDEBOL%' THEN
      v_preset_key := 'HANDEBOL';
    ELSIF v_sport_name_upper LIKE '%BASQUETE%' OR v_sport_name_upper LIKE '%BASQUETEBOL%'
       OR v_se_name_upper LIKE '%BASQUETE%' OR v_se_name_upper LIKE '%BASQUETEBOL%' THEN
      v_preset_key := 'BASQUETE';
    ELSIF v_sport_name_upper LIKE '%KARATE%' OR v_sport_name_upper LIKE '%KARATÊ%'
       OR v_se_name_upper LIKE '%KARATE%' OR v_se_name_upper LIKE '%KARATÊ%' THEN
      IF v_se_name_upper LIKE '%KATA%' THEN
        v_preset_key := 'KARATE_KATA';
      ELSE
        v_preset_key := 'KARATE_KUMITE';
      END IF;
    ELSIF v_rec.is_collective THEN
      v_preset_key := 'score';
    ELSIF v_sport_name_upper LIKE '%BADMINTON%' OR v_sport_name_upper LIKE '%TENIS DE MESA%'
       OR v_sport_name_upper LIKE '%PING PONG%' OR v_sport_name_upper LIKE '%VOLEIBOL%'
       OR v_sport_name_upper LIKE '%VOLEI%' THEN
      v_preset_key := 'sets';
    ELSIF v_sport_name_upper LIKE '%ATLETISMO%' OR v_sport_name_upper LIKE '%NATACAO%'
       OR v_sport_name_upper LIKE '%NATAÇÃO%' THEN
      -- Check if it's a field event (mark) or track event (time)
      IF v_se_name_upper LIKE '%SALTO%' OR v_se_name_upper LIKE '%ARREMESSO%'
         OR v_se_name_upper LIKE '%LANCAMENTO%' OR v_se_name_upper LIKE '%LANÇAMENTO%'
         OR v_se_name_upper LIKE '%DISCO%' OR v_se_name_upper LIKE '%DARDO%'
         OR v_se_name_upper LIKE '%MARTELO%' OR v_se_name_upper LIKE '%PESO%' THEN
        v_preset_key := 'mark';
      ELSE
        v_preset_key := 'time';
      END IF;
    ELSIF v_sport_name_upper LIKE '%JUDO%' OR v_sport_name_upper LIKE '%JUDÔ%'
       OR v_sport_name_upper LIKE '%LUTA%' OR v_sport_name_upper LIKE '%TAEKWONDO%'
       OR v_sport_name_upper LIKE '%BOXE%' OR v_sport_name_upper LIKE '%WRESTLING%' THEN
      v_preset_key := 'combat';
    ELSIF v_sport_name_upper LIKE '%XADREZ%' OR v_sport_name_upper LIKE '%DAMA%' THEN
      v_preset_key := 'ranking';
    ELSE
      -- Generic fallback
      IF v_rec.is_collective THEN
        v_preset_key := 'score';
      ELSE
        v_preset_key := 'ranking';
      END IF;
    END IF;

    -- Build rules JSON based on preset_key
    CASE v_preset_key
      WHEN 'FUTSAL' THEN
        v_rules := jsonb_build_object(
          'family', 'score', 'format', 'group_stage', 'participant_mode', 'team',
          'scoring', jsonb_build_object('score_type', 'goals', 'walkover_policy', jsonb_build_object('home_goals', 5, 'away_goals', 0)),
          'scheduling', '{}'::jsonb,
          'tie_breakers', '["head_to_head","goal_average","goals_for","goals_against","draw"]'::jsonb,
          'enrollment_limits', '{}'::jsonb,
          'group_points', jsonb_build_object('win', 3, 'draw', 1, 'loss', 0, 'wo_win', 3, 'wo_loss', 0),
          'knockout_tie_resolution', jsonb_build_object('type', 'penalties', 'initial_kicks', 5, 'mode', 'alternating'),
          'preset_key', v_preset_key, 'notes', null
        );
      WHEN 'FUTEBOL_DE_CAMPO' THEN
        v_rules := jsonb_build_object(
          'family', 'score', 'format', 'group_stage', 'participant_mode', 'team',
          'scoring', jsonb_build_object('score_type', 'goals', 'walkover_policy', jsonb_build_object('home_goals', 5, 'away_goals', 0)),
          'scheduling', '{}'::jsonb,
          'tie_breakers', '["head_to_head","goal_average","goal_difference","goals_for","yellow_cards","red_cards","draw"]'::jsonb,
          'enrollment_limits', '{}'::jsonb,
          'group_points', jsonb_build_object('win', 3, 'draw', 1, 'loss', 0, 'wo_win', 3, 'wo_loss', 0),
          'knockout_tie_resolution', jsonb_build_object('type', 'penalties', 'initial_kicks', 5, 'mode', 'alternating'),
          'preset_key', v_preset_key, 'notes', null
        );
      WHEN 'HANDEBOL' THEN
        v_rules := jsonb_build_object(
          'family', 'score', 'format', 'group_stage', 'participant_mode', 'team',
          'scoring', jsonb_build_object('score_type', 'goals', 'walkover_policy', jsonb_build_object('home_goals', 5, 'away_goals', 0)),
          'scheduling', '{}'::jsonb,
          'tie_breakers', '["head_to_head","wins","goal_average","goals_against","goals_for","goal_difference","draw"]'::jsonb,
          'enrollment_limits', '{}'::jsonb,
          'group_points', jsonb_build_object('win', 3, 'draw', 0, 'loss', 1, 'wo_win', 3, 'wo_loss', 0),
          'knockout_tie_resolution', jsonb_build_object('type', 'overtime_plus_shootout', 'overtime_periods', 2, 'overtime_minutes', 5, 'shootout', jsonb_build_object('type', '7m', 'initial_kicks', 3, 'mode', 'alternating')),
          'preset_key', v_preset_key, 'notes', null
        );
      WHEN 'BASQUETE' THEN
        v_rules := jsonb_build_object(
          'family', 'score', 'format', 'group_stage', 'participant_mode', 'team',
          'scoring', jsonb_build_object('score_type', 'points', 'walkover_policy', jsonb_build_object('home_points', 20, 'away_points', 0)),
          'scheduling', '{}'::jsonb,
          'tie_breakers', '["head_to_head","wins","points_average","points_for","points_against","draw"]'::jsonb,
          'enrollment_limits', '{}'::jsonb,
          'group_points', jsonb_build_object('win', 2, 'loss', 1, 'wo_win', 2, 'wo_loss', 0),
          'knockout_tie_resolution', jsonb_build_object('type', 'overtime', 'overtime_minutes', 5, 'repeat_until_winner', true),
          'preset_key', v_preset_key, 'notes', null
        );
      WHEN 'KARATE_KATA' THEN
        v_rules := jsonb_build_object(
          'family', 'ranking', 'format', 'ranking', 'participant_mode', 'individual',
          'scoring', jsonb_build_object('score_type', 'placement_points'),
          'scheduling', '{}'::jsonb,
          'tie_breakers', '[]'::jsonb,
          'enrollment_limits', '{}'::jsonb,
          'ranking_policy', jsonb_build_object('type', 'judges', 'allow_ties', false, 'third_places', 2),
          'kata_rules', jsonb_build_object('no_repeat_each_round', true),
          'preset_key', v_preset_key, 'notes', null
        );
      WHEN 'KARATE_KUMITE' THEN
        v_rules := jsonb_build_object(
          'family', 'combat', 'format', 'combat_bracket', 'participant_mode', 'individual',
          'scoring', jsonb_build_object('score_type', 'combat_points'),
          'scheduling', '{}'::jsonb,
          'tie_breakers', '[]'::jsonb,
          'enrollment_limits', '{}'::jsonb,
          'combat_policy', jsonb_build_object('fight_minutes', 2, 'win_by_point_diff', 8, 'third_places', 2, 'repechage', false),
          'preset_key', v_preset_key, 'notes', null
        );
      ELSE
        -- Use family presets (score, sets, time, mark, combat, ranking)
        CASE v_preset_key
          WHEN 'score' THEN
            v_rules := jsonb_build_object(
              'family', 'score', 'format', 'group_stage', 'participant_mode', 'team',
              'scoring', jsonb_build_object('score_type', 'goals'),
              'scheduling', '{}'::jsonb, 'tie_breakers', '[]'::jsonb,
              'enrollment_limits', '{}'::jsonb, 'preset_key', v_preset_key, 'notes', null
            );
          WHEN 'sets' THEN
            v_rules := jsonb_build_object(
              'family', 'sets', 'format', 'group_stage', 'participant_mode', 'individual',
              'scoring', jsonb_build_object('score_type', 'rally_points', 'best_of', 3, 'set_points', 11),
              'scheduling', '{}'::jsonb, 'tie_breakers', '[]'::jsonb,
              'enrollment_limits', '{}'::jsonb, 'preset_key', v_preset_key, 'notes', null
            );
          WHEN 'time' THEN
            v_rules := jsonb_build_object(
              'family', 'time', 'format', 'heats', 'participant_mode', 'individual',
              'scoring', jsonb_build_object('score_type', 'time_ms'),
              'scheduling', jsonb_build_object('lanes_min', 6, 'lanes_max', 10),
              'tie_breakers', '[]'::jsonb, 'enrollment_limits', '{}'::jsonb,
              'preset_key', v_preset_key, 'notes', null
            );
          WHEN 'mark' THEN
            v_rules := jsonb_build_object(
              'family', 'mark', 'format', 'heats_final', 'participant_mode', 'individual',
              'scoring', jsonb_build_object('score_type', 'distance_cm'),
              'scheduling', '{}'::jsonb, 'tie_breakers', '[]'::jsonb,
              'enrollment_limits', '{}'::jsonb, 'preset_key', v_preset_key, 'notes', null
            );
          WHEN 'combat' THEN
            v_rules := jsonb_build_object(
              'family', 'combat', 'format', 'combat_bracket', 'participant_mode', 'individual',
              'scoring', jsonb_build_object('score_type', 'combat_points'),
              'scheduling', jsonb_build_object('min_rest_minutes', 10),
              'tie_breakers', '[]'::jsonb, 'enrollment_limits', '{}'::jsonb,
              'preset_key', v_preset_key, 'notes', null
            );
          ELSE -- ranking
            v_rules := jsonb_build_object(
              'family', 'ranking', 'format', 'ranking', 'participant_mode', 'individual',
              'scoring', jsonb_build_object('score_type', 'placement_points'),
              'scheduling', '{}'::jsonb, 'tie_breakers', '[]'::jsonb,
              'enrollment_limits', '{}'::jsonb, 'preset_key', v_preset_key, 'notes', null
            );
        END CASE;
    END CASE;

    IF NOT p_dry_run THEN
      IF v_existing THEN
        UPDATE sport_event_rules
        SET rules = v_rules,
            event_id = p_event_id,
            is_active = true,
            updated_at = now(),
            updated_by = v_user_id
        WHERE sport_event_id = v_rec.sport_event_id;
        v_updated := v_updated + 1;
      ELSE
        INSERT INTO sport_event_rules (sport_event_id, event_id, rules, is_active, created_by, updated_by)
        VALUES (v_rec.sport_event_id, p_event_id, v_rules, true, v_user_id, v_user_id);
        v_created := v_created + 1;
      END IF;
    ELSE
      IF v_existing THEN
        v_updated := v_updated + 1;
      ELSE
        v_created := v_created + 1;
      END IF;
    END IF;

    -- Track by_preset
    v_by_preset := jsonb_set(
      v_by_preset,
      ARRAY[v_preset_key],
      to_jsonb(COALESCE((v_by_preset->>v_preset_key)::int, 0) + 1)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'total_sport_events', v_total,
    'created', v_created,
    'updated', v_updated,
    'skipped', v_skipped,
    'by_preset', v_by_preset,
    'dry_run', p_dry_run
  );
END;
$$;

-- Ensure unaccent extension exists
CREATE EXTENSION IF NOT EXISTS unaccent;
