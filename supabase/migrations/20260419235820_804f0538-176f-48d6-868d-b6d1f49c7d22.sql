-- ============================================================
-- FASE 4: View consolidada de consumo logístico por pessoa
-- ============================================================
CREATE OR REPLACE VIEW public.vw_person_logistics_consumption AS
SELECT
  p.id                                AS participant_id,
  p.event_id                          AS event_id,
  p.person_id                         AS person_id,
  pe.full_name                        AS full_name,
  pe.cpf                              AS cpf,
  p.delegation_id                     AS delegation_id,
  d.school_name                       AS delegation_name,
  p.participant_type                  AS participant_type,
  p.needs_transport                   AS needs_transport,
  p.needs_meals                       AS needs_meals,
  p.needs_lodging                     AS needs_lodging,
  COALESCE(t.boarding_count, 0)       AS transport_boardings,
  COALESCE(m.meal_count, 0)           AS meals_consumed,
  COALESCE(l.lodging_nights, 0)       AS lodging_nights,
  COALESCE(v.voucher_uses, 0)         AS voucher_uses_total
FROM public.participants p
JOIN public.people pe       ON pe.id = p.person_id
LEFT JOIN public.delegations d ON d.id = p.delegation_id
LEFT JOIN (
  SELECT participant_id, COUNT(*) FILTER (WHERE status = 'boarded') AS boarding_count
  FROM public.transport_passengers
  GROUP BY participant_id
) t ON t.participant_id = p.id
LEFT JOIN (
  SELECT participant_id, COUNT(*) AS meal_count
  FROM public.meal_consumptions
  GROUP BY participant_id
) m ON m.participant_id = p.id
LEFT JOIN (
  SELECT participant_id, COUNT(DISTINCT DATE(checked_in_at)) AS lodging_nights
  FROM public.lodging_occupancies
  WHERE checked_in_at IS NOT NULL
  GROUP BY participant_id
) l ON l.participant_id = p.id
LEFT JOIN (
  SELECT sv.participant_id, COUNT(svu.id) AS voucher_uses
  FROM public.service_vouchers sv
  LEFT JOIN public.service_voucher_uses svu ON svu.voucher_id = sv.id
  GROUP BY sv.participant_id
) v ON v.participant_id = p.id;

GRANT SELECT ON public.vw_person_logistics_consumption TO authenticated;

-- ============================================================
-- FASE 5: Detecção e merge de duplicidades
-- ============================================================

-- 1) Listar grupos de possíveis duplicidades
CREATE OR REPLACE FUNCTION public.find_duplicate_people()
RETURNS TABLE (
  group_key text,
  match_kind text,
  person_id uuid,
  full_name text,
  cpf text,
  birth_date date,
  participants_count bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin')
       OR public.has_role(auth.uid(),'secretaria')
       OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  WITH cpf_dupes AS (
    SELECT regexp_replace(pe.cpf, '\D', '', 'g') AS k, 'cpf' AS kind
    FROM public.people pe
    WHERE pe.cpf IS NOT NULL AND length(regexp_replace(pe.cpf, '\D', '', 'g')) >= 11
    GROUP BY 1
    HAVING COUNT(*) > 1
  ),
  name_dupes AS (
    SELECT lower(unaccent(trim(pe.full_name))) || '|' || COALESCE(pe.birth_date::text,'') AS k, 'name+birth' AS kind
    FROM public.people pe
    WHERE pe.full_name IS NOT NULL AND pe.birth_date IS NOT NULL
    GROUP BY 1
    HAVING COUNT(*) > 1
  ),
  all_groups AS (
    SELECT k, kind FROM cpf_dupes
    UNION ALL
    SELECT k, kind FROM name_dupes
  )
  SELECT
    g.k AS group_key,
    g.kind AS match_kind,
    pe.id AS person_id,
    pe.full_name,
    pe.cpf,
    pe.birth_date,
    (SELECT COUNT(*) FROM public.participants pa WHERE pa.person_id = pe.id) AS participants_count,
    pe.created_at
  FROM all_groups g
  JOIN public.people pe ON
    (g.kind = 'cpf' AND regexp_replace(pe.cpf,'\D','','g') = g.k)
    OR
    (g.kind = 'name+birth' AND lower(unaccent(trim(pe.full_name))) || '|' || COALESCE(pe.birth_date::text,'') = g.k)
  ORDER BY g.kind, g.k, pe.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.find_duplicate_people() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_duplicate_people() TO authenticated;

-- 2) Mesclar duas pessoas (move tudo para keep, apaga drop)
CREATE OR REPLACE FUNCTION public.merge_people(
  p_keep_id uuid,
  p_drop_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keep public.people%ROWTYPE;
  v_drop public.people%ROWTYPE;
  v_moved_participants int := 0;
  v_moved_vouchers int := 0;
  v_kept_participants uuid[];
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501';
  END IF;

  IF p_keep_id = p_drop_id THEN
    RAISE EXCEPTION 'Não é possível mesclar a mesma pessoa' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_keep FROM public.people WHERE id = p_keep_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pessoa principal não encontrada'; END IF;

  SELECT * INTO v_drop FROM public.people WHERE id = p_drop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pessoa duplicada não encontrada'; END IF;

  -- Copia campos faltantes da pessoa duplicada para a principal
  UPDATE public.people SET
    cpf          = COALESCE(v_keep.cpf, v_drop.cpf),
    birth_date   = COALESCE(v_keep.birth_date, v_drop.birth_date),
    gender       = COALESCE(v_keep.gender, v_drop.gender),
    email        = COALESCE(v_keep.email, v_drop.email),
    phone        = COALESCE(v_keep.phone, v_drop.phone),
    updated_at   = now()
  WHERE id = p_keep_id;

  -- Para cada participant do drop, se não existir keep no mesmo evento, move; senão consolida
  FOR v_kept_participants IN
    SELECT array_agg(pa_drop.id)
    FROM public.participants pa_drop
    LEFT JOIN public.participants pa_keep
      ON pa_keep.person_id = p_keep_id AND pa_keep.event_id = pa_drop.event_id
    WHERE pa_drop.person_id = p_drop_id AND pa_keep.id IS NULL
  LOOP
    UPDATE public.participants SET person_id = p_keep_id, updated_at = now()
    WHERE id = ANY(v_kept_participants);
    GET DIAGNOSTICS v_moved_participants = ROW_COUNT;
  END LOOP;

  -- Vouchers do drop apontam para participants do drop — esses já mudaram person_id acima.
  -- Para participants duplicados (mesmo evento), mover vouchers e usos para o participant do keep e remover o do drop.
  WITH dup AS (
    SELECT pa_drop.id AS drop_pid, pa_keep.id AS keep_pid
    FROM public.participants pa_drop
    JOIN public.participants pa_keep
      ON pa_keep.person_id = p_keep_id AND pa_keep.event_id = pa_drop.event_id
    WHERE pa_drop.person_id = p_drop_id
  ),
  mv AS (
    UPDATE public.service_vouchers sv
    SET participant_id = dup.keep_pid, updated_at = now()
    FROM dup WHERE sv.participant_id = dup.drop_pid
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_moved_vouchers FROM mv;

  -- Apaga participants duplicados (mesmo evento) do drop
  DELETE FROM public.participants pa_drop
  USING public.participants pa_keep
  WHERE pa_drop.person_id = p_drop_id
    AND pa_keep.person_id = p_keep_id
    AND pa_keep.event_id = pa_drop.event_id;

  -- Audita o merge
  INSERT INTO public.audit_events (table_name, record_id, action, payload, created_by)
  VALUES (
    'people',
    p_keep_id,
    'MERGE',
    jsonb_build_object(
      'kept_id', p_keep_id,
      'dropped_id', p_drop_id,
      'dropped_snapshot', to_jsonb(v_drop),
      'moved_participants', v_moved_participants,
      'moved_vouchers', v_moved_vouchers
    ),
    auth.uid()
  );

  -- Por fim apaga a pessoa duplicada (cascade limpa o restante)
  DELETE FROM public.people WHERE id = p_drop_id;

  RETURN jsonb_build_object(
    'ok', true,
    'kept_id', p_keep_id,
    'moved_participants', v_moved_participants,
    'moved_vouchers', v_moved_vouchers
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_people(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_people(uuid, uuid) TO authenticated;