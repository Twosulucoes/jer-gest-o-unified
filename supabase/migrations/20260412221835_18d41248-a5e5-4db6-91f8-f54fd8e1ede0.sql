-- Preencher minimo_participantes nas regras existentes baseado no preset_key
-- Coletivas
UPDATE public.sport_event_rules SET rules = rules || '{"minimo_participantes": 5}'::jsonb WHERE rules->>'preset_key' = 'FUTSAL' AND (rules->>'minimo_participantes') IS NULL;
UPDATE public.sport_event_rules SET rules = rules || '{"minimo_participantes": 7}'::jsonb WHERE rules->>'preset_key' = 'FUTEBOL' AND (rules->>'minimo_participantes') IS NULL;
UPDATE public.sport_event_rules SET rules = rules || '{"minimo_participantes": 7}'::jsonb WHERE rules->>'preset_key' = 'HANDEBOL' AND (rules->>'minimo_participantes') IS NULL;
UPDATE public.sport_event_rules SET rules = rules || '{"minimo_participantes": 4}'::jsonb WHERE rules->>'preset_key' = 'BASQUETEBOL' AND (rules->>'minimo_participantes') IS NULL;
UPDATE public.sport_event_rules SET rules = rules || '{"minimo_participantes": 6}'::jsonb WHERE rules->>'preset_key' = 'VOLEIBOL' AND (rules->>'minimo_participantes') IS NULL;
UPDATE public.sport_event_rules SET rules = rules || '{"minimo_participantes": 2}'::jsonb WHERE rules->>'preset_key' LIKE 'VOLEI_DE_PRAIA%' AND (rules->>'minimo_participantes') IS NULL;

-- Ginástica Rítmica (1)
UPDATE public.sport_event_rules SET rules = rules || '{"minimo_participantes": 1}'::jsonb WHERE rules->>'preset_key' = 'GINASTICA_RITMICA' AND (rules->>'minimo_participantes') IS NULL;

-- Tudo o resto que não foi atualizado acima recebe valor padrão 2
UPDATE public.sport_event_rules SET rules = rules || '{"minimo_participantes": 2}'::jsonb WHERE (rules->>'minimo_participantes') IS NULL;