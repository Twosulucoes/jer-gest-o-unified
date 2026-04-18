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
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_is_coord boolean;
  v_rec record;
  v_preset_key text;
  v_rules jsonb;
  v_created int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_total int := 0;
  v_by_preset jsonb := '{}'::jsonb;
  v_sport_norm text;
  v_se_norm text;
  v_cat_norm text;
  v_is_para boolean;
  v_op_rules jsonb := '{"wxo_minutes":15,"wo_refusal_minutes":5}'::jsonb;
BEGIN
  -- Permission check
  v_is_admin := has_role(v_uid, 'admin');
  v_is_coord := has_role(v_uid, 'coordenacao_tecnica');

  IF NOT v_is_admin AND NOT v_is_coord THEN
    RAISE EXCEPTION 'Permissão negada: requer admin ou coordenacao_tecnica';
  END IF;

  IF p_mode = 'overwrite' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Modo overwrite requer perfil admin';
  END IF;

  FOR v_rec IN
    SELECT se.id AS sport_event_id,
           se.name AS se_name,
           s.name AS sport_name,
           c.name AS cat_name,
           c.gender_scope,
           s.is_collective,
           CASE WHEN ser.id IS NOT NULL THEN true ELSE false END AS has_rules
    FROM sport_events se
    JOIN sports s ON s.id = se.sport_id
    JOIN categories c ON c.id = se.category_id
    LEFT JOIN sport_event_rules ser ON ser.sport_event_id = se.id
    WHERE se.event_id = p_event_id AND se.is_active = true
  LOOP
    v_total := v_total + 1;

    -- Skip if exists and mode is missing_only
    IF v_rec.has_rules AND p_mode = 'missing_only' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Normalize strings for matching
    v_sport_norm := lower(unaccent(v_rec.sport_name));
    v_se_norm := lower(unaccent(v_rec.se_name));
    v_cat_norm := lower(unaccent(v_rec.cat_name));

    -- Check if paralimpic
    v_is_para := (v_sport_norm ~* 'paralimp|paralímp' OR v_se_norm ~* 'paralimp|paralímp' OR v_sport_norm ~* 'jerpa' OR v_se_norm ~* 'jerpa');

    -- Route to preset
    v_preset_key := NULL;

    IF v_is_para THEN
      -- JERPA routing
      IF v_sport_norm ~* 'bocha' OR v_se_norm ~* 'bocha' THEN
        v_preset_key := 'BOCHA_PARALIMPICA';
      ELSIF v_sport_norm ~* 'parabadminton' OR v_se_norm ~* 'parabadminton' THEN
        v_preset_key := 'PARABADMINTON';
      ELSIF v_sport_norm ~* 'tenis de mesa|tênis de mesa' OR v_se_norm ~* 'tenis de mesa|tênis de mesa' THEN
        v_preset_key := 'TENIS_DE_MESA_PARALIMPICO';
      ELSIF v_sport_norm ~* 'natacao|natação' OR v_se_norm ~* 'natacao|natação' THEN
        v_preset_key := 'NATACAO_PARALIMPICA';
      ELSIF v_sport_norm ~* 'atletismo' OR v_se_norm ~* 'atletismo' THEN
        v_preset_key := 'ATLETISMO_PARALIMPICO';
      ELSE
        v_preset_key := 'ATLETISMO_PARALIMPICO'; -- fallback JERPA
      END IF;
    ELSE
      -- JER routing
      IF v_sport_norm ~* 'futsal' OR v_se_norm ~* 'futsal' THEN
        v_preset_key := 'FUTSAL';
      ELSIF v_sport_norm ~* 'futebol' OR v_se_norm ~* 'futebol' THEN
        v_preset_key := 'FUTEBOL';
      ELSIF v_sport_norm ~* 'handebol' OR v_se_norm ~* 'handebol' THEN
        v_preset_key := 'HANDEBOL';
      ELSIF v_sport_norm ~* 'basquete|basquetebol' OR v_se_norm ~* 'basquete|basquetebol' THEN
        v_preset_key := 'BASQUETEBOL';
      ELSIF v_sport_norm ~* 'volei de praia|vôlei de praia|voleibol de praia' OR v_se_norm ~* 'volei de praia|vôlei de praia|voleibol de praia' THEN
        IF v_cat_norm ~* '12|13|14|sub.?14|infantil' THEN
          v_preset_key := 'VOLEI_DE_PRAIA_12_14';
        ELSE
          v_preset_key := 'VOLEI_DE_PRAIA_15_17';
        END IF;
      ELSIF v_sport_norm ~* 'voleibol|vôlei' OR v_se_norm ~* 'voleibol|vôlei' THEN
        v_preset_key := 'VOLEIBOL';
      ELSIF v_sport_norm ~* 'judo|judô' OR v_se_norm ~* 'judo|judô' THEN
        v_preset_key := 'JUDO';
      ELSIF v_sport_norm ~* 'karate|karatê' OR v_se_norm ~* 'karate|karatê' THEN
        IF v_se_norm ~* 'kata' THEN
          v_preset_key := 'KARATE_KATA';
        ELSE
          v_preset_key := 'KARATE_KUMITE';
        END IF;
      ELSIF v_sport_norm ~* 'taekwondo' OR v_se_norm ~* 'taekwondo' THEN
        v_preset_key := 'TAEKWONDO';
      ELSIF v_sport_norm ~* 'wrestling|luta olimpica|luta olímpica' OR v_se_norm ~* 'wrestling|luta olimpica|luta olímpica' THEN
        v_preset_key := 'WRESTLING';
      ELSIF v_sport_norm ~* 'badminton' OR v_se_norm ~* 'badminton' THEN
        v_preset_key := 'BADMINTON';
      ELSIF v_sport_norm ~* 'tenis de mesa|tênis de mesa' OR v_se_norm ~* 'tenis de mesa|tênis de mesa' THEN
        v_preset_key := 'TENIS_DE_MESA';
      ELSIF v_sport_norm ~* 'tiro com arco' OR v_se_norm ~* 'tiro com arco' THEN
        v_preset_key := 'TIRO_COM_ARCO';
      ELSIF v_sport_norm ~* 'xadrez' OR v_se_norm ~* 'xadrez' THEN
        v_preset_key := 'XADREZ';
      ELSIF v_sport_norm ~* 'ginastica ritmica|ginástica rítmica' OR v_se_norm ~* 'ginastica ritmica|ginástica rítmica' THEN
        v_preset_key := 'GINASTICA_RITMICA';
      ELSIF v_sport_norm ~* 'natacao|natação' OR v_se_norm ~* 'natacao|natação' THEN
        v_preset_key := 'NATACAO';
      ELSIF v_sport_norm ~* 'ciclismo' OR v_se_norm ~* 'ciclismo' THEN
        v_preset_key := 'CICLISMO';
      ELSIF v_sport_norm ~* 'atletismo' OR v_se_norm ~* 'atletismo' THEN
        -- Sub-route athletics
        IF v_se_norm ~* 'salto|lanc|arrem|peso|dardo|disco|martelo' THEN
          v_preset_key := 'ATLETISMO_CAMPO';
        ELSIF v_se_norm ~* 'pentatlo|hexatlo|combinad|decatlo|heptatlo' THEN
          v_preset_key := 'ATLETISMO_COMBINADAS';
        ELSE
          v_preset_key := 'ATLETISMO_PISTA';
        END IF;
      ELSE
        -- Fallback by sport type
        IF v_rec.is_collective THEN
          v_preset_key := 'FUTSAL'; -- generic collective fallback
        ELSE
          v_preset_key := 'ATLETISMO_PISTA'; -- generic individual fallback
        END IF;
      END IF;
    END IF;

    -- Build rules JSON based on preset_key
    v_rules := rpc_build_preset_rules(v_preset_key);
    -- Always inject operational_rules
    v_rules := v_rules || jsonb_build_object('operational_rules', v_op_rules);
    v_rules := v_rules || jsonb_build_object('preset_key', v_preset_key);

    IF NOT p_dry_run THEN
      INSERT INTO sport_event_rules (sport_event_id, event_id, rules, is_active, created_by, updated_by)
      VALUES (v_rec.sport_event_id, p_event_id, v_rules, true, v_uid, v_uid)
      ON CONFLICT (sport_event_id) DO UPDATE SET
        rules = EXCLUDED.rules,
        event_id = EXCLUDED.event_id,
        is_active = true,
        updated_by = v_uid,
        updated_at = now();

      IF v_rec.has_rules THEN
        v_updated := v_updated + 1;
      ELSE
        v_created := v_created + 1;
      END IF;
    ELSE
      IF v_rec.has_rules THEN
        v_updated := v_updated + 1;
      ELSE
        v_created := v_created + 1;
      END IF;
    END IF;

    -- Count by preset
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

-- Helper function that builds the preset rules JSON
CREATE OR REPLACE FUNCTION public.rpc_build_preset_rules(p_preset_key text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN CASE p_preset_key
    -- COLETIVAS
    WHEN 'FUTSAL' THEN '{"family":"score","format":"group_stage","participant_mode":"team","scoring":{"score_type":"goals","walkover_policy":{"home_goals":3,"away_goals":0}},"scheduling":{},"tie_breakers":["head_to_head","goal_average","goals_for","goals_against","yellow_cards","red_cards","draw"],"enrollment_limits":{},"group_points":{"win":3,"draw":1,"loss":0,"wo_win":3,"wo_loss":0},"knockout_tie_resolution":{"type":"overtime_plus_penalties","overtime_periods":2,"overtime_minutes":5,"penalties":{"initial_kicks":3,"mode":"alternating"}}}'::jsonb
    WHEN 'FUTEBOL' THEN '{"family":"score","format":"group_stage","participant_mode":"team","scoring":{"score_type":"goals","walkover_policy":{"home_goals":3,"away_goals":0}},"scheduling":{},"tie_breakers":["head_to_head","goal_average","goal_difference","goals_for","yellow_cards","red_cards","draw"],"enrollment_limits":{},"group_points":{"win":3,"draw":1,"loss":0,"wo_win":3,"wo_loss":0},"knockout_tie_resolution":{"type":"penalties","initial_kicks":5,"mode":"alternating"}}'::jsonb
    WHEN 'HANDEBOL' THEN '{"family":"score","format":"group_stage","participant_mode":"team","scoring":{"score_type":"goals","walkover_policy":{"home_goals":10,"away_goals":0}},"scheduling":{},"tie_breakers":["head_to_head","wins","goal_average","goals_against","goals_for","goal_difference","draw"],"enrollment_limits":{},"group_points":{"win":2,"draw":1,"loss":0,"wo_win":2,"wo_loss":0},"knockout_tie_resolution":{"type":"overtime_plus_shootout","overtime_periods":2,"overtime_minutes":5,"shootout":{"type":"7m","initial_kicks":5,"mode":"alternating"}}}'::jsonb
    WHEN 'BASQUETEBOL' THEN '{"family":"score","format":"group_stage","participant_mode":"team","scoring":{"score_type":"points","walkover_policy":{"home_points":20,"away_points":0}},"scheduling":{},"tie_breakers":["head_to_head","points_quotient_between","points_quotient_overall","points_for","draw"],"enrollment_limits":{},"group_points":{"win":2,"loss":1,"wo_win":2,"wo_loss":0},"knockout_tie_resolution":{"type":"overtime","overtime_minutes":5,"repeat_until_winner":true}}'::jsonb
    WHEN 'VOLEIBOL' THEN '{"family":"sets","format":"group_stage","participant_mode":"team","scoring":{"score_type":"rally_points","best_of":5,"set_points":25,"walkover_policy":{"sets":"3-0"}},"scheduling":{},"tie_breakers":["points_table","sets_quotient","points_quotient","head_to_head_recalc","draw"],"enrollment_limits":{},"group_points":{"win":0,"draw":0,"loss":0,"special":{"3-0":{"winner":3,"loser":0},"3-1":{"winner":3,"loser":0},"3-2":{"winner":2,"loser":1}}},"sets_policy":{"set_1_4":25,"set_5":15,"win_by_2":true}}'::jsonb
    WHEN 'VOLEI_DE_PRAIA_12_14' THEN '{"family":"sets","format":"round_robin","participant_mode":"pair","scoring":{"score_type":"rally_points","best_of":3,"set_points":21,"walkover_policy":{"sets":"2-0"}},"scheduling":{},"tie_breakers":["sets_quotient","points_quotient","draw"],"enrollment_limits":{},"group_points":{"win":0,"draw":0,"loss":0,"special":{"2-0":{"winner":3,"loser":0},"2-1":{"winner":2,"loser":1}}},"sets_policy":{"set_1_2":21,"set_3":15,"win_by_2":true},"allow_knockout":true}'::jsonb
    WHEN 'VOLEI_DE_PRAIA_15_17' THEN '{"family":"sets","format":"group_stage","participant_mode":"pair","scoring":{"score_type":"rally_points","best_of":3,"set_points":21,"walkover_policy":{"sets":"2-0"}},"scheduling":{},"tie_breakers":["sets_quotient","points_quotient","draw"],"enrollment_limits":{},"group_points":{"win":0,"draw":0,"loss":0,"special":{"2-0":{"winner":3,"loser":0},"2-1":{"winner":2,"loser":1}}},"sets_policy":{"set_1_2":21,"set_3":15,"win_by_2":true},"allow_knockout":true}'::jsonb
    -- COMBATE
    WHEN 'JUDO' THEN '{"family":"combat","format":"combat_bracket","participant_mode":"individual","scoring":{"score_type":"combat_points"},"scheduling":{},"tie_breakers":[],"enrollment_limits":{},"medals_policy":{"third_places":2,"repechage":true},"combat_policy":{"golden_score":true,"time_by_category":true}}'::jsonb
    WHEN 'KARATE_KATA' THEN '{"family":"ranking","format":"ranking","participant_mode":"individual","scoring":{"score_type":"placement_points"},"scheduling":{},"tie_breakers":[],"enrollment_limits":{},"ranking_policy":{"type":"judges","allow_ties":false,"third_places":2},"medals_policy":{"third_places":2,"repechage":null},"kata_rules":{"no_repeat_each_round":true}}'::jsonb
    WHEN 'KARATE_KUMITE' THEN '{"family":"combat","format":"combat_bracket","participant_mode":"individual","scoring":{"score_type":"combat_points"},"scheduling":{},"tie_breakers":[],"enrollment_limits":{},"medals_policy":{"third_places":2,"repechage":false},"combat_policy":{"fight_minutes":2,"win_by_point_diff":8,"senshu":true,"third_places":2},"notes":"Repescagem conforme regulamento específico do evento."}'::jsonb
    WHEN 'TAEKWONDO' THEN '{"family":"combat","format":"combat_bracket","participant_mode":"individual","scoring":{"score_type":"combat_points"},"scheduling":{},"tie_breakers":[],"enrollment_limits":{},"medals_policy":{"third_places":2,"repechage":true},"combat_policy":{"rounds":3,"round_minutes":2,"golden_point":true}}'::jsonb
    WHEN 'WRESTLING' THEN '{"family":"combat","format":"combat_bracket","participant_mode":"individual","scoring":{"score_type":"combat_points"},"scheduling":{},"tie_breakers":[],"enrollment_limits":{},"medals_policy":{"third_places":2,"repechage":true},"combat_policy":{"tech_fall_diff":10,"pin":true,"periods":2,"period_minutes":3}}'::jsonb
    -- TEMPO / MARCA
    WHEN 'ATLETISMO_PISTA' THEN '{"family":"time","format":"heats_final","participant_mode":"individual","scoring":{"score_type":"time_ms"},"scheduling":{"lanes_min":6,"lanes_max":8},"tie_breakers":[],"enrollment_limits":{},"ranking_policy":{"type":"time"}}'::jsonb
    WHEN 'ATLETISMO_CAMPO' THEN '{"family":"mark","format":"ranking","participant_mode":"individual","scoring":{"score_type":"distance_cm"},"scheduling":{},"tie_breakers":[],"enrollment_limits":{},"ranking_policy":{"type":"mark"},"attempts_policy":{"qualifying":3,"final":3}}'::jsonb
    WHEN 'ATLETISMO_COMBINADAS' THEN '{"family":"ranking","format":"ranking","participant_mode":"individual","scoring":{"score_type":"placement_points"},"scheduling":{},"tie_breakers":[],"enrollment_limits":{},"ranking_policy":{"type":"combined_points","tables":"IAAF"}}'::jsonb
    WHEN 'NATACAO' THEN '{"family":"time","format":"heats_final","participant_mode":"individual","scoring":{"score_type":"time_ms"},"scheduling":{"lanes_min":6,"lanes_max":10},"tie_breakers":[],"enrollment_limits":{},"ranking_policy":{"type":"time","tie_advance_both":true}}'::jsonb
    WHEN 'CICLISMO' THEN '{"family":"time","format":"ranking","participant_mode":"individual","scoring":{"score_type":"time_ms"},"scheduling":{},"tie_breakers":[],"enrollment_limits":{},"ranking_policy":{"type":"time_total"}}'::jsonb
    -- SETS / TÉCNICO
    WHEN 'BADMINTON' THEN '{"family":"sets","format":"group_stage","participant_mode":"individual","scoring":{"score_type":"rally_points","best_of":3,"set_points":21},"scheduling":{},"tie_breakers":["head_to_head","games_quotient","points_quotient","draw"],"enrollment_limits":{},"group_points":{"win":2,"loss":1,"wo_win":2,"wo_loss":0},"sets_policy":{"game_to":21,"cap":30,"win_by_2":true},"allow_rr_if_few":true}'::jsonb
    WHEN 'TENIS_DE_MESA' THEN '{"family":"sets","format":"group_stage","participant_mode":"individual","scoring":{"score_type":"rally_points","best_of":5,"set_points":11},"scheduling":{},"tie_breakers":["head_to_head","games_quotient","points_quotient","draw"],"enrollment_limits":{},"group_points":{"win":2,"loss":1,"wo_win":2,"wo_loss":0},"sets_policy":{"game_to":11,"win_by_2":true},"allow_rr_if_few":true}'::jsonb
    WHEN 'TIRO_COM_ARCO' THEN '{"family":"sets","format":"knockout","participant_mode":"individual","scoring":{"score_type":"points"},"scheduling":{},"tie_breakers":[],"enrollment_limits":{},"archery_policy":{"ranking_round":"72_arrows","elimination_set_system_first_to":6,"shoot_off":true}}'::jsonb
    -- RANKING
    WHEN 'XADREZ' THEN '{"family":"ranking","format":"swiss","participant_mode":"individual","scoring":{"score_type":"placement_points"},"scheduling":{},"tie_breakers":["buchholz","buchholz_cut","sonneborn_berger","wins","head_to_head","draw"],"enrollment_limits":{},"ranking_policy":{"type":"swiss"}}'::jsonb
    WHEN 'GINASTICA_RITMICA' THEN '{"family":"ranking","format":"ranking","participant_mode":"individual","scoring":{"score_type":"placement_points"},"scheduling":{},"tie_breakers":["D_total","E_total","penalties_total"],"enrollment_limits":{},"ranking_policy":{"type":"judges","formula":"D+E-penalties"}}'::jsonb
    -- PARALÍMPICAS
    WHEN 'ATLETISMO_PARALIMPICO' THEN '{"family":"time","format":"heats_final","participant_mode":"individual","scoring":{"score_type":"time_ms"},"scheduling":{"lanes_min":4,"lanes_max":8},"tie_breakers":[],"enrollment_limits":{},"ranking_policy":{"type":"time"},"disability_policy":{"class_required":true,"class_field":"functional_class"}}'::jsonb
    WHEN 'NATACAO_PARALIMPICA' THEN '{"family":"time","format":"heats_final","participant_mode":"individual","scoring":{"score_type":"time_ms"},"scheduling":{"lanes_min":4,"lanes_max":8},"tie_breakers":[],"enrollment_limits":{},"ranking_policy":{"type":"time"},"disability_policy":{"class_required":true,"class_field":"functional_class"}}'::jsonb
    WHEN 'TENIS_DE_MESA_PARALIMPICO' THEN '{"family":"sets","format":"group_stage","participant_mode":"individual","scoring":{"score_type":"rally_points","best_of":5,"set_points":11},"scheduling":{},"tie_breakers":["head_to_head","games_quotient","points_quotient","draw"],"enrollment_limits":{},"group_points":{"win":2,"loss":1,"wo_win":2,"wo_loss":0},"disability_policy":{"class_required":true,"class_field":"functional_class"}}'::jsonb
    WHEN 'PARABADMINTON' THEN '{"family":"sets","format":"group_stage","participant_mode":"individual","scoring":{"score_type":"rally_points","best_of":3,"set_points":21},"scheduling":{},"tie_breakers":["head_to_head","games_quotient","points_quotient","draw"],"enrollment_limits":{},"group_points":{"win":2,"loss":1,"wo_win":2,"wo_loss":0},"disability_policy":{"class_required":true,"class_field":"functional_class"}}'::jsonb
    WHEN 'BOCHA_PARALIMPICA' THEN '{"family":"score","format":"group_stage","participant_mode":"individual","scoring":{"score_type":"points"},"scheduling":{},"tie_breakers":[],"enrollment_limits":{},"group_points":{"win":2,"loss":0,"wo_win":2,"wo_loss":0},"boccia_policy":{"ends_individual":4,"ends_team":6,"golden_end_on_tie":true},"disability_policy":{"class_required":true,"class_field":"functional_class"}}'::jsonb
    -- FALLBACK
    ELSE '{"family":"score","format":"group_stage","participant_mode":"team","scoring":{"score_type":"goals"},"scheduling":{},"tie_breakers":[],"enrollment_limits":{}}'::jsonb
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_seed_sport_event_rules_for_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_seed_sport_event_rules_for_event TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_build_preset_rules FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_build_preset_rules TO authenticated;