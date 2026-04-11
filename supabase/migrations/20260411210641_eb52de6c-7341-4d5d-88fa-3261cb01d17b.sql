
CREATE OR REPLACE FUNCTION public.reset_all_data(p_confirm text DEFAULT '')
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Segurança: exigir confirmação explícita
  IF p_confirm <> 'SIM_APAGAR_TUDO' THEN
    RAISE EXCEPTION 'Para confirmar, chame: SELECT reset_all_data(''SIM_APAGAR_TUDO'')';
  END IF;

  -- Apenas admin pode executar
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas admin pode executar reset' USING ERRCODE = '42501';
  END IF;

  -- 1. Competição (ordem de dependência)
  DELETE FROM public.match_player_stats;
  DELETE FROM public.match_penalties;
  DELETE FROM public.match_events;
  DELETE FROM public.match_lineups;
  DELETE FROM public.match_scores;
  DELETE FROM public.match_officials;
  DELETE FROM public.match_attachments;
  DELETE FROM public.match_attempts;
  DELETE FROM public.competition_match_results;
  DELETE FROM public.competition_match_entries;
  DELETE FROM public.competition_matches;
  DELETE FROM public.competition_groups;
  DELETE FROM public.competition_phases;

  -- 2. Credenciamento
  DELETE FROM public.credential_scans;
  DELETE FROM public.participant_credentials;

  -- 3. Logística
  DELETE FROM public.transport_passengers;
  DELETE FROM public.transport_trips;
  DELETE FROM public.meal_consumptions;
  DELETE FROM public.lodging_occupancies;

  -- 4. Irregularidades e mapas
  DELETE FROM public.participation_irregularities;
  DELETE FROM public.sport_event_prova_map;
  DELETE FROM public.prova_catalog;
  DELETE FROM public.prova_aliases;

  -- 5. Inscrições e equipes
  DELETE FROM public.team_members;
  DELETE FROM public.teams;
  DELETE FROM public.participant_sport_events;

  -- 6. Participantes e pessoas
  DELETE FROM public.participants;
  DELETE FROM public.people;

  -- 7. Estrutura esportiva
  DELETE FROM public.sport_events;
  DELETE FROM public.categories;
  DELETE FROM public.sports;

  -- 8. Delegações e instituições
  DELETE FROM public.delegations;
  DELETE FROM public.institutions;

  -- 9. Importação
  DELETE FROM public.import_row_errors;
  DELETE FROM public.import_logs;

  -- 10. Parâmetros
  DELETE FROM public.event_participation_rules;

  -- PRESERVADOS: events, profiles, user_roles, credential_templates,
  --              meal_types, meal_windows, venues,
  --              transport_vehicles, transport_routes,
  --              lodging_locations, lodging_units

  RETURN jsonb_build_object('status', 'ok', 'message', 'Todos os dados operacionais foram removidos.');
END;
$$;
