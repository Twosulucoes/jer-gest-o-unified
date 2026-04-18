-- Atualiza rascunho v1 das regras da edição com extração criteriosa do Regulamento Geral JER's + JERPA 2026
UPDATE public.event_edition_rules
SET 
  sections = jsonb_build_object(
    'edition', jsonb_build_object(
      'year', 2026,
      'event_type', 'JERS+JERPA',
      'edition_name', E'53\u00ba Jogos Escolares de Roraima (JER\u2019s) e 1\u00ba JERPA 2026',
      'notes', E'Rascunho v1 populado a partir do Regulamento Geral oficial publicado em 06/03/2026 (Boa Vista). Modalidades, categorias e classifica\u00e7\u00e3o aguardam regulamentos espec\u00edficos por modalidade.'
    ),

    'categories', jsonb_build_array(
      jsonb_build_object('id','jers-12-14','name',E'JER\u2019s - 12 a 14 anos','min_birth_year',2012,'max_birth_year',2014,'gender_scope','both','notes','Modalidades individuais e coletivas (Art.14 \u00a71\u00ba I e \u00a72\u00ba I)'),
      jsonb_build_object('id','jers-15-17','name',E'JER\u2019s - 15 a 17 anos','min_birth_year',2009,'max_birth_year',2011,'gender_scope','both','notes','Modalidades individuais e coletivas; coletivas formam sele\u00e7\u00f5es estaduais para nacional (Art.1 III, Art.14 \u00a72\u00ba II)'),
      jsonb_build_object('id','jers-gr-11-12','name','GR Feminino 11-12 anos','min_birth_year',2014,'max_birth_year',2015,'gender_scope','female','notes','Gin\u00e1stica R\u00edtmica exclusivamente feminina (Art.14 \u00a71\u00ba I)'),
      jsonb_build_object('id','jers-gr-13-15','name','GR Feminino 13-15 anos','min_birth_year',2011,'max_birth_year',2013,'gender_scope','female','notes','Gin\u00e1stica R\u00edtmica exclusivamente feminina (Art.14 \u00a71\u00ba II)'),
      jsonb_build_object('id','jerpa-11-14','name','JERPA - 11 a 14 anos','min_birth_year',2012,'max_birth_year',2015,'gender_scope','both','notes','Categorias paral\u00edmpicas; depende de classifica\u00e7\u00e3o funcional (Art.20 \u00a71\u00ba I)'),
      jsonb_build_object('id','jerpa-15-17','name','JERPA - 15 a 17 anos','min_birth_year',2009,'max_birth_year',2011,'gender_scope','both','notes','Categorias paral\u00edmpicas; depende de classifica\u00e7\u00e3o funcional (Art.20 \u00a71\u00ba II)')
    ),

    'sports', jsonb_build_array(
      jsonb_build_object('id','jers-coletivas-12-14','sport_name','Coletivas 12-14','category_name','12 a 14','gender_scope','both','participant_mode','team','is_jerpa',false,'notes','Basquetebol, Futsal, Handebol, Voleibol, V\u00f4lei de Praia (Art.14 \u00a72\u00ba I)'),
      jsonb_build_object('id','jers-coletivas-15-17','sport_name','Coletivas 15-17','category_name','15 a 17','gender_scope','both','participant_mode','team','is_jerpa',false,'notes','Basquetebol, Futsal, Handebol, Voleibol, Futebol (Art.14 \u00a72\u00ba II)'),
      jsonb_build_object('id','jers-individuais-12-14','sport_name','Individuais 12-14','category_name','12 a 14','gender_scope','both','participant_mode','individual','is_jerpa',false,'notes','Atletismo, Badminton, Ciclismo, Jud\u00f4, Karat\u00ea, Nata\u00e7\u00e3o, Taekwondo, T\u00eanis de Mesa, Tiro com Arco, Wrestling, Xadrez (Art.14 \u00a71\u00ba I)'),
      jsonb_build_object('id','jers-individuais-15-17','sport_name','Individuais 15-17','category_name','15 a 17','gender_scope','both','participant_mode','individual','is_jerpa',false,'notes','Atletismo, Badminton, Ciclismo, Jud\u00f4, Karat\u00ea, Nata\u00e7\u00e3o, Taekwondo, T\u00eanis de Mesa, Tiro com Arco, V\u00f4lei de Praia, Wrestling, Xadrez (Art.14 \u00a71\u00ba II)'),
      jsonb_build_object('id','jerpa-individuais','sport_name','JERPA Individuais','category_name','11-14 e 15-17','gender_scope','both','participant_mode','individual','is_jerpa',true,'notes','Atletismo, Nata\u00e7\u00e3o, T\u00eanis de Mesa, Parabadminton, Bocha Paral\u00edmpica (Art.20-21)')
    ),

    'participation_limits', jsonb_build_object(
      'max_collective_teams_per_athlete', 1,
      'max_individual_sports_per_athlete', 2,
      'max_events_per_individual_sport', 6,
      'max_jerpa_modalities_per_athlete', 1,
      'min_athletes_per_team', jsonb_build_object(),
      'max_athletes_per_team', jsonb_build_object(
        'basquetebol_12_14_por_genero', 10,
        'futsal_12_14_por_genero', 10,
        'handebol_12_14_por_genero', 12,
        'voleibol_12_14_por_genero', 12,
        'basquetebol_15_17_por_genero', 10,
        'futsal_15_17_por_genero', 10,
        'futebol_15_17_por_genero', 16,
        'handebol_15_17_por_genero', 14,
        'voleibol_15_17_por_genero', 12,
        'jerpa_atletismo_por_genero', 12,
        'jerpa_natacao_por_genero', 10,
        'jerpa_bocha_por_genero', 4,
        'jerpa_parabadminton_por_genero', 4,
        'jerpa_tenis_mesa_por_genero', 4
      ),
      'special_rules', E'JERPA: m\u00e1x. 1 modalidade por atleta (Art.29). JER\u2019s coletivas: m\u00e1x. 1 equipe por atleta. JER\u2019s individuais: m\u00e1x. 2 modalidades, com at\u00e9 6 provas por modalidade. Quantitativos m\u00e1ximos por g\u00eanero/modalidade conforme Arts.25-28 do Regulamento Geral.'
    ),

    'classification', jsonb_build_array(
      jsonb_build_object('stage_name','Etapa Classificat\u00f3ria - Uiramut\u00e3','host_city','Uiramut\u00e3','slots_per_host',1,'advancement_criteria','Classificat\u00f3ria municipal','notes','17-21/04/2026'),
      jsonb_build_object('stage_name','Etapa Classificat\u00f3ria - Caracara\u00ed','host_city','Caracara\u00ed','slots_per_host',1,'advancement_criteria','Classificat\u00f3ria municipal','notes','17-21/04/2026'),
      jsonb_build_object('stage_name','Etapa Classificat\u00f3ria - Bonfim','host_city','Bonfim','slots_per_host',2,'advancement_criteria','Classificat\u00f3ria municipal; sem seletiva com at\u00e9 2 equipes (Art.74 \u00a73\u00ba)','notes','13-18/05/2026'),
      jsonb_build_object('stage_name','Etapa Classificat\u00f3ria - Pacaraima','host_city','Pacaraima','slots_per_host',1,'advancement_criteria','Classificat\u00f3ria municipal','notes','30/04 a 04/05/2026'),
      jsonb_build_object('stage_name','Etapa Classificat\u00f3ria - Normandia','host_city','Normandia','slots_per_host',1,'advancement_criteria','Classificat\u00f3ria municipal','notes','13-18/05/2026'),
      jsonb_build_object('stage_name','Etapa Classificat\u00f3ria - Mucaja\u00ed','host_city','Mucaja\u00ed','slots_per_host',2,'advancement_criteria','Classificat\u00f3ria municipal; sem seletiva com at\u00e9 2 equipes (Art.74 \u00a73\u00ba)','notes','30/04 a 04/05/2026'),
      jsonb_build_object('stage_name','Etapa Classificat\u00f3ria - Rorain\u00f3polis','host_city','Rorain\u00f3polis','slots_per_host',1,'advancement_criteria','Classificat\u00f3ria municipal','notes','24-28/04/2026'),
      jsonb_build_object('stage_name','Etapa Classificat\u00f3ria - S\u00e3o Jo\u00e3o do Baliza','host_city','S\u00e3o Jo\u00e3o do Baliza','slots_per_host',3,'advancement_criteria','Classificat\u00f3ria municipal; sem seletiva com at\u00e9 3 equipes (Art.74 \u00a73\u00ba)','notes','24-28/04/2026'),
      jsonb_build_object('stage_name','Etapa Classificat\u00f3ria - Alto Alegre','host_city','Alto Alegre','slots_per_host',2,'advancement_criteria','Classificat\u00f3ria municipal; sem seletiva com at\u00e9 2 equipes (Art.74 \u00a73\u00ba)','notes','07-11/05/2026'),
      jsonb_build_object('stage_name','Etapa Classificat\u00f3ria - Boa Vista (Capital + Rural)','host_city','Boa Vista','slots_per_host',10,'advancement_criteria','Classificat\u00f3ria capital','notes','01-07/06/2026'),
      jsonb_build_object('stage_name','Etapa Final Estadual JER\u2019s','host_city','Boa Vista','total_qualified',24,'advancement_criteria','At\u00e9 14 vagas do interior + at\u00e9 10 vagas da capital; sobras realocadas para Boa Vista (Art.76)','notes','Abertura prevista 05/07/2026'),
      jsonb_build_object('stage_name','Etapa Final JERPA - Atletismo/Nata\u00e7\u00e3o/Bocha','host_city','Boa Vista','advancement_criteria','Sem etapa classificat\u00f3ria; somente final (Art.57 \u00fanico)','notes','27/06 a 03/07/2026'),
      jsonb_build_object('stage_name','Etapa Final JERPA - Parabadminton/T\u00eanis de Mesa','host_city','Boa Vista','advancement_criteria','Sem etapa classificat\u00f3ria; somente final','notes','04 a 14/07/2026')
    ),

    'operational', jsonb_build_array(
      jsonb_build_object('key','protest_deadline_minutes','label','Prazo de protesto (min ap\u00f3s o jogo/prova)','value','60','category','protesto'),
      jsonb_build_object('key','category_change_deadline_hours','label','Mudan\u00e7a de prova/categoria antes da reuni\u00e3o t\u00e9cnica (h)','value','48','category','prazo'),
      jsonb_build_object('key','max_collective_substitutions','label','Substitui\u00e7\u00f5es por modalidade coletiva e g\u00eanero','value','3','category','geral'),
      jsonb_build_object('key','food_donation_kg_per_substitution','label','Doa\u00e7\u00e3o por substitui\u00e7\u00e3o fora do prazo (kg)','value','3','category','geral'),
      jsonb_build_object('key','food_donation_kg_per_late_doc','label','Doa\u00e7\u00e3o por regulariza\u00e7\u00e3o documental ap\u00f3s prazo (kg)','value','3','category','geral'),
      jsonb_build_object('key','min_age_lodging','label','Idade m\u00ednima permitida em alojamento oficial','value','12','category','ausencia'),
      jsonb_build_object('key','female_official_required','label','Oficial feminino obrigat\u00f3rio por delega\u00e7\u00e3o','value','true','category','geral'),
      jsonb_build_object('key','officials_up_to_20_athletes','label','Oficiais para delega\u00e7\u00f5es at\u00e9 20 atletas','value','2','category','geral'),
      jsonb_build_object('key','officials_21_to_60_athletes','label','Oficiais para delega\u00e7\u00f5es de 21 a 60 atletas','value','4','category','geral'),
      jsonb_build_object('key','officials_above_60_athletes','label','Oficiais para delega\u00e7\u00f5es acima de 60 atletas','value','6','category','geral'),
      jsonb_build_object('key','jerpa_staff_per_wheelchair','label','Staff JERPA por atleta cadeirante','value','1','category','geral'),
      jsonb_build_object('key','technician_cref_required','label','T\u00e9cnico externo exige CREF e autoriza\u00e7\u00e3o escolar','value','true','category','geral'),
      jsonb_build_object('key','medical_fitness_report_required','label','Laudo m\u00e9dico de aptid\u00e3o no credenciamento','value','true','category','geral'),
      jsonb_build_object('key','image_assignment_required','label','Termo de imagem/dados obrigat\u00f3rio','value','true','category','geral'),
      jsonb_build_object('key','weapons_prohibited','label','Proibido portar armas (inclusive seguran\u00e7a)','value','true','category','geral'),
      jsonb_build_object('key','student_enrollment_deadline','label','Matr\u00edcula escolar at\u00e9','value','2026-03-31','category','prazo'),
      jsonb_build_object('key','jers_registration_window','label','Janela de inscri\u00e7\u00e3o JER\u2019s','value','16/03/2026 a 03/04/2026','category','prazo'),
      jsonb_build_object('key','jerpa_registration_window','label','Janela de inscri\u00e7\u00e3o JERPA','value','01/04/2026 a 20/04/2026','category','prazo'),
      jsonb_build_object('key','jerpa_substitution_deadline','label','Prazo limite substitui\u00e7\u00e3o JERPA','value','17 e 18/06/2026','category','prazo'),
      jsonb_build_object('key','official_inscription_system','label','Sistema oficial de inscri\u00e7\u00e3o','value','https://sigecom.mms.inf.br/login','category','geral'),
      jsonb_build_object('key','specific_regulations_link','label','Regulamentos espec\u00edficos das modalidades','value','https://drive.google.com/drive/folders/1jvB2S8qA9DWCpAiOvW8kMuby5nTSqw0V','category','geral')
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
      'tiebreakers', jsonb_build_array('Maior n\u00famero de 1\u00ba lugares','Maior n\u00famero de 2\u00ba lugares','Maior n\u00famero de 3\u00ba lugares','Confronto direto','Crit\u00e9rios complementares definidos pela Ger\u00eancia T\u00e9cnica em Boletim Oficial'),
      'collective_rules', E'A pontua\u00e7\u00e3o das modalidades coletivas observa as Regras Oficiais das Confedera\u00e7\u00f5es Brasileiras correspondentes (Art.71). Detalhamento por fator multiplicador a ser publicado em Boletim Oficial.',
      'individual_rules', E'Pontua\u00e7\u00e3o por atleta classificado nas modalidades individuais; soma para a Institui\u00e7\u00e3o de Ensino segundo crit\u00e9rios da Ger\u00eancia T\u00e9cnica.',
      'conversion_notes', E'Modalidades fora do programa nacional (Futebol, Karat\u00ea, Xadrez 15-17; Tiro com Arco e \u00c1guas Abertas 12-14) pontuam apenas no estadual (Art.15).'
    )
  ),
  notes = E'Rascunho v1 atualizado com extra\u00e7\u00e3o do Regulamento Geral JER\u2019s + JERPA 2026 (publicado em 06/03/2026). Aguarda regulamentos espec\u00edficos por modalidade para detalhar provas, classes funcionais, tabelas de p\u00f3dio e crit\u00e9rios t\u00e9cnicos individuais.',
  updated_at = now()
WHERE event_id = 'de0cd62b-05b9-4147-9257-9543d61d5739'::uuid
  AND version = 1
  AND status = 'draft';