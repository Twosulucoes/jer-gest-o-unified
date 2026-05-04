-- ============================================================
-- Auditoria Dashboard/KPIs Fase 1 — Fix get_alojamento_kpis
-- ============================================================
-- Auditoria: docs/auditoria-dashboard-kpis.md
--
-- Bug original (achado #2 da auditoria de Dashboard):
--   `get_alojamento_kpis` contava status = 'planned' para
--   `reserved_beds` e `assigned_beds`, mas o fluxo operacional
--   real grava status = 'allocated' quando alocação acontece
--   antes do check-in. Resultado: card "Reservados" sempre 0.
--
-- O CHECK aplicado em Etapa 3 da auditoria de Alojamento aceita
-- 5 valores: planned, allocated, checked_in, checked_out,
-- cancelled. Ambos `planned` e `allocated` representam "alocação
-- pré-check-in" (com nuances semânticas), então a contagem agora
-- soma os dois.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_alojamento_kpis(p_facility_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_hospedados     int;
  v_checkins_hoje  int;
  v_checkouts_hoje int;
  v_total_capacity int;
  v_reserved       int;  -- antes: v_planned (apenas 'planned')
  v_today          date := current_date;
BEGIN
  -- 1. Hospedados (atualmente em check-in).
  SELECT COUNT(*) INTO v_hospedados
  FROM public.lodging_occupancies
  WHERE (unit_id IN (SELECT id FROM public.lodging_units WHERE location_id = p_facility_id)
         OR checked_in_location_id = p_facility_id)
    AND status = 'checked_in';

  -- 2. Check-ins de hoje.
  SELECT COUNT(*) INTO v_checkins_hoje
  FROM public.lodging_occupancies
  WHERE (unit_id IN (SELECT id FROM public.lodging_units WHERE location_id = p_facility_id)
         OR checked_in_location_id = p_facility_id)
    AND status = 'checked_in'
    AND checked_in_at >= v_today::timestamptz;

  -- 3. Check-outs de hoje.
  SELECT COUNT(*) INTO v_checkouts_hoje
  FROM public.lodging_occupancies
  WHERE (unit_id IN (SELECT id FROM public.lodging_units WHERE location_id = p_facility_id)
         OR checked_in_location_id = p_facility_id)
    AND status = 'checked_out'
    AND checked_out_at >= v_today::timestamptz;

  -- 4. Capacidade total (camas ativas).
  SELECT COALESCE(SUM(capacity), 0) INTO v_total_capacity
  FROM public.lodging_units
  WHERE location_id = p_facility_id AND is_active = true;

  -- 5. Reservados = alocados antes do check-in.
  --    Inclui AMBOS 'planned' e 'allocated' (CHECK aceita os dois;
  --    o fluxo via PWA usa 'allocated', mas alocações em lote
  --    pré-evento podem entrar como 'planned').
  SELECT COUNT(*) INTO v_reserved
  FROM public.lodging_occupancies
  WHERE unit_id IN (SELECT id FROM public.lodging_units WHERE location_id = p_facility_id)
    AND status IN ('planned', 'allocated');

  RETURN jsonb_build_object(
    'hospedados',      v_hospedados,
    'checkins_hoje',   v_checkins_hoje,
    'checkouts_hoje',  v_checkouts_hoje,
    'total_beds',      v_total_capacity,
    'assigned_beds',   v_hospedados + v_reserved,
    'reserved_beds',   v_reserved
  );
END;
$$;
