-- ============================================================
-- Auditoria Dashboard/KPIs Fase 2 — Stage scope no get_alojamento_kpis
-- ============================================================
-- Auditoria: docs/auditoria-dashboard-kpis.md (Fase 2)
--
-- Adiciona parâmetro opcional `p_event_stage_id` ao RPC. Quando
-- presente, todas as agregações filtram por `event_stage_id` em
-- lodging_units e lodging_occupancies (campos denormalizados na
-- Etapa 3 da auditoria de Alojamento).
--
-- Sem o parâmetro, o RPC mantém o comportamento legado (toda a
-- facility, cross-stage). Para compatibilidade com callers
-- existentes, o parâmetro é opcional e default null.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_alojamento_kpis(
  p_facility_id uuid,
  p_event_stage_id uuid DEFAULT NULL
)
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
  v_reserved       int;
  v_today          date := current_date;
BEGIN
  -- 1. Hospedados (atualmente em check-in).
  SELECT COUNT(*) INTO v_hospedados
  FROM public.lodging_occupancies o
  WHERE (o.unit_id IN (
           SELECT u.id FROM public.lodging_units u
            WHERE u.location_id = p_facility_id
              AND (p_event_stage_id IS NULL OR u.event_stage_id = p_event_stage_id))
         OR o.checked_in_location_id = p_facility_id)
    AND (p_event_stage_id IS NULL OR o.event_stage_id = p_event_stage_id)
    AND o.status = 'checked_in';

  -- 2. Check-ins de hoje.
  SELECT COUNT(*) INTO v_checkins_hoje
  FROM public.lodging_occupancies o
  WHERE (o.unit_id IN (
           SELECT u.id FROM public.lodging_units u
            WHERE u.location_id = p_facility_id
              AND (p_event_stage_id IS NULL OR u.event_stage_id = p_event_stage_id))
         OR o.checked_in_location_id = p_facility_id)
    AND (p_event_stage_id IS NULL OR o.event_stage_id = p_event_stage_id)
    AND o.status = 'checked_in'
    AND o.checked_in_at >= v_today::timestamptz;

  -- 3. Check-outs de hoje.
  SELECT COUNT(*) INTO v_checkouts_hoje
  FROM public.lodging_occupancies o
  WHERE (o.unit_id IN (
           SELECT u.id FROM public.lodging_units u
            WHERE u.location_id = p_facility_id
              AND (p_event_stage_id IS NULL OR u.event_stage_id = p_event_stage_id))
         OR o.checked_in_location_id = p_facility_id)
    AND (p_event_stage_id IS NULL OR o.event_stage_id = p_event_stage_id)
    AND o.status = 'checked_out'
    AND o.checked_out_at >= v_today::timestamptz;

  -- 4. Capacidade total (camas ativas).
  SELECT COALESCE(SUM(u.capacity), 0) INTO v_total_capacity
  FROM public.lodging_units u
  WHERE u.location_id = p_facility_id
    AND u.is_active = true
    AND (p_event_stage_id IS NULL OR u.event_stage_id = p_event_stage_id);

  -- 5. Reservados (planejados pré-check-in: 'planned' ou 'allocated').
  SELECT COUNT(*) INTO v_reserved
  FROM public.lodging_occupancies o
  WHERE o.unit_id IN (
          SELECT u.id FROM public.lodging_units u
           WHERE u.location_id = p_facility_id
             AND (p_event_stage_id IS NULL OR u.event_stage_id = p_event_stage_id))
    AND (p_event_stage_id IS NULL OR o.event_stage_id = p_event_stage_id)
    AND o.status IN ('planned', 'allocated');

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
