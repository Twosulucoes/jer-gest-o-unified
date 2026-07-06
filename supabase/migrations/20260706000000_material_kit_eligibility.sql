-- ============================================================
-- ELEGIBILIDADE DE KIT DE MATERIAL POR PERFIL (participant_type)
-- ============================================================
-- Permite restringir quais grupos (atletas, dirigentes, técnicos, ...)
-- recebem cada kit. Sem regras => todos os credenciados ativos recebem
-- (mesma semântica de "restrict_eligibility off" da Alimentação).
--
-- Depende de: 20260705010001_protocolo_entrega_material.sql

-- ─── 1. Tabela de elegibilidade por perfil ────────────────────────────
CREATE TABLE IF NOT EXISTS public.material_kit_eligibility (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id           uuid NOT NULL REFERENCES public.material_kits(id) ON DELETE CASCADE,
  participant_type public.participant_type NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kit_id, participant_type)
);

CREATE INDEX IF NOT EXISTS idx_material_kit_eligibility_kit
  ON public.material_kit_eligibility (kit_id);

-- ─── 2. RPC record_material_delivery: agora valida o perfil ───────────
-- Regra: se o kit tem QUALQUER regra de elegibilidade, o tipo do
-- participante precisa estar entre elas. Sem regras => todos recebem.
CREATE OR REPLACE FUNCTION public.record_material_delivery(
  p_participant_id uuid,
  p_kit_id         uuid,
  p_method         text DEFAULT 'qr_scan',
  p_delivered_by   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kit         RECORD;
  v_delivery_id uuid;
  v_ptype       public.participant_type;
  v_has_rules   boolean;
BEGIN
  -- 1. Kit existe e está ativo?
  SELECT * INTO v_kit
  FROM material_kits
  WHERE id = p_kit_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'KIT_NOT_FOUND');
  END IF;

  -- 2. Elegibilidade por perfil.
  SELECT EXISTS (
    SELECT 1 FROM material_kit_eligibility WHERE kit_id = p_kit_id
  ) INTO v_has_rules;

  IF v_has_rules THEN
    SELECT participant_type INTO v_ptype
    FROM participants WHERE id = p_participant_id;

    IF NOT EXISTS (
      SELECT 1 FROM material_kit_eligibility
      WHERE kit_id = p_kit_id AND participant_type = v_ptype
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'NOT_ELIGIBLE');
    END IF;
  END IF;

  -- 3. INSERT idempotente — sintaxe para partial unique index.
  INSERT INTO material_deliveries (participant_id, kit_id, method, delivered_by, status)
  VALUES (p_participant_id, p_kit_id, p_method, p_delivered_by, 'active')
  ON CONFLICT (kit_id, participant_id) WHERE (status = 'active')
  DO NOTHING
  RETURNING id INTO v_delivery_id;

  IF v_delivery_id IS NULL THEN
    SELECT id INTO v_delivery_id
    FROM material_deliveries
    WHERE participant_id = p_participant_id
      AND kit_id = p_kit_id
      AND status = 'active';
    RETURN jsonb_build_object('ok', false, 'reason', 'ALREADY_DELIVERED', 'id', v_delivery_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_delivery_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_material_delivery FROM anon;
GRANT EXECUTE ON FUNCTION public.record_material_delivery TO authenticated;

-- ─── 3. Trigger de elegibilidade: valida o perfil (defesa em profundidade)
-- Mesma checagem também no INSERT direto, cobrindo qualquer caminho que
-- não passe pela RPC.
CREATE OR REPLACE FUNCTION public.check_material_delivery_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_active       boolean;
  v_credentialed_at timestamptz;
  v_ptype           public.participant_type;
BEGIN
  SELECT is_active, credentialed_at, participant_type
    INTO v_is_active, v_credentialed_at, v_ptype
    FROM public.participants
    WHERE id = NEW.participant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Participante não encontrado para entrega de material.';
  END IF;

  IF v_is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Participante inativo; entrega bloqueada.';
  END IF;

  IF v_credentialed_at IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Participante sem credencial ativa; entrega bloqueada.';
  END IF;

  IF EXISTS (
       SELECT 1 FROM public.material_kit_eligibility WHERE kit_id = NEW.kit_id
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.material_kit_eligibility
       WHERE kit_id = NEW.kit_id AND participant_type = v_ptype
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Perfil do participante não elegível para este kit.';
  END IF;

  RETURN NEW;
END;
$$;

-- O trigger ck_material_delivery_eligibility já aponta para esta função
-- (definido em 20260705010001); o CREATE OR REPLACE acima basta.

-- ─── 4. RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.material_kit_eligibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access material_kit_eligibility" ON public.material_kit_eligibility;
CREATE POLICY "Admin full access material_kit_eligibility" ON public.material_kit_eligibility FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Secretaria can manage material_kit_eligibility" ON public.material_kit_eligibility;
CREATE POLICY "Secretaria can manage material_kit_eligibility" ON public.material_kit_eligibility FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));

DROP POLICY IF EXISTS "Material can read material_kit_eligibility" ON public.material_kit_eligibility;
CREATE POLICY "Material can read material_kit_eligibility" ON public.material_kit_eligibility FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'material'));

DROP POLICY IF EXISTS "Coordenacao tecnica can read material_kit_eligibility" ON public.material_kit_eligibility;
CREATE POLICY "Coordenacao tecnica can read material_kit_eligibility" ON public.material_kit_eligibility FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'));
