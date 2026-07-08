-- ============================================================
-- ENTREGA DE MATERIAL — crachá não reconhecido (fila de reconciliação)
-- ============================================================
-- Espelha o padrão de meal_consumptions_unlinked (Alimentação): quando o
-- crachá bipado não resolve para um participante (código não vinculado),
-- a entrega NÃO fica bloqueada — grava-se o código bruto lido para
-- reconciliação posterior (import de credencial externa), assim a fila de
-- entrega nunca para por causa de um vínculo faltante.
--
-- Depende de: 20260705010001_protocolo_entrega_material.sql (material_kits,
-- record_material_delivery, roles).

-- ─── 1. material_deliveries_unlinked ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.material_deliveries_unlinked (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code      text NOT NULL,
  kit_id       uuid NOT NULL REFERENCES public.material_kits(id) ON DELETE CASCADE,
  method       text NOT NULL DEFAULT 'qr_scan',
  delivered_by uuid REFERENCES auth.users(id),
  delivered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (qr_code, kit_id)
);

CREATE INDEX IF NOT EXISTS idx_material_deliveries_unlinked_kit
  ON public.material_deliveries_unlinked (kit_id);

-- ─── 2. RPC record_material_delivery_unlinked ──────────────────────────
-- INSERT idempotente por (qr_code, kit_id). Sem checagem de elegibilidade/
-- participante — é justamente o caso em que ainda não sabemos quem é.
CREATE OR REPLACE FUNCTION public.record_material_delivery_unlinked(
  p_qr_code      text,
  p_kit_id       uuid,
  p_method       text DEFAULT 'qr_scan',
  p_delivered_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kit RECORD;
  v_id  uuid;
BEGIN
  SELECT * INTO v_kit
  FROM material_kits
  WHERE id = p_kit_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'KIT_NOT_FOUND');
  END IF;

  INSERT INTO material_deliveries_unlinked (qr_code, kit_id, method, delivered_by)
  VALUES (p_qr_code, p_kit_id, p_method, p_delivered_by)
  ON CONFLICT (qr_code, kit_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ALREADY_DELIVERED');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_material_delivery_unlinked FROM anon;
GRANT EXECUTE ON FUNCTION public.record_material_delivery_unlinked TO authenticated;

-- ─── 3. RLS ─────────────────────────────────────────────────────────────
-- Insert só acontece via RPC SECURITY DEFINER acima (não há policy de
-- INSERT para o client) — evita gravação direta fora do fluxo de scan.
ALTER TABLE public.material_deliveries_unlinked ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access material_deliveries_unlinked" ON public.material_deliveries_unlinked FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaria can manage material_deliveries_unlinked" ON public.material_deliveries_unlinked FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'secretaria')) WITH CHECK (has_role(auth.uid(), 'secretaria'));
CREATE POLICY "Material can read material_deliveries_unlinked" ON public.material_deliveries_unlinked FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'material'));
CREATE POLICY "Coordenacao tecnica can read material_deliveries_unlinked" ON public.material_deliveries_unlinked FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenacao_tecnica'));
