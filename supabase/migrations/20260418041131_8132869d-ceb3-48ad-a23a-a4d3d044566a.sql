INSERT INTO public.event_edition_rules (event_id, version, status, sections, notes)
SELECT
  'de0cd62b-05b9-4147-9257-9543d61d5739'::uuid,
  1,
  'draft',
  jsonb_build_object(
    'edition', jsonb_build_object(
      'year', 2026,
      'event_type', 'JERS+JERPA',
      'edition_name', '53º Jogos Escolares de Roraima (JERs) e 1º JERPA 2026',
      'notes', 'Rascunho inicial gerado a partir de event_participation_rules'
    ),
    'participation_limits', jsonb_build_object(
      'max_collective_teams_per_athlete', 1,
      'max_individual_sports_per_athlete', 2,
      'max_events_per_individual_sport', 6,
      'special_rules', 'JERPA: 1 modalidade. JERs coletivo: 1. JERs individual: 2.'
    ),
    'operational', jsonb_build_array(
      jsonb_build_object('key','wo_minutes','label','Tolerância W.O. (min)','value','5','category','prazo'),
      jsonb_build_object('key','wxo_minutes','label','Tolerância WxO (min)','value','15','category','prazo'),
      jsonb_build_object('key','protest_deadline_minutes','label','Prazo de protesto (min)','value','60','category','protesto'),
      jsonb_build_object('key','credential_second_copy_max_hours','label','2ª via credencial (h)','value','3','category','prazo'),
      jsonb_build_object('key','national_no_show_ban_years','label','Banimento nacional por ausência (anos)','value','2','category','ausencia'),
      jsonb_build_object('key','food_donation_kg','label','Doação alimentos (kg)','value','3','category','geral'),
      jsonb_build_object('key','alcohol_and_smoking_prohibited','label','Proibido álcool e fumo','value','true','category','geral'),
      jsonb_build_object('key','weapons_prohibited','label','Armas proibidas','value','true','category','geral'),
      jsonb_build_object('key','medical_fitness_report_required','label','Atestado médico exigido','value','true','category','geral')
    ),
    'championship_scoring', jsonb_build_object(
      'scoring_table', jsonb_build_array(
        jsonb_build_object('position',1,'points',10),
        jsonb_build_object('position',2,'points',8),
        jsonb_build_object('position',3,'points',6),
        jsonb_build_object('position',4,'points',5),
        jsonb_build_object('position',5,'points',4),
        jsonb_build_object('position',6,'points',3),
        jsonb_build_object('position',7,'points',2),
        jsonb_build_object('position',8,'points',1)
      ),
      'tiebreakers', jsonb_build_array('Maior número de 1º lugares','Maior número de 2º lugares','Maior número de 3º lugares','Confronto direto'),
      'collective_rules', 'Pontuação multiplicada por fator definido em regulamento.',
      'individual_rules', 'Pontuação por atleta classificado.'
    ),
    'categories', '[]'::jsonb,
    'sports', '[]'::jsonb,
    'classification', '[]'::jsonb
  ),
  'Rascunho inicial criado automaticamente a partir de event_participation_rules'
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_edition_rules WHERE event_id = 'de0cd62b-05b9-4147-9257-9543d61d5739'::uuid
);