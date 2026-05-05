-- Fase G1 da Normalização (docs/dominio-canonico.md §7, §8)
-- Substituições — feature regulamentar do JER. Permite trocar atletas
-- em uma prova/time durante o evento, com auditoria imutável e
-- versionamento da inscrição esportiva.
--
-- Princípios (canônico §7):
--   1. Auditoria imutável: cada substituição vira uma linha em
--      `substitutions` com solicitante, aprovador e instantes.
--   2. A inscrição esportiva é versionada, não deletada:
--      participant_sport_events ganha colunas para apontar para a
--      substituição que cancelou ou criou cada linha.
--   3. Lineup respeita o momento — match_lineups passados ficam com
--      a pessoa antiga; novos lineups apontam para a pessoa nova.
--   4. Operação (consumos) não é versionada — refeições/hospedagem/
--      transporte de quem saiu permanecem registradas.
--   5. Substituição é stage-scoped: faz sentido em uma etapa, não no
--      evento como um todo.
--
-- Esta migration entrega só o **schema + RPC atômica**. UI Admin (G2)
-- e visão da delegação (G3) virão em PRs subsequentes.

-- ============================================================
-- 1. Enum: substitution_status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'substitution_status') THEN
    CREATE TYPE public.substitution_status AS ENUM (
      'requested',
      'approved',
      'rejected',
      'executed',
      'cancelled'
    );
  END IF;
END $$;

-- ============================================================
-- 2. Tabela substitutions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.substitutions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_stage_id  UUID NOT NULL REFERENCES public.event_stages(id) ON DELETE RESTRICT,
  delegation_id   UUID NOT NULL REFERENCES public.delegations(id) ON DELETE RESTRICT,
  sport_event_id  UUID NOT NULL REFERENCES public.sport_events(id) ON DELETE RESTRICT,

  -- Atletas envolvidos
  participant_out_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE RESTRICT,
  participant_in_id  UUID NOT NULL REFERENCES public.participants(id) ON DELETE RESTRICT,

  -- Conteúdo da substituição
  reason          TEXT,                  -- motivo regulamentar (texto livre + categoria opcional)
  reason_code     TEXT,                  -- ex.: 'lesao' | 'desistencia' | 'disciplinar' | 'convocacao' | 'outro'
  notes           TEXT,

  -- Ciclo
  status          public.substitution_status NOT NULL DEFAULT 'requested',
  requested_by    UUID NOT NULL REFERENCES auth.users(id),
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by     UUID REFERENCES auth.users(id),
  approved_at     TIMESTAMPTZ,
  rejected_by     UUID REFERENCES auth.users(id),
  rejected_at     TIMESTAMPTZ,
  rejection_notes TEXT,
  executed_by     UUID REFERENCES auth.users(id),
  executed_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Atletas distintos
  CONSTRAINT substitutions_distinct_participants CHECK (participant_out_id <> participant_in_id)
);

CREATE INDEX IF NOT EXISTS idx_substitutions_event_stage ON public.substitutions (event_stage_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_delegation ON public.substitutions (delegation_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_sport_event ON public.substitutions (sport_event_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_status ON public.substitutions (status);
CREATE INDEX IF NOT EXISTS idx_substitutions_participant_out ON public.substitutions (participant_out_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_participant_in ON public.substitutions (participant_in_id);

CREATE TRIGGER set_substitutions_updated_at
  BEFORE UPDATE ON public.substitutions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.substitutions IS
  'Substituições regulamentares de atletas em provas. Auditoria imutável: '
  'fluxo requested → approved → executed (ou rejected/cancelled). '
  'Stage-scoped por definição (canônico §7).';

-- ============================================================
-- 3. participant_sport_events: versionamento por substituição
-- ============================================================

-- Drop CHECK antiga e amplia com novo status `cancelled_by_substitution`.
ALTER TABLE public.participant_sport_events
  DROP CONSTRAINT IF EXISTS participant_sport_events_status_check;

ALTER TABLE public.participant_sport_events
  ADD CONSTRAINT participant_sport_events_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rejected', 'cancelled_by_substitution'));

ALTER TABLE public.participant_sport_events
  ADD COLUMN IF NOT EXISTS cancelled_by_substitution_id UUID REFERENCES public.substitutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_substitution_id   UUID REFERENCES public.substitutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pse_cancelled_by_subst ON public.participant_sport_events (cancelled_by_substitution_id) WHERE cancelled_by_substitution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pse_created_by_subst ON public.participant_sport_events (created_by_substitution_id) WHERE created_by_substitution_id IS NOT NULL;

COMMENT ON COLUMN public.participant_sport_events.cancelled_by_substitution_id IS
  'Quando preenchido, esta inscrição esportiva foi encerrada pela substituição '
  'apontada (status = cancelled_by_substitution).';
COMMENT ON COLUMN public.participant_sport_events.created_by_substitution_id IS
  'Quando preenchido, esta inscrição esportiva foi criada como entrada de '
  'uma substituição (atleta que entrou no lugar de outro).';

-- ============================================================
-- 4. RPC: execute_substitution — atômica, idempotente
-- ============================================================
CREATE OR REPLACE FUNCTION public.execute_substitution(p_substitution_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_subst         public.substitutions%ROWTYPE;
  v_old_pse_id    UUID;
  v_new_pse_id    UUID;
  v_actor         UUID := auth.uid();
BEGIN
  -- Lock pessimista para evitar race em duplas execuções.
  SELECT * INTO v_subst FROM public.substitutions WHERE id = p_substitution_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Substituição % não encontrada.', p_substitution_id USING ERRCODE = '22023';
  END IF;

  IF v_subst.status = 'executed' THEN
    -- Idempotência: se já executada, retorna o estado atual sem erro.
    RETURN jsonb_build_object(
      'ok', true, 'already_executed', true,
      'substitution_id', v_subst.id,
      'executed_at', v_subst.executed_at
    );
  END IF;

  IF v_subst.status <> 'approved' THEN
    RAISE EXCEPTION 'Substituição % não está aprovada (status atual: %).', v_subst.id, v_subst.status
      USING ERRCODE = '22023';
  END IF;

  -- 1) Localiza a inscrição esportiva ativa do participante que sai
  --    para (sport_event, event_stage) específicos.
  SELECT id INTO v_old_pse_id
  FROM public.participant_sport_events
  WHERE participant_id  = v_subst.participant_out_id
    AND sport_event_id  = v_subst.sport_event_id
    AND event_stage_id  = v_subst.event_stage_id
    AND status IN ('pending', 'confirmed');

  IF v_old_pse_id IS NULL THEN
    RAISE EXCEPTION 'Atleta de saída não tem inscrição esportiva ativa em (prova %, etapa %).',
      v_subst.sport_event_id, v_subst.event_stage_id
      USING ERRCODE = '22023';
  END IF;

  -- 2) Cancela a inscrição do atleta que sai.
  UPDATE public.participant_sport_events
  SET status = 'cancelled_by_substitution',
      cancelled_by_substitution_id = v_subst.id,
      updated_at = now()
  WHERE id = v_old_pse_id;

  -- 3) Cria nova inscrição para o atleta que entra.
  INSERT INTO public.participant_sport_events (
    participant_id,
    sport_event_id,
    event_stage_id,
    status,
    notes,
    created_by_substitution_id
  ) VALUES (
    v_subst.participant_in_id,
    v_subst.sport_event_id,
    v_subst.event_stage_id,
    'confirmed',
    format('Substituição %s — entra no lugar de %s', v_subst.id, v_subst.participant_out_id),
    v_subst.id
  )
  ON CONFLICT (participant_id, sport_event_id, event_stage_id) DO UPDATE
    SET status = 'confirmed',
        created_by_substitution_id = v_subst.id,
        updated_at = now()
  RETURNING id INTO v_new_pse_id;

  -- 4) Marca substituição como executada.
  UPDATE public.substitutions
  SET status = 'executed',
      executed_at = now(),
      executed_by = v_actor,
      updated_at = now()
  WHERE id = v_subst.id;

  RETURN jsonb_build_object(
    'ok', true,
    'substitution_id', v_subst.id,
    'old_pse_id', v_old_pse_id,
    'new_pse_id', v_new_pse_id,
    'executed_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_substitution(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_substitution(UUID) TO authenticated;

-- ============================================================
-- 5. RLS para substitutions
-- ============================================================
ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;

-- Admin/secretaria/coordenacao_tecnica: full access
CREATE POLICY "substitutions admin full access"
  ON public.substitutions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "substitutions secretaria full access"
  ON public.substitutions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));

CREATE POLICY "substitutions coord_tecnica full access"
  ON public.substitutions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));

-- Delegação: leitura escopada à própria delegação
CREATE POLICY "substitutions delegacao read own"
  ON public.substitutions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'delegacao'::public.app_role)
    AND delegation_id = public.get_user_delegation_id(auth.uid())
  );

-- Delegação: pode SOLICITAR substituições da própria delegação
CREATE POLICY "substitutions delegacao request own"
  ON public.substitutions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'delegacao'::public.app_role)
    AND delegation_id = public.get_user_delegation_id(auth.uid())
    AND status = 'requested'
    AND requested_by = auth.uid()
  );
