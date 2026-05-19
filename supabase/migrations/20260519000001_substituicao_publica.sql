-- RPCs públicas (acessíveis pelo anon key) para o portal público de substituições.
-- Usa SECURITY DEFINER para acesso controlado ao banco sem expor RLS.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Permitir anon uploads na pasta /temp/ do bucket substitution-docs
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'sub_docs_anon_temp_insert'
      AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "sub_docs_anon_temp_insert" ON storage.objects
      FOR INSERT TO anon
      WITH CHECK (
        bucket_id = 'substitution-docs'
        AND (storage.foldername(name))[1] = 'temp'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'sub_docs_anon_temp_select'
      AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "sub_docs_anon_temp_select" ON storage.objects
      FOR SELECT TO anon
      USING (
        bucket_id = 'substitution-docs'
        AND (storage.foldername(name))[1] = 'temp'
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Eventos ativos (para seleção no formulário público)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.substituicao_buscar_eventos()
RETURNS TABLE (event_id UUID, event_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.name
  FROM events e
  WHERE e.status IN ('active', 'ativo', 'em_andamento', 'published')
  ORDER BY e.name;
END;
$$;
GRANT EXECUTE ON FUNCTION public.substituicao_buscar_eventos() TO anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Etapas do evento (para seleção)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.substituicao_buscar_etapas(p_event_id UUID)
RETURNS TABLE (stage_id UUID, stage_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT es.id, es.name
  FROM event_stages es
  WHERE es.event_id = p_event_id
  ORDER BY es.name;
END;
$$;
GRANT EXECUTE ON FUNCTION public.substituicao_buscar_etapas(UUID) TO anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Buscar delegação pelos 4 últimos dígitos do telefone do chefe
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.substituicao_buscar_delegacao(
  p_phone_suffix TEXT,
  p_event_id     UUID
)
RETURNS TABLE (
  delegation_id    UUID,
  institution_name TEXT,
  city             TEXT,
  chief_name       TEXT
)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    i.name::TEXT,
    COALESCE(i.city, '')::TEXT,
    COALESCE(d.chief_name, '')::TEXT
  FROM delegations d
  JOIN institutions i ON i.id = d.institution_id
  WHERE d.event_id = p_event_id
    AND d.chief_phone IS NOT NULL
    AND RIGHT(REGEXP_REPLACE(d.chief_phone, '[^0-9]', '', 'g'), 4) = p_phone_suffix
  LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.substituicao_buscar_delegacao(TEXT, UUID) TO anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Provas disponíveis na etapa
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.substituicao_buscar_provas(
  p_event_id UUID,
  p_stage_id UUID
)
RETURNS TABLE (
  sport_event_id   UUID,
  sport_event_name TEXT,
  sport_name       TEXT,
  category_name    TEXT
)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    se.id,
    se.name::TEXT,
    COALESCE(sp.name, '')::TEXT,
    COALESCE(cat.name, '')::TEXT
  FROM sport_events se
  LEFT JOIN sports sp ON sp.id = se.sport_id
  LEFT JOIN categories cat ON cat.id = se.category_id
  WHERE se.event_id = p_event_id
    AND se.is_active = true
    AND EXISTS (
      SELECT 1 FROM participant_sport_events pse
      WHERE pse.sport_event_id = se.id
        AND pse.event_stage_id = p_stage_id
    )
  ORDER BY se.name;
END;
$$;
GRANT EXECUTE ON FUNCTION public.substituicao_buscar_provas(UUID, UUID) TO anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Atletas que podem SAIR (têm PSE ativa na prova/etapa/delegação)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.substituicao_buscar_atletas_saindo(
  p_delegation_id  UUID,
  p_sport_event_id UUID,
  p_stage_id       UUID
)
RETURNS TABLE (participant_id UUID, full_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    COALESCE(pe.full_name, p.id::TEXT)::TEXT
  FROM participant_sport_events pse
  JOIN participants p ON p.id = pse.participant_id
  LEFT JOIN people pe ON pe.id = p.person_id
  WHERE pse.sport_event_id = p_sport_event_id
    AND pse.event_stage_id = p_stage_id
    AND pse.status IN ('pending', 'confirmed')
    AND p.delegation_id = p_delegation_id
  ORDER BY pe.full_name;
END;
$$;
GRANT EXECUTE ON FUNCTION public.substituicao_buscar_atletas_saindo(UUID, UUID, UUID) TO anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Atletas que podem ENTRAR (da delegação, sem PSE ativa naquela prova/etapa)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.substituicao_buscar_atletas_entrando(
  p_delegation_id  UUID,
  p_sport_event_id UUID,
  p_stage_id       UUID,
  p_event_id       UUID
)
RETURNS TABLE (participant_id UUID, full_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  taken_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(pse.participant_id)
  INTO taken_ids
  FROM participant_sport_events pse
  WHERE pse.sport_event_id = p_sport_event_id
    AND pse.event_stage_id = p_stage_id
    AND pse.status IN ('pending', 'confirmed');

  RETURN QUERY
  SELECT
    p.id,
    COALESCE(pe.full_name, p.id::TEXT)::TEXT
  FROM participants p
  LEFT JOIN people pe ON pe.id = p.person_id
  WHERE p.event_id = p_event_id
    AND p.delegation_id = p_delegation_id
    AND p.is_active = true
    AND p.participant_type = 'athlete'
    AND (taken_ids IS NULL OR p.id <> ALL(taken_ids))
  ORDER BY pe.full_name;
END;
$$;
GRANT EXECUTE ON FUNCTION public.substituicao_buscar_atletas_entrando(UUID, UUID, UUID, UUID) TO anon;
