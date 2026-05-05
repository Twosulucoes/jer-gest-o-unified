-- ============================================================
-- Alojamento — fundações v2
-- ============================================================
-- Premissas (módulo simples por etapa, escola → quartos):
--   1. Etapa Classificatória usa universo de inscritos.
--      Etapa Final usa universo de classificados (filtro consumido pelo front).
--   2. Estrutura física: Alojamento (lodging_locations) → Ala opcional →
--      Quarto (lodging_units), com sexo e capacidade.
--   3. Colchões: 1 por pessoa. Saldo automático no check-in/out.
--      Perdas/danos via lodging_incidents com category='colchao_perda'.
--   4. Trocas controladas: workflow request → approve → execute,
--      com motivo e auditoria.
--   5. Delegação só vê a própria escola (RLS aditiva).
--
-- Tudo aditivo: nada quebra o que já existe (RPC alocação em lote,
-- pwa_lodging_checkin, triggers de left_event, etc.).
-- ============================================================

-- ============================================================
-- A. Tabela lodging_wings (alas)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lodging_wings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES public.lodging_locations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  gender_default  text CHECK (gender_default IN ('male','female','mixed')),
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, name)
);

CREATE INDEX IF NOT EXISTS lodging_wings_location_idx ON public.lodging_wings(location_id);

DROP TRIGGER IF EXISTS update_lodging_wings_updated_at ON public.lodging_wings;
CREATE TRIGGER update_lodging_wings_updated_at
  BEFORE UPDATE ON public.lodging_wings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.lodging_wings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lodging_wings admin full access" ON public.lodging_wings;
CREATE POLICY "lodging_wings admin full access" ON public.lodging_wings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "lodging_wings secretaria full access" ON public.lodging_wings;
CREATE POLICY "lodging_wings secretaria full access" ON public.lodging_wings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));

DROP POLICY IF EXISTS "lodging_wings alojamento manage" ON public.lodging_wings;
CREATE POLICY "lodging_wings alojamento manage" ON public.lodging_wings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'alojamento'::public.app_role));

DROP POLICY IF EXISTS "lodging_wings coord_tecnica read" ON public.lodging_wings;
CREATE POLICY "lodging_wings coord_tecnica read" ON public.lodging_wings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));

-- ============================================================
-- B. lodging_units ganha wing_id (opcional)
-- ============================================================

ALTER TABLE public.lodging_units
  ADD COLUMN IF NOT EXISTS wing_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lodging_units_wing_id_fkey') THEN
    ALTER TABLE public.lodging_units
      ADD CONSTRAINT lodging_units_wing_id_fkey
      FOREIGN KEY (wing_id) REFERENCES public.lodging_wings(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS lodging_units_wing_idx ON public.lodging_units(wing_id) WHERE wing_id IS NOT NULL;

COMMENT ON COLUMN public.lodging_units.wing_id IS
  'Ala (opcional). Quando preenchido, a ala dita o gender_default; caso contrário usa gender_restriction da própria unidade.';

-- ============================================================
-- C. Estoque e movimentação de colchões
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lodging_mattress_inventory (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   uuid NOT NULL REFERENCES public.lodging_locations(id) ON DELETE CASCADE,
  initial_qty   int NOT NULL DEFAULT 0 CHECK (initial_qty >= 0),
  current_qty   int NOT NULL DEFAULT 0 CHECK (current_qty >= 0),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id)
);

DROP TRIGGER IF EXISTS update_lodging_mattress_inventory_updated_at ON public.lodging_mattress_inventory;
CREATE TRIGGER update_lodging_mattress_inventory_updated_at
  BEFORE UPDATE ON public.lodging_mattress_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.lodging_mattress_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mattress_inv admin full access" ON public.lodging_mattress_inventory;
CREATE POLICY "mattress_inv admin full access" ON public.lodging_mattress_inventory FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "mattress_inv secretaria full access" ON public.lodging_mattress_inventory;
CREATE POLICY "mattress_inv secretaria full access" ON public.lodging_mattress_inventory FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));

DROP POLICY IF EXISTS "mattress_inv alojamento manage" ON public.lodging_mattress_inventory;
CREATE POLICY "mattress_inv alojamento manage" ON public.lodging_mattress_inventory FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'alojamento'::public.app_role));

DROP POLICY IF EXISTS "mattress_inv coord_tecnica read" ON public.lodging_mattress_inventory;
CREATE POLICY "mattress_inv coord_tecnica read" ON public.lodging_mattress_inventory FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));

-- Movements: trilha imutável de cada uso de colchão.
CREATE TABLE IF NOT EXISTS public.lodging_mattress_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES public.lodging_locations(id) ON DELETE CASCADE,
  occupancy_id    uuid REFERENCES public.lodging_occupancies(id) ON DELETE SET NULL,
  incident_id     uuid REFERENCES public.lodging_incidents(id) ON DELETE SET NULL,
  kind            text NOT NULL CHECK (kind IN ('consume','return','lost','restock','adjust')),
  qty             int NOT NULL CHECK (qty <> 0),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS mattress_mov_location_idx ON public.lodging_mattress_movements(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mattress_mov_occupancy_idx ON public.lodging_mattress_movements(occupancy_id) WHERE occupancy_id IS NOT NULL;

ALTER TABLE public.lodging_mattress_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mattress_mov admin full access" ON public.lodging_mattress_movements;
CREATE POLICY "mattress_mov admin full access" ON public.lodging_mattress_movements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "mattress_mov secretaria full access" ON public.lodging_mattress_movements;
CREATE POLICY "mattress_mov secretaria full access" ON public.lodging_mattress_movements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));

DROP POLICY IF EXISTS "mattress_mov alojamento manage" ON public.lodging_mattress_movements;
CREATE POLICY "mattress_mov alojamento manage" ON public.lodging_mattress_movements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'alojamento'::public.app_role));

DROP POLICY IF EXISTS "mattress_mov coord_tecnica read" ON public.lodging_mattress_movements;
CREATE POLICY "mattress_mov coord_tecnica read" ON public.lodging_mattress_movements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::public.app_role));

-- ============================================================
-- D. Trigger: movimenta saldo de colchões automaticamente
--    em check-in (consume) e check-out (return).
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_lodging_mattress_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_location_id uuid;
  v_actor uuid := auth.uid();
BEGIN
  -- Resolve location_id: usa o checked_in_unit ou unit (fallback).
  SELECT u.location_id INTO v_location_id
  FROM public.lodging_units u
  WHERE u.id = COALESCE(NEW.checked_in_unit_id, NEW.unit_id);

  IF v_location_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Garante linha de inventário (zero) se ainda não existe — evita
  -- erro na primeira movimentação. Não cria estoque positivo automaticamente.
  INSERT INTO public.lodging_mattress_inventory (location_id, initial_qty, current_qty)
  VALUES (v_location_id, 0, 0)
  ON CONFLICT (location_id) DO NOTHING;

  -- Check-in: consome 1 colchão.
  IF (TG_OP = 'INSERT' AND NEW.status = 'checked_in')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'checked_in' AND OLD.status IS DISTINCT FROM 'checked_in')
  THEN
    UPDATE public.lodging_mattress_inventory
       SET current_qty = GREATEST(current_qty - 1, 0),
           updated_at = now()
     WHERE location_id = v_location_id;

    INSERT INTO public.lodging_mattress_movements (location_id, occupancy_id, kind, qty, created_by, notes)
    VALUES (v_location_id, NEW.id, 'consume', -1, v_actor, 'Consumo automático — check-in');
  END IF;

  -- Check-out: devolve 1 colchão.
  IF TG_OP = 'UPDATE' AND NEW.status = 'checked_out' AND OLD.status = 'checked_in' THEN
    UPDATE public.lodging_mattress_inventory
       SET current_qty = current_qty + 1,
           updated_at = now()
     WHERE location_id = v_location_id;

    INSERT INTO public.lodging_mattress_movements (location_id, occupancy_id, kind, qty, created_by, notes)
    VALUES (v_location_id, NEW.id, 'return', 1, v_actor, 'Devolução automática — check-out');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lodging_mattress_movement ON public.lodging_occupancies;
CREATE TRIGGER trg_lodging_mattress_movement
  AFTER INSERT OR UPDATE OF status ON public.lodging_occupancies
  FOR EACH ROW EXECUTE FUNCTION public.handle_lodging_mattress_movement();

-- ============================================================
-- E. Trocas controladas (request → approve → execute)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lodging_unit_swaps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occupancy_id    uuid NOT NULL REFERENCES public.lodging_occupancies(id) ON DELETE CASCADE,
  from_unit_id    uuid NOT NULL REFERENCES public.lodging_units(id) ON DELETE RESTRICT,
  to_unit_id      uuid NOT NULL REFERENCES public.lodging_units(id) ON DELETE RESTRICT,
  reason          text,
  status          text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','executed','cancelled')),
  requested_by    uuid NOT NULL REFERENCES auth.users(id),
  requested_at    timestamptz NOT NULL DEFAULT now(),
  approved_by     uuid REFERENCES auth.users(id),
  approved_at     timestamptz,
  rejected_by     uuid REFERENCES auth.users(id),
  rejected_at     timestamptz,
  executed_by     uuid REFERENCES auth.users(id),
  executed_at     timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lodging_unit_swaps_distinct_units CHECK (from_unit_id <> to_unit_id)
);

CREATE INDEX IF NOT EXISTS lodging_unit_swaps_occupancy_idx ON public.lodging_unit_swaps(occupancy_id);
CREATE INDEX IF NOT EXISTS lodging_unit_swaps_status_idx ON public.lodging_unit_swaps(status);

DROP TRIGGER IF EXISTS update_lodging_unit_swaps_updated_at ON public.lodging_unit_swaps;
CREATE TRIGGER update_lodging_unit_swaps_updated_at
  BEFORE UPDATE ON public.lodging_unit_swaps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.lodging_unit_swaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "swaps admin full access" ON public.lodging_unit_swaps;
CREATE POLICY "swaps admin full access" ON public.lodging_unit_swaps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "swaps secretaria full access" ON public.lodging_unit_swaps;
CREATE POLICY "swaps secretaria full access" ON public.lodging_unit_swaps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));

DROP POLICY IF EXISTS "swaps alojamento manage" ON public.lodging_unit_swaps;
CREATE POLICY "swaps alojamento manage" ON public.lodging_unit_swaps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'alojamento'::public.app_role));

-- RPC atômica: solicita troca.
CREATE OR REPLACE FUNCTION public.rpc_request_lodging_swap(
  p_occupancy_id uuid, p_to_unit_id uuid, p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_from_unit_id uuid;
  v_actor uuid := auth.uid();
  v_swap_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = '28000';
  END IF;

  IF NOT (
    public.has_role(v_actor, 'admin'::public.app_role)
    OR public.has_role(v_actor, 'secretaria'::public.app_role)
    OR public.has_role(v_actor, 'alojamento'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para solicitar troca.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(checked_in_unit_id, unit_id) INTO v_from_unit_id
  FROM public.lodging_occupancies WHERE id = p_occupancy_id FOR SHARE;

  IF v_from_unit_id IS NULL THEN
    RAISE EXCEPTION 'Ocupação % não encontrada.', p_occupancy_id USING ERRCODE = '22023';
  END IF;
  IF v_from_unit_id = p_to_unit_id THEN
    RAISE EXCEPTION 'Quarto de destino é igual ao de origem.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.lodging_unit_swaps (occupancy_id, from_unit_id, to_unit_id, reason, requested_by)
  VALUES (p_occupancy_id, v_from_unit_id, p_to_unit_id, p_reason, v_actor)
  RETURNING id INTO v_swap_id;

  RETURN jsonb_build_object('ok', true, 'swap_id', v_swap_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_request_lodging_swap(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_request_lodging_swap(uuid, uuid, text) TO authenticated;

-- RPC atômica: aprova + executa (move occupancy para o novo quarto).
CREATE OR REPLACE FUNCTION public.rpc_approve_lodging_swap(p_swap_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_swap public.lodging_unit_swaps%ROWTYPE;
  v_actor uuid := auth.uid();
  v_to_unit RECORD;
  v_part_gender text;
  v_current_count int;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = '28000';
  END IF;
  IF NOT (
    public.has_role(v_actor, 'admin'::public.app_role)
    OR public.has_role(v_actor, 'secretaria'::public.app_role)
    OR public.has_role(v_actor, 'alojamento'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar troca.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_swap FROM public.lodging_unit_swaps WHERE id = p_swap_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Troca % não encontrada.', p_swap_id USING ERRCODE = '22023';
  END IF;
  IF v_swap.status <> 'requested' THEN
    RETURN jsonb_build_object('ok', true, 'already_resolved', true, 'status', v_swap.status);
  END IF;

  -- Valida sexo + capacidade do destino.
  SELECT u.capacity, u.gender_restriction INTO v_to_unit
  FROM public.lodging_units u WHERE u.id = v_swap.to_unit_id;

  SELECT p.gender INTO v_part_gender
  FROM public.lodging_occupancies o
  JOIN public.participants pa ON pa.id = o.participant_id
  JOIN public.people p ON p.id = pa.person_id
  WHERE o.id = v_swap.occupancy_id;

  IF v_to_unit.gender_restriction IS NOT NULL
     AND v_to_unit.gender_restriction <> 'mixed'
     AND v_to_unit.gender_restriction <> v_part_gender
  THEN
    RAISE EXCEPTION 'Sexo do quarto de destino é incompatível.' USING ERRCODE = '22023';
  END IF;

  IF v_to_unit.capacity IS NOT NULL AND v_to_unit.capacity > 0 THEN
    SELECT COUNT(*) INTO v_current_count
    FROM public.lodging_occupancies
    WHERE (unit_id = v_swap.to_unit_id OR checked_in_unit_id = v_swap.to_unit_id)
      AND status IN ('checked_in','allocated','planned')
      AND id <> v_swap.occupancy_id;
    IF v_current_count >= v_to_unit.capacity THEN
      RAISE EXCEPTION 'Quarto de destino sem capacidade.' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Move a ocupação. Mantém status (checked_in continua checked_in).
  UPDATE public.lodging_occupancies
  SET unit_id            = v_swap.to_unit_id,
      checked_in_unit_id = CASE WHEN status = 'checked_in' THEN v_swap.to_unit_id ELSE checked_in_unit_id END,
      divergence_notes   = COALESCE(divergence_notes || ' | ', '')
                            || 'Troca aprovada (' || COALESCE(v_swap.reason, 'sem motivo') || ')',
      updated_at = now()
  WHERE id = v_swap.occupancy_id;

  UPDATE public.lodging_unit_swaps
  SET status = 'executed',
      approved_by = v_actor, approved_at = now(),
      executed_by = v_actor, executed_at = now(),
      updated_at = now()
  WHERE id = v_swap.id;

  RETURN jsonb_build_object('ok', true, 'swap_id', v_swap.id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_approve_lodging_swap(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_approve_lodging_swap(uuid) TO authenticated;

-- ============================================================
-- F. RLS aditiva: delegação enxerga só a própria escola
-- ============================================================

DROP POLICY IF EXISTS "lodging_locations delegacao read own" ON public.lodging_locations;
CREATE POLICY "lodging_locations delegacao read own" ON public.lodging_locations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'delegacao'::public.app_role)
    -- Operadores só veem locais que têm pelo menos 1 occupancy
    -- de participante da delegação dele.
    AND EXISTS (
      SELECT 1 FROM public.lodging_units u
      JOIN public.lodging_occupancies o ON o.unit_id = u.id OR o.checked_in_unit_id = u.id
      JOIN public.participants p ON p.id = o.participant_id
      WHERE u.location_id = lodging_locations.id
        AND p.delegation_id = public.get_user_delegation_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "lodging_units delegacao read own" ON public.lodging_units;
CREATE POLICY "lodging_units delegacao read own" ON public.lodging_units FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'delegacao'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.lodging_occupancies o
      JOIN public.participants p ON p.id = o.participant_id
      WHERE (o.unit_id = lodging_units.id OR o.checked_in_unit_id = lodging_units.id)
        AND p.delegation_id = public.get_user_delegation_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "lodging_occupancies delegacao read own" ON public.lodging_occupancies;
CREATE POLICY "lodging_occupancies delegacao read own" ON public.lodging_occupancies FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'delegacao'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = lodging_occupancies.participant_id
        AND p.delegation_id = public.get_user_delegation_id(auth.uid())
    )
  );

-- ============================================================
-- G. CHECK de category em lodging_incidents inclui 'colchao_perda'.
-- ============================================================

DO $$ BEGIN
  ALTER TABLE public.lodging_incidents DROP CONSTRAINT IF EXISTS lodging_incidents_category_check;
  ALTER TABLE public.lodging_incidents
    ADD CONSTRAINT lodging_incidents_category_check
    CHECK (category IN ('geral','disciplina','saude','patrimonio','seguranca','colchao_perda'));
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'lodging_incidents tem category fora do enum atualizado — constraint mantido NOT VALID.';
END $$;

-- ============================================================
-- H. Documentação canônica
-- ============================================================

COMMENT ON TABLE public.lodging_wings IS
  'Alas dentro de um alojamento (lodging_locations). Opcional. Quando preenchida, dita o gender_default herdado pelos quartos da ala. Permite organizar ala feminina/masculina no mesmo prédio.';

COMMENT ON TABLE public.lodging_mattress_inventory IS
  'Saldo atual de colchões por alojamento. 1 linha por location_id. current_qty é decrementado em check-in (consume) e incrementado em check-out (return) automaticamente via trigger handle_lodging_mattress_movement. Perdas/danos ficam fora deste fluxo — registrar via lodging_incidents (category=colchao_perda) e lançar movimento manual kind=lost.';

COMMENT ON TABLE public.lodging_mattress_movements IS
  'Trilha imutável de cada movimento de colchão. kind: consume (check-in), return (check-out), lost (incidente), restock (reposição), adjust (correção manual). qty negativo = saída do estoque, positivo = entrada.';

COMMENT ON TABLE public.lodging_unit_swaps IS
  'Workflow de troca de quarto: requested → approved/rejected → executed. RPCs rpc_request_lodging_swap e rpc_approve_lodging_swap enforçam validação de sexo e capacidade. Mantém auditoria de quem solicitou/aprovou/executou.';
