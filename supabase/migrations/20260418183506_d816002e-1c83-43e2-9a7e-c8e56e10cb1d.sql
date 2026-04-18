
-- ============================================================
-- import_aliases: dicionário editável de sinônimos do importador
-- Substitui o hardcode SPORT_ALIASES da edge function por dados
-- gerenciáveis via UI. Plugado pela /admin/importacao/aliases.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.import_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Tipo do alias: 'sport' | 'category' | 'participant_type' | 'status'
  kind text NOT NULL CHECK (kind IN ('sport','category','participant_type','status')),
  -- Texto bruto normalizado (sem acento, upper, espaços simples)
  alias_norm text NOT NULL,
  -- Slug/valor canônico (ex: 'judo', 'jers-12-14', 'athlete', 'deferida')
  canonical_slug text NOT NULL,
  -- Escopo opcional: quando preenchido, alias só vale para esse evento
  event_id uuid NULL REFERENCES public.events(id) ON DELETE CASCADE,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

-- Unicidade: um alias_norm não pode mapear para 2 canônicos no mesmo escopo
CREATE UNIQUE INDEX IF NOT EXISTS uq_import_aliases_global
  ON public.import_aliases (kind, alias_norm)
  WHERE event_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_import_aliases_per_event
  ON public.import_aliases (kind, alias_norm, event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_aliases_lookup
  ON public.import_aliases (kind, alias_norm);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_import_aliases_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_import_aliases_touch ON public.import_aliases;
CREATE TRIGGER trg_import_aliases_touch
BEFORE UPDATE ON public.import_aliases
FOR EACH ROW EXECUTE FUNCTION public.tg_import_aliases_touch();

-- RLS
ALTER TABLE public.import_aliases ENABLE ROW LEVEL SECURITY;

-- Leitura: admin, secretaria, coordenacao_tecnica
CREATE POLICY "import_aliases_select"
ON public.import_aliases FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'secretaria')
  OR public.has_role(auth.uid(), 'coordenacao_tecnica')
);

-- Escrita: admin e secretaria
CREATE POLICY "import_aliases_insert"
ON public.import_aliases FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'secretaria')
);

CREATE POLICY "import_aliases_update"
ON public.import_aliases FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'secretaria')
);

CREATE POLICY "import_aliases_delete"
ON public.import_aliases FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Função pública: resolve_import_alias
-- Usada pela edge function import-inscricoes para consultar
-- aliases dinamicamente em vez do hardcode.
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_import_alias(
  _kind text,
  _alias_norm text,
  _event_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT canonical_slug
  FROM public.import_aliases
  WHERE kind = _kind
    AND alias_norm = _alias_norm
    AND (event_id = _event_id OR event_id IS NULL)
  ORDER BY (event_id IS NOT NULL) DESC  -- prioriza alias específico do evento
  LIMIT 1;
$$;

-- ============================================================
-- SEED INICIAL: aliases do regulamento JER's 2026
-- Idempotente: ON CONFLICT DO NOTHING.
-- ============================================================

-- ── MODALIDADES (sport) ──────────────────────────────────────
INSERT INTO public.import_aliases (kind, alias_norm, canonical_slug) VALUES
  -- Combate
  ('sport', 'JUDO', 'judo'),
  ('sport', 'JUDO MASCULINO', 'judo'),
  ('sport', 'JUDO FEMININO', 'judo'),
  ('sport', 'KARATE', 'karate'),
  ('sport', 'KARATE DO', 'karate'),
  ('sport', 'KUMITE', 'karate'),
  ('sport', 'KATA', 'karate'),
  ('sport', 'TAEKWONDO', 'taekwondo'),
  ('sport', 'TAE KWON DO', 'taekwondo'),
  ('sport', 'TKD', 'taekwondo'),
  ('sport', 'POOMSAE', 'taekwondo'),
  ('sport', 'WRESTLING', 'wrestling'),
  ('sport', 'LUTA OLIMPICA', 'wrestling'),
  ('sport', 'LUTA', 'wrestling'),
  ('sport', 'LUTAS', 'wrestling'),
  -- Coletivos
  ('sport', 'FUTSAL', 'futsal'),
  ('sport', 'FUTEBOL DE SALAO', 'futsal'),
  ('sport', 'FUTSAL MASCULINO', 'futsal'),
  ('sport', 'FUTSAL FEMININO', 'futsal'),
  ('sport', 'FUTEBOL', 'futebol'),
  ('sport', 'FUTEBOL DE CAMPO', 'futebol'),
  ('sport', 'FUTEBOL CAMPO', 'futebol'),
  ('sport', 'FC', 'futebol'),
  ('sport', 'BASQUETE', 'basquete'),
  ('sport', 'BASQUETEBOL', 'basquete'),
  ('sport', 'BASQUETE 3X3', 'basquete'),
  ('sport', 'BSK', 'basquete'),
  ('sport', 'VOLEI', 'volei'),
  ('sport', 'VOLEIBOL', 'volei'),
  ('sport', 'VOLEY', 'volei'),
  ('sport', 'VOLEI DE PRAIA', 'volei-de-praia'),
  ('sport', 'VOLEIBOL DE PRAIA', 'volei-de-praia'),
  ('sport', 'VOLEI PRAIA', 'volei-de-praia'),
  ('sport', 'BEACH VOLLEY', 'volei-de-praia'),
  ('sport', 'HANDEBOL', 'handebol'),
  ('sport', 'HANDBALL', 'handebol'),
  ('sport', 'HB', 'handebol'),
  -- Raquete / mesa
  ('sport', 'TENIS DE MESA', 'tenis-de-mesa'),
  ('sport', 'TM', 'tenis-de-mesa'),
  ('sport', 'PING PONG', 'tenis-de-mesa'),
  ('sport', 'TENIS MESA', 'tenis-de-mesa'),
  ('sport', 'BADMINTON', 'badminton'),
  ('sport', 'BAD', 'badminton'),
  ('sport', 'XADREZ', 'xadrez'),
  ('sport', 'CHESS', 'xadrez'),
  -- Tempo/marca
  ('sport', 'ATLETISMO', 'atletismo'),
  ('sport', 'ATL', 'atletismo'),
  ('sport', 'ATLETISMO PISTA E CAMPO', 'atletismo'),
  ('sport', 'NATACAO', 'natacao'),
  ('sport', 'NAT', 'natacao'),
  ('sport', 'AGUAS ABERTAS', 'aguas-abertas'),
  ('sport', 'CICLISMO', 'ciclismo'),
  ('sport', 'MTB', 'ciclismo'),
  ('sport', 'MOUNTAIN BIKE', 'ciclismo'),
  ('sport', 'TIRO COM ARCO', 'tiro-com-arco'),
  ('sport', 'TIRO ARCO', 'tiro-com-arco'),
  ('sport', 'ARCO', 'tiro-com-arco'),
  -- Ginástica
  ('sport', 'GINASTICA RITMICA', 'ginastica-ritmica'),
  ('sport', 'GR', 'ginastica-ritmica'),
  ('sport', 'GINASTICA', 'ginastica-ritmica'),
  -- JERPA
  ('sport', 'ATLETISMO PARALIMPICO', 'atletismo-paralimpico'),
  ('sport', 'ATLETISMO PARA', 'atletismo-paralimpico'),
  ('sport', 'PARA ATLETISMO', 'atletismo-paralimpico'),
  ('sport', 'NATACAO PARALIMPICA', 'natacao-paralimpica'),
  ('sport', 'NATACAO PARA', 'natacao-paralimpica'),
  ('sport', 'PARA NATACAO', 'natacao-paralimpica'),
  ('sport', 'BOCHA PARALIMPICA', 'bocha-paralimpica'),
  ('sport', 'BOCHA', 'bocha-paralimpica'),
  ('sport', 'BOCCIA', 'bocha-paralimpica'),
  ('sport', 'TENIS DE MESA PARALIMPICO', 'tenis-de-mesa-paralimpico'),
  ('sport', 'TM PARA', 'tenis-de-mesa-paralimpico'),
  ('sport', 'PARABADMINTON', 'parabadminton'),
  ('sport', 'PARA BADMINTON', 'parabadminton'),
  ('sport', 'BADMINTON PARALIMPICO', 'parabadminton')
ON CONFLICT DO NOTHING;

-- ── CATEGORIAS (category) — faixas etárias do regulamento ────
INSERT INTO public.import_aliases (kind, alias_norm, canonical_slug) VALUES
  -- JER's
  ('category', '12-14', 'jers-12-14'),
  ('category', '12 A 14', 'jers-12-14'),
  ('category', '12 A 14 ANOS', 'jers-12-14'),
  ('category', 'MIRIM', 'jers-12-14'),
  ('category', 'INFANTIL 12-14', 'jers-12-14'),
  ('category', '15-17', 'jers-15-17'),
  ('category', '15 A 17', 'jers-15-17'),
  ('category', '15 A 17 ANOS', 'jers-15-17'),
  ('category', 'INFANTIL', 'jers-15-17'),
  ('category', 'JUVENIL', 'jers-15-17'),
  -- JERPA
  ('category', '11-14', 'jerpa-11-14'),
  ('category', '11 A 14', 'jerpa-11-14'),
  ('category', '11 A 14 ANOS', 'jerpa-11-14'),
  ('category', 'JERPA 11-14', 'jerpa-11-14'),
  ('category', 'JERPA 15-17', 'jerpa-15-17'),
  -- Ginástica Rítmica
  ('category', '12-13', 'gr-12-13'),
  ('category', '12 A 13 ANOS', 'gr-12-13'),
  ('category', '14-15', 'gr-14-15'),
  ('category', '14 A 15 ANOS', 'gr-14-15'),
  -- Natação / Judô / Wrestling (faixas próprias)
  ('category', '12-14 NAT', 'nat-judo-wrest-12-14'),
  ('category', '14-16', 'nat-judo-wrest-14-16'),
  ('category', '14 A 16', 'nat-judo-wrest-14-16'),
  ('category', '14 A 16 ANOS', 'nat-judo-wrest-14-16'),
  ('category', '17 ANOS', 'nat-judo-wrest-17'),
  ('category', '17', 'nat-judo-wrest-17'),
  -- Tênis de Mesa
  ('category', '14-15 TM', 'tm-14-15'),
  ('category', '16-17', 'tm-16-17'),
  ('category', '16 A 17', 'tm-16-17'),
  ('category', '16 A 17 ANOS', 'tm-16-17')
ON CONFLICT DO NOTHING;

-- ── TIPO DE PARTICIPANTE (participant_type) ──────────────────
INSERT INTO public.import_aliases (kind, alias_norm, canonical_slug) VALUES
  ('participant_type', 'ATLETA', 'athlete'),
  ('participant_type', 'ATHLETE', 'athlete'),
  ('participant_type', 'COMPETIDOR', 'athlete'),
  ('participant_type', 'TECNICO', 'coach'),
  ('participant_type', 'TREINADOR', 'coach'),
  ('participant_type', 'PROFESSOR', 'coach'),
  ('participant_type', 'COACH', 'coach'),
  ('participant_type', 'CHEFE DE DELEGACAO', 'head_of_delegation'),
  ('participant_type', 'CHEFE DELEGACAO', 'head_of_delegation'),
  ('participant_type', 'CHEFE', 'head_of_delegation'),
  ('participant_type', 'AUXILIAR', 'staff'),
  ('participant_type', 'AUXILIAR TECNICO', 'staff'),
  ('participant_type', 'DIRIGENTE', 'staff'),
  ('participant_type', 'MEDICO', 'staff'),
  ('participant_type', 'FISIOTERAPEUTA', 'staff'),
  ('participant_type', 'FISIO', 'staff'),
  ('participant_type', 'MASSAGISTA', 'staff'),
  ('participant_type', 'MONITOR', 'staff'),
  ('participant_type', 'STAFF', 'staff')
ON CONFLICT DO NOTHING;

-- ── STATUS de inscrição (status) ─────────────────────────────
INSERT INTO public.import_aliases (kind, alias_norm, canonical_slug) VALUES
  ('status', 'DEFERIDA', 'deferida'),
  ('status', 'DEFERIDO', 'deferida'),
  ('status', 'APROVADA', 'deferida'),
  ('status', 'APROVADO', 'deferida'),
  ('status', 'HOMOLOGADA', 'deferida'),
  ('status', 'HOMOLOGADO', 'deferida'),
  ('status', 'CONFIRMADA', 'deferida'),
  ('status', 'CONFIRMADO', 'deferida'),
  ('status', 'OK', 'deferida')
ON CONFLICT DO NOTHING;
