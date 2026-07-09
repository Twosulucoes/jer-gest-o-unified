-- ============================================================
-- 3ª rodada da auditoria de KPIs de alimentação — dois achados novos,
-- descobertos ao investigar a "dupla contagem" já documentada como
-- follow-up da PR #274:
--
-- 1) BUG CRÍTICO PRÉ-EXISTENTE (não introduzido por esta auditoria):
--    get_participant_counts_by_profile e
--    get_present_participant_counts_by_profile referenciam
--    `p.category_slug`, uma coluna que NUNCA existiu em `participants`
--    (a coluna real é `participant_type` — confirmado em
--    supabase/migrations/20260403000452_...sql e no types.ts gerado).
--    Toda chamada a essas duas RPCs lança erro no Postgres
--    ("column p.category_slug does not exist"); testado localmente
--    (Postgres 16 efêmero, schema mínimo) antes de escrever este fix.
--    Como AlimentacaoPrevisaoPage.tsx não checava `.error` do retorno do
--    RPC (só fazia `(data as any[]) || []`), a falha era engolida em
--    silêncio: `eligibilityTotals.total` e `enrolledTotal` ficavam
--    sempre 0, e qualquer janela SEM regra de elegibilidade própria
--    (a maioria) mostrava "Previsão: 0".
--
-- 2) Dupla contagem: calculateForecast (client) somava o `count` de cada
--    regra de elegibilidade isoladamente — um participante que se encaixa
--    em mais de uma regra da mesma janela (ex.: participant_type=atleta
--    E institution=X) era contado duas vezes. Introduz
--    get_present_participants_detail, que devolve os participantes
--    presentes um a um (não agregados), permitindo deduplicar por
--    participant_id no client antes de contar.
-- ============================================================

-- ── 1a. Fix get_participant_counts_by_profile (categoria → participant_type) ──
CREATE OR REPLACE FUNCTION public.get_participant_counts_by_profile(p_event_id UUID, p_stage_id UUID DEFAULT NULL)
RETURNS TABLE (type TEXT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.participant_type::text AS type,
        COUNT(*)::BIGINT AS count
    FROM public.participants p
    JOIN public.participant_event_stages pes ON p.id = pes.participant_id
    WHERE p.event_id = p_event_id
      AND p.is_active = true
      AND (p_stage_id IS NULL OR pes.event_stage_id = p_stage_id)
    GROUP BY p.participant_type;
END;
$$;

-- ── 1b. Fix get_present_participant_counts_by_profile (idem, + filtro de presença) ──
CREATE OR REPLACE FUNCTION public.get_present_participant_counts_by_profile(
  p_event_id UUID,
  p_service_date DATE,
  p_stage_id UUID DEFAULT NULL
)
RETURNS TABLE (type TEXT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.participant_type::text AS type,
    COUNT(*)::BIGINT AS count
  FROM public.participants p
  JOIN public.participant_event_stages pes ON p.id = pes.participant_id
  WHERE p.event_id = p_event_id
    AND p.is_active = true
    AND p.needs_meals = true
    AND p.credentialed_at IS NOT NULL
    AND p.credentialed_at::date <= p_service_date
    AND (p.left_event_at IS NULL OR p.left_event_at::date > p_service_date)
    AND (p_stage_id IS NULL OR pes.event_stage_id = p_stage_id)
  GROUP BY p.participant_type;
END;
$$;

-- ── 2. get_present_participants_detail — um registro por participante ────────
-- Mesmo filtro de presença das 3 RPCs get_present_participant_counts_by_*
-- (mesma tríade is_active/needs_meals/credentialed_at/left_event_at já
-- documentada nelas), mas devolve linhas individuais em vez de contagens
-- agregadas, para permitir deduplicar por participant_id ao avaliar
-- múltiplas regras de elegibilidade na mesma janela.
CREATE OR REPLACE FUNCTION public.get_present_participants_detail(
  p_event_id UUID,
  p_service_date DATE,
  p_stage_id UUID DEFAULT NULL
)
RETURNS TABLE (
  participant_id UUID,
  participant_type TEXT,
  delegation_id UUID,
  institution_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id AS participant_id,
    p.participant_type::text AS participant_type,
    p.delegation_id,
    d.institution_id
  FROM public.participants p
  JOIN public.participant_event_stages pes ON p.id = pes.participant_id
  LEFT JOIN public.delegations d ON d.id = p.delegation_id
  WHERE p.event_id = p_event_id
    AND p.is_active = true
    AND p.needs_meals = true
    AND p.credentialed_at IS NOT NULL
    AND p.credentialed_at::date <= p_service_date
    AND (p.left_event_at IS NULL OR p.left_event_at::date > p_service_date)
    AND (p_stage_id IS NULL OR pes.event_stage_id = p_stage_id);
END;
$$;
