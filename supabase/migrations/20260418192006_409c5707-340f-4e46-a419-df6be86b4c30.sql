-- Seed global de aliases (kind='sport') a partir da fonte de verdade JER 2026
-- Idempotente: usa ON CONFLICT no índice único (alias_norm, kind, COALESCE(event_id,'00000000-0000-0000-0000-000000000000'))
-- Estratégia: DELETE + INSERT para registros globais (event_id IS NULL) garante consistência total com a fonte.

BEGIN;

-- 1) Limpa aliases globais antigos do tipo 'sport' e 'category' para reaplicar a verdade
DELETE FROM public.import_aliases WHERE event_id IS NULL AND kind IN ('sport', 'category');

-- 2) Reinsere aliases canônicos vindos de FONTE_DE_VERDADE_JER2026
INSERT INTO public.import_aliases (alias_norm, canonical_slug, kind, event_id, notes)
VALUES
  -- COLETIVAS
  ('BASQUETE', 'basquete', 'sport', NULL, 'JER2026 truth'),
  ('BASQUETEBOL', 'basquete', 'sport', NULL, 'JER2026 truth'),
  ('BASKET', 'basquete', 'sport', NULL, 'JER2026 truth'),
  ('BASKETBALL', 'basquete', 'sport', NULL, 'JER2026 truth'),
  ('FUTSAL', 'futsal', 'sport', NULL, 'JER2026 truth'),
  ('FUTEBOL DE SALAO', 'futsal', 'sport', NULL, 'JER2026 truth'),
  ('FUTEBOL DE SALÃO', 'futsal', 'sport', NULL, 'JER2026 truth'),
  ('FUTEBOL', 'futebol', 'sport', NULL, 'JER2026 truth'),
  ('FUTEBOL DE CAMPO', 'futebol', 'sport', NULL, 'JER2026 truth'),
  ('FOOTBALL', 'futebol', 'sport', NULL, 'JER2026 truth'),
  ('SOCCER', 'futebol', 'sport', NULL, 'JER2026 truth'),
  ('HANDEBOL', 'handebol', 'sport', NULL, 'JER2026 truth'),
  ('HANDBALL', 'handebol', 'sport', NULL, 'JER2026 truth'),
  ('VOLEI', 'volei', 'sport', NULL, 'JER2026 truth'),
  ('VOLEIBOL', 'volei', 'sport', NULL, 'JER2026 truth'),
  ('VÔLEI', 'volei', 'sport', NULL, 'JER2026 truth'),
  ('VOLLEY', 'volei', 'sport', NULL, 'JER2026 truth'),
  ('VOLLEYBALL', 'volei', 'sport', NULL, 'JER2026 truth'),
  ('VOLEI DE PRAIA', 'volei-de-praia', 'sport', NULL, 'JER2026 truth'),
  ('VOLEIBOL DE PRAIA', 'volei-de-praia', 'sport', NULL, 'JER2026 truth'),
  ('VÔLEI DE PRAIA', 'volei-de-praia', 'sport', NULL, 'JER2026 truth'),
  ('BEACH VOLLEY', 'volei-de-praia', 'sport', NULL, 'JER2026 truth'),

  -- COMBATE
  ('JUDO', 'judo', 'sport', NULL, 'JER2026 truth'),
  ('JUDÔ', 'judo', 'sport', NULL, 'JER2026 truth'),
  ('KARATE', 'karate', 'sport', NULL, 'JER2026 truth'),
  ('KARATÊ', 'karate', 'sport', NULL, 'JER2026 truth'),
  ('TAEKWONDO', 'taekwondo', 'sport', NULL, 'JER2026 truth'),
  ('TAE KWON DO', 'taekwondo', 'sport', NULL, 'JER2026 truth'),
  ('TKD', 'taekwondo', 'sport', NULL, 'JER2026 truth'),
  ('WRESTLING', 'wrestling', 'sport', NULL, 'JER2026 truth'),
  ('LUTA OLIMPICA', 'wrestling', 'sport', NULL, 'JER2026 truth'),
  ('LUTA OLÍMPICA', 'wrestling', 'sport', NULL, 'JER2026 truth'),

  -- TÉCNICAS / RAQUETE / MESA
  ('BADMINTON', 'badminton', 'sport', NULL, 'JER2026 truth'),
  ('TENIS DE MESA', 'tenis-de-mesa', 'sport', NULL, 'JER2026 truth'),
  ('TÊNIS DE MESA', 'tenis-de-mesa', 'sport', NULL, 'JER2026 truth'),
  ('TM', 'tenis-de-mesa', 'sport', NULL, 'JER2026 truth'),
  ('TABLE TENNIS', 'tenis-de-mesa', 'sport', NULL, 'JER2026 truth'),
  ('PINGUE-PONGUE', 'tenis-de-mesa', 'sport', NULL, 'JER2026 truth'),
  ('TIRO COM ARCO', 'tiro-com-arco', 'sport', NULL, 'JER2026 truth'),
  ('TIRO ARCO', 'tiro-com-arco', 'sport', NULL, 'JER2026 truth'),
  ('ARCHERY', 'tiro-com-arco', 'sport', NULL, 'JER2026 truth'),
  ('XADREZ', 'xadrez', 'sport', NULL, 'JER2026 truth'),
  ('CHESS', 'xadrez', 'sport', NULL, 'JER2026 truth'),
  ('GINASTICA RITMICA', 'ginastica-ritmica', 'sport', NULL, 'JER2026 truth'),
  ('GINÁSTICA RÍTMICA', 'ginastica-ritmica', 'sport', NULL, 'JER2026 truth'),
  ('GR', 'ginastica-ritmica', 'sport', NULL, 'JER2026 truth'),

  -- TEMPO/MARCA
  ('ATLETISMO', 'atletismo', 'sport', NULL, 'JER2026 truth'),
  ('ATHLETICS', 'atletismo', 'sport', NULL, 'JER2026 truth'),
  ('NATACAO', 'natacao', 'sport', NULL, 'JER2026 truth'),
  ('NATAÇÃO', 'natacao', 'sport', NULL, 'JER2026 truth'),
  ('SWIMMING', 'natacao', 'sport', NULL, 'JER2026 truth'),
  ('CICLISMO', 'ciclismo', 'sport', NULL, 'JER2026 truth'),
  ('CYCLING', 'ciclismo', 'sport', NULL, 'JER2026 truth'),
  ('AGUAS ABERTAS', 'aguas-abertas', 'sport', NULL, 'JER2026 truth'),
  ('ÁGUAS ABERTAS', 'aguas-abertas', 'sport', NULL, 'JER2026 truth'),
  ('OPEN WATER', 'aguas-abertas', 'sport', NULL, 'JER2026 truth'),

  -- PARALÍMPICAS (JERPA)
  ('ATLETISMO PARALIMPICO', 'atletismo-paralimpico', 'sport', NULL, 'JER2026 truth'),
  ('ATLETISMO PARALÍMPICO', 'atletismo-paralimpico', 'sport', NULL, 'JER2026 truth'),
  ('NATACAO PARALIMPICA', 'natacao-paralimpica', 'sport', NULL, 'JER2026 truth'),
  ('NATAÇÃO PARALÍMPICA', 'natacao-paralimpica', 'sport', NULL, 'JER2026 truth'),
  ('TENIS DE MESA PARALIMPICO', 'tenis-de-mesa-paralimpico', 'sport', NULL, 'JER2026 truth'),
  ('TÊNIS DE MESA PARALÍMPICO', 'tenis-de-mesa-paralimpico', 'sport', NULL, 'JER2026 truth'),
  ('TM PARALIMPICO', 'tenis-de-mesa-paralimpico', 'sport', NULL, 'JER2026 truth'),
  ('PARABADMINTON', 'parabadminton', 'sport', NULL, 'JER2026 truth'),
  ('PARA BADMINTON', 'parabadminton', 'sport', NULL, 'JER2026 truth'),
  ('BOCHA PARALIMPICA', 'bocha-paralimpica', 'sport', NULL, 'JER2026 truth'),
  ('BOCHA PARALÍMPICA', 'bocha-paralimpica', 'sport', NULL, 'JER2026 truth'),
  ('BOCCIA', 'bocha-paralimpica', 'sport', NULL, 'JER2026 truth')
ON CONFLICT DO NOTHING;

COMMIT;