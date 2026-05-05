-- ============================================================
-- Alojamento — RPCs atômicas para gestão de colchões
-- ============================================================
-- A foundation v2 (20260505010000) entregou tabelas + trigger
-- automático de check-in/out. Esta migration adiciona as 3 RPCs
-- que a UI precisa para operações manuais (perda, reposição,
-- estoque inicial), garantindo atomicidade entre inventário,
-- movimento e (no caso de perda) incidente.
-- ============================================================

-- A) Define/ajusta estoque INICIAL de colchões em um alojamento.
--    Idempotente: se já existir linha, sobrescreve initial_qty e
--    ajusta current_qty pra ficar consistente (assume reposição
--    completa). Movement kind='adjust'.
CREATE OR REPLACE FUNCTION public.rpc_set_mattress_initial(
  p_location_id uuid,
  p_initial_qty int,
  p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old_initial int;
  v_old_current int;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = '28000';
  END IF;
  IF NOT (
    public.has_role(v_actor, 'admin'::public.app_role)
    OR public.has_role(v_actor, 'secretaria'::public.app_role)
    OR public.has_role(v_actor, 'alojamento'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF p_initial_qty < 0 THEN
    RAISE EXCEPTION 'initial_qty não pode ser negativo.' USING ERRCODE = '22023';
  END IF;

  SELECT initial_qty, current_qty INTO v_old_initial, v_old_current
  FROM public.lodging_mattress_inventory WHERE location_id = p_location_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.lodging_mattress_inventory (location_id, initial_qty, current_qty, notes)
    VALUES (p_location_id, p_initial_qty, p_initial_qty, p_notes);
    INSERT INTO public.lodging_mattress_movements (location_id, kind, qty, notes, created_by)
    VALUES (p_location_id, 'adjust', p_initial_qty,
            COALESCE(p_notes, '') || ' (estoque inicial criado)', v_actor);
    RETURN jsonb_build_object('ok', true, 'initial_qty', p_initial_qty, 'current_qty', p_initial_qty);
  END IF;

  -- Já existe: atualiza initial e ajusta current pela mesma proporção
  -- de mudança (assume reposição completa pra novo baseline).
  UPDATE public.lodging_mattress_inventory
  SET initial_qty = p_initial_qty,
      current_qty = GREATEST(p_initial_qty - (v_old_initial - v_old_current), 0),
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE location_id = p_location_id;

  INSERT INTO public.lodging_mattress_movements (location_id, kind, qty, notes, created_by)
  VALUES (p_location_id, 'adjust', p_initial_qty - v_old_initial,
          COALESCE(p_notes, '') || ' (ajuste de baseline)', v_actor);

  RETURN jsonb_build_object('ok', true, 'initial_qty', p_initial_qty,
                            'current_qty', GREATEST(p_initial_qty - (v_old_initial - v_old_current), 0));
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_mattress_initial(uuid, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_set_mattress_initial(uuid, int, text) TO authenticated;

-- B) Reposição: aumenta current_qty (e initial_qty conforme contexto).
--    Movement kind='restock', qty positivo.
CREATE OR REPLACE FUNCTION public.rpc_register_mattress_restock(
  p_location_id uuid,
  p_qty int,
  p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_new_current int;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = '28000';
  END IF;
  IF NOT (
    public.has_role(v_actor, 'admin'::public.app_role)
    OR public.has_role(v_actor, 'secretaria'::public.app_role)
    OR public.has_role(v_actor, 'alojamento'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'qty deve ser positivo.' USING ERRCODE = '22023';
  END IF;

  -- Garante linha de inventário (zero) se ainda não existe.
  INSERT INTO public.lodging_mattress_inventory (location_id, initial_qty, current_qty)
  VALUES (p_location_id, 0, 0)
  ON CONFLICT (location_id) DO NOTHING;

  UPDATE public.lodging_mattress_inventory
  SET current_qty = current_qty + p_qty,
      initial_qty = initial_qty + p_qty,
      updated_at = now()
  WHERE location_id = p_location_id
  RETURNING current_qty INTO v_new_current;

  INSERT INTO public.lodging_mattress_movements (location_id, kind, qty, notes, created_by)
  VALUES (p_location_id, 'restock', p_qty, p_notes, v_actor);

  RETURN jsonb_build_object('ok', true, 'current_qty', v_new_current);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_register_mattress_restock(uuid, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_register_mattress_restock(uuid, int, text) TO authenticated;

-- C) Perda: cria incidente + movement + decrementa current_qty.
--    Tudo atômico. Movement kind='lost', qty negativo, incident_id preenchido.
CREATE OR REPLACE FUNCTION public.rpc_register_mattress_loss(
  p_location_id uuid,
  p_qty int,
  p_description text,
  p_severity text DEFAULT 'media'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_incident_id uuid;
  v_new_current int;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = '28000';
  END IF;
  IF NOT (
    public.has_role(v_actor, 'admin'::public.app_role)
    OR public.has_role(v_actor, 'secretaria'::public.app_role)
    OR public.has_role(v_actor, 'alojamento'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'qty deve ser positivo (representa quantidade perdida).' USING ERRCODE = '22023';
  END IF;
  IF coalesce(trim(p_description), '') = '' THEN
    RAISE EXCEPTION 'description é obrigatória.' USING ERRCODE = '22023';
  END IF;
  IF p_severity NOT IN ('baixa','media','alta') THEN
    RAISE EXCEPTION 'severity inválida.' USING ERRCODE = '22023';
  END IF;

  -- Garante inventário.
  INSERT INTO public.lodging_mattress_inventory (location_id, initial_qty, current_qty)
  VALUES (p_location_id, 0, 0)
  ON CONFLICT (location_id) DO NOTHING;

  -- 1) Incidente.
  INSERT INTO public.lodging_incidents (
    location_id, category, severity, description, status, created_by
  ) VALUES (
    p_location_id, 'colchao_perda', p_severity,
    p_description || ' (qty=' || p_qty || ')',
    'aberta', v_actor
  ) RETURNING id INTO v_incident_id;

  -- 2) Movement.
  INSERT INTO public.lodging_mattress_movements (location_id, incident_id, kind, qty, notes, created_by)
  VALUES (p_location_id, v_incident_id, 'lost', -p_qty, p_description, v_actor);

  -- 3) Decrementa saldo.
  UPDATE public.lodging_mattress_inventory
  SET current_qty = GREATEST(current_qty - p_qty, 0),
      updated_at = now()
  WHERE location_id = p_location_id
  RETURNING current_qty INTO v_new_current;

  RETURN jsonb_build_object(
    'ok', true,
    'incident_id', v_incident_id,
    'current_qty', v_new_current
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_register_mattress_loss(uuid, int, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_register_mattress_loss(uuid, int, text, text) TO authenticated;

COMMENT ON FUNCTION public.rpc_set_mattress_initial(uuid, int, text) IS
  'Define ou ajusta o estoque inicial (baseline) de colchões num alojamento. Idempotente. Gera movement kind=adjust.';

COMMENT ON FUNCTION public.rpc_register_mattress_restock(uuid, int, text) IS
  'Registra reposição de colchões. Aumenta current_qty e initial_qty. Gera movement kind=restock.';

COMMENT ON FUNCTION public.rpc_register_mattress_loss(uuid, int, text, text) IS
  'Registra perda/dano de colchões. Atômico: cria incidente (category=colchao_perda) + movement (kind=lost) + decrementa current_qty.';
