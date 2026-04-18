
-- Limpeza total de dados operacionais de todos os eventos
-- Ordem: folhas primeiro, tabelas-pai depois

-- Competição (folhas)
DELETE FROM public.match_player_stats;
DELETE FROM public.match_penalties;
DELETE FROM public.match_events;
DELETE FROM public.match_lineups;
DELETE FROM public.match_attempts;
DELETE FROM public.match_scores;
DELETE FROM public.match_attachments;
DELETE FROM public.match_officials;
DELETE FROM public.competition_match_results;
DELETE FROM public.competition_match_entries;
DELETE FROM public.competition_matches;
DELETE FROM public.competition_groups;
DELETE FROM public.competition_phases;

-- Credenciais e scans
DELETE FROM public.credential_scans;
DELETE FROM public.participant_credentials;

-- Alimentação (consumo)
DELETE FROM public.meal_consumptions;

-- Alojamento (ocupação)
DELETE FROM public.lodging_occupancies;

-- Irregularidades e mapa de provas
DELETE FROM public.participation_irregularities;
DELETE FROM public.sport_event_prova_map;
DELETE FROM public.prova_aliases;

-- Equipes
DELETE FROM public.team_members;
DELETE FROM public.teams;

-- Inscrições em provas
DELETE FROM public.participant_sport_events;

-- Participantes
DELETE FROM public.participants;

-- Provas (sport_events)
DELETE FROM public.sport_events;

-- Pessoas
DELETE FROM public.people;

-- Delegações
DELETE FROM public.delegations;

-- Instituições
DELETE FROM public.institutions;

-- Modalidades e categorias
DELETE FROM public.sports;
DELETE FROM public.categories;

-- Logs de importação
DELETE FROM public.import_row_errors;
DELETE FROM public.import_logs;

-- Regras de participação
DELETE FROM public.event_participation_rules;
