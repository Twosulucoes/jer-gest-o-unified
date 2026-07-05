-- ============================================================
-- PROTOCOLO DE ENTREGA DE MATERIAL (controlado por crachá)
-- ============================================================
-- Espelha o padrão de Alimentação (meal_types/meal_windows/meal_consumptions
-- + record_meal_consumption + trigger de elegibilidade), adaptado para a
-- entrega de um "kit" de material controlada pelo crachá de credenciamento.
--
-- Fluxo: operador escaneia o crachá -> resolve participant_id ->
-- record_material_delivery() grava a entrega de forma idempotente
-- (entrega única ativa por kit+participante). Estorno via revoke_material_delivery().
--
-- Depende de: 20260705010000_add_material_role.sql (role 'material').

-- ─── 1. material_kits (definição do kit por evento/etapa) ─────────────
CREATE TABLE IF NOT EXISTS public.material_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_stage_id uuid REFERENCES public.event_stages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_material_kits_event_stage
  ON public.material_kits (event_id, event_stage_id) WHERE is_active;

DROP TRIGGER IF EXISTS update_material_kits_updated_at ON public.material_kits;
CREATE TRIGGER update_material_kits_updated_at
  BEFORE UPDATE ON public.material_kits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 2. material_deliveries (registro de entrega) ─────────────────────
CREATE TABLE IF NOT EXISTS public.material_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.material_kits(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  delivered_by uuid NOT NULL REFERENCES auth.users(id),
  method text NOT NULL DEFAULT 'qr_scan',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  revoked_by uuid REFERENCES auth.users(id),
  revoked_at timestamptz,
  revoke_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Entrega única ATIVA por kit+participante; reentrega só após estorno.
CREATE UNIQUE INDEX IF NOT EXISTS uq_material_deliveries_active
  ON public.material_deliveries (kit_id, participant_id)
  WHERE (status = 'active');

CREATE INDEX IF NOT EXISTS idx_material_deliveries_kit
  ON public.material_deliveries (kit_id);
CREATE INDEX IF NOT EXISTS idx_material_deliveries_participant
  ON public.material_deliveries (participant_id);

-- ─── 3. Trigger de elegibilidade ──────────────────────────────────────
-- Espelha check_meal_consumption_eligibility (sem a checagem needs_meals,
-- que não se aplica a material).
CREATE OR REPLACE FUNCTION public.check_material_delivery_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_active       boolean;
  v_credentialed_at timestamptz;
BEGIN
  SELECT is_active, credentialed_at
    INTO v_is_active, v_credentialed_at
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ck_material_delivery_eligibility ON public.material_deliveries;
CREATE TRIGGER ck_material_delivery_eligibility
  BEFORE INSERT ON public.material_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.check_material_delivery_eligibility();

-- ─── 4. RPC record_material_delivery ──────────────────────────────────
-- INSERT idempotente. Espelha record_meal_consumption.
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
BEGIN
  -- 1. Kit existe e está ativo?
  SELECT * INTO v_kit
  FROM material_kits
  WHERE id = p_kit_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'KIT_NOT_FOUND');
  END IF;

  -- 2. INSERT idempotente — sintaxe para partial unique index.
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

-- ─── 5. RPC revoke_material_delivery (estorno) ────────────────────────
-- Marca a entrega como revogada, liberando reentrega (o UNIQUE parcial
-- só cobre status='active').
CREATE OR REPLACE FUNCTION public.revoke_material_delivery(
  p_delivery_id uuid,
  p_reason      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated uuid;
BEGIN
  UPDATE material_deliveries
     SET status = 'revoked',
         revoked_by = auth.uid(),
         revoked_at = now(),
         revoke_reason = p_reason
   WHERE id = p_delivery_id
     AND status = 'active'
  RETURNING id INTO v_updated;

  IF v_updated IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NOT_FOUND_OR_ALREADY_REVOKED');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_material_delivery FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_material_delivery TO authenticated;

-- ─── 6. RLS ───────────────────────────────────────────────────────────
-- material_kits
ALTER TABLE public.material_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access material_kits" ON public.material_kits FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage material_kits" ON public.material_kits FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Material can read material_kits" ON public.material_kits FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'material'));
CREATE POLICY "Coordenacao tecnica can read material_kits" ON public.material_kits FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'));

-- material_deliveries
ALTER TABLE public.material_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access material_deliveries" ON public.material_deliveries FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage material_deliveries" ON public.material_deliveries FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Material can read material_deliveries" ON public.material_deliveries FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'material'));
CREATE POLICY "Material can insert material_deliveries" ON public.material_deliveries FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'material') AND delivered_by = auth.uid());
CREATE POLICY "Coordenacao tecnica can read material_deliveries" ON public.material_deliveries FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'));
