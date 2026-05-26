-- ============================================================
-- FIX: All 6 consumo report views must filter by mc.status = 'active'
-- The status column was added in 20260513000000 but the views in
-- 20260511000002 were created before that and never updated.
-- This migration recreates all views with the active-status filter.
-- ============================================================

-- ============================================================
-- VIEW 1: vw_consumo_completo
-- One row per consumption record with full audit context.
-- FIX: Added WHERE mc.status = 'active'
-- ============================================================
CREATE OR REPLACE VIEW public.vw_consumo_completo
WITH (security_invoker = true)
AS
SELECT
  mc.id,
  mc.created_at,
  mc.consumed_at,
  -- participant
  p_person.full_name                          AS participante_nome,
  p_person.cpf                                AS participante_cpf,
  mc.participant_id                           AS participante_id,
  -- stage
  es.name                                     AS etapa_nome,
  es.id                                       AS etapa_id,
  -- meal window
  COALESCE(mw.label, mt.name)                 AS janela_nome,
  mw.service_date                             AS janela_data,
  mw.start_time                               AS janela_inicio,
  mw.end_time                                 AS janela_fim,
  -- meal type
  mt.name                                     AS refeicao_tipo,
  -- operator
  prof.full_name                              AS registrado_por_nome,
  mc.registered_by                            AS registrado_por_id,
  -- sync / offline tracking
  CASE
    WHEN mc.is_offline = false THEN 'realtime'
    WHEN mc.is_offline = true  THEN 'queue'
    ELSE 'realtime'
  END                                         AS sync_status,
  mc.sync_at,
  CASE
    WHEN mc.is_offline = true AND mc.sync_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (mc.sync_at - mc.created_at))::int
    ELSE NULL
  END                                         AS sync_delay_segundos,
  -- origin
  CASE
    WHEN mc.method = 'qr_scan'  THEN 'scan_qr'
    WHEN mc.method = 'voucher'  THEN 'voucher'
    ELSE 'busca_manual'
  END                                         AS origem,
  mc.device_info,
  mc.duplicidade_detectada,
  mc.method,
  mc.notes,
  -- scope FKs (for client-side filtering)
  mw.event_id,
  mw.event_stage_id
FROM public.meal_consumptions mc
JOIN public.meal_windows       mw     ON mw.id     = mc.meal_window_id
JOIN public.meal_types         mt     ON mt.id     = mw.meal_type_id
JOIN public.participants       part   ON part.id   = mc.participant_id
JOIN public.people             p_person ON p_person.id = part.person_id
LEFT JOIN public.event_stages  es     ON es.id     = mw.event_stage_id
LEFT JOIN public.profiles      prof   ON prof.id   = mc.registered_by
WHERE mc.status = 'active';

-- ============================================================
-- VIEW 2: vw_consumo_por_dia
-- Totals grouped by service_date x stage.
-- FIX: Added WHERE mc.status = 'active'
-- ============================================================
CREATE OR REPLACE VIEW public.vw_consumo_por_dia
WITH (security_invoker = true)
AS
SELECT
  mw.service_date                             AS data,
  es.name                                     AS etapa_nome,
  es.id                                       AS etapa_id,
  mw.event_id,
  mw.event_stage_id,
  COUNT(mc.id)                                AS total_consumos,
  COUNT(mc.id) FILTER (WHERE mc.is_offline = false OR mc.is_offline IS NULL)
                                              AS total_realtime,
  COUNT(mc.id) FILTER (WHERE mc.is_offline = true)
                                              AS total_queue,
  COUNT(mc.id) FILTER (WHERE mc.duplicidade_detectada = true)
                                              AS total_duplicidade,
  COUNT(DISTINCT mc.registered_by)            AS usuarios_distintos,
  COUNT(DISTINCT mc.participant_id)           AS participantes_distintos
FROM public.meal_consumptions mc
JOIN public.meal_windows mw ON mw.id = mc.meal_window_id
LEFT JOIN public.event_stages es ON es.id = mw.event_stage_id
WHERE mc.status = 'active'
GROUP BY mw.service_date, es.name, es.id, mw.event_id, mw.event_stage_id;

-- ============================================================
-- VIEW 3: vw_consumo_por_janela
-- Totals grouped by meal window (date x stage x window).
-- FIX: Added AND mc.status = 'active' to LEFT JOIN ON clause
-- (mc is on the right side of a LEFT JOIN so filter goes in ON)
-- ============================================================
CREATE OR REPLACE VIEW public.vw_consumo_por_janela
WITH (security_invoker = true)
AS
SELECT
  mw.service_date                             AS data,
  es.name                                     AS etapa_nome,
  es.id                                       AS etapa_id,
  mw.id                                       AS janela_id,
  COALESCE(mw.label, mt.name)                 AS janela_nome,
  mt.name                                     AS refeicao_tipo,
  mw.start_time                               AS horario_inicio,
  mw.end_time                                 AS horario_fim,
  mw.event_id,
  mw.event_stage_id,
  COUNT(mc.id)                                AS total_consumos,
  COUNT(mc.id) FILTER (WHERE mc.is_offline = false OR mc.is_offline IS NULL)
                                              AS total_realtime,
  COUNT(mc.id) FILTER (WHERE mc.is_offline = true)
                                              AS total_queue,
  COUNT(mc.id) FILTER (WHERE mc.duplicidade_detectada = true)
                                              AS total_duplicidade,
  MIN(mc.consumed_at)                         AS primeiro_consumo,
  MAX(mc.consumed_at)                         AS ultimo_consumo
FROM public.meal_windows mw
JOIN public.meal_types mt ON mt.id = mw.meal_type_id
LEFT JOIN public.meal_consumptions mc ON mc.meal_window_id = mw.id AND mc.status = 'active'
LEFT JOIN public.event_stages es ON es.id = mw.event_stage_id
GROUP BY
  mw.service_date, es.name, es.id,
  mw.id, mw.label, mt.name,
  mw.start_time, mw.end_time,
  mw.event_id, mw.event_stage_id;

-- ============================================================
-- VIEW 4: vw_consumo_por_operador
-- Totals grouped by operator x service_date x window.
-- FIX: Added WHERE mc.status = 'active'
-- ============================================================
CREATE OR REPLACE VIEW public.vw_consumo_por_operador
WITH (security_invoker = true)
AS
SELECT
  COALESCE(prof.full_name, mc.registered_by::text)
                                              AS operador_nome,
  mc.registered_by                            AS operador_id,
  mw.service_date                             AS data,
  es.name                                     AS etapa_nome,
  es.id                                       AS etapa_id,
  COALESCE(mw.label, mt.name)                 AS janela_nome,
  mw.id                                       AS janela_id,
  mw.event_id,
  mw.event_stage_id,
  COUNT(mc.id)                                AS total_registrado,
  COUNT(mc.id) FILTER (WHERE mc.method = 'qr_scan')  AS total_scan_qr,
  COUNT(mc.id) FILTER (WHERE mc.method = 'manual')   AS total_manual,
  COUNT(mc.id) FILTER (WHERE mc.method = 'voucher')  AS total_voucher,
  MIN(mc.consumed_at)                         AS primeiro_scan,
  MAX(mc.consumed_at)                         AS ultimo_scan,
  CASE
    WHEN COUNT(mc.id) > 1
      THEN ROUND(
        EXTRACT(EPOCH FROM (MAX(mc.consumed_at) - MIN(mc.consumed_at)))
        / NULLIF(COUNT(mc.id) - 1, 0)
      )
    ELSE NULL
  END                                         AS media_intervalo_segundos
FROM public.meal_consumptions mc
JOIN public.meal_windows mw ON mw.id = mc.meal_window_id
JOIN public.meal_types   mt ON mt.id = mw.meal_type_id
LEFT JOIN public.event_stages es ON es.id = mw.event_stage_id
LEFT JOIN public.profiles    prof ON prof.id = mc.registered_by
WHERE mc.status = 'active'
GROUP BY
  prof.full_name, mc.registered_by,
  mw.service_date, es.name, es.id,
  mw.label, mt.name, mw.id,
  mw.event_id, mw.event_stage_id;

-- ============================================================
-- VIEW 5: vw_erros_sync
-- Records that came via offline queue OR were flagged as duplicates.
-- FIX: Added AND mc.status = 'active' to existing WHERE clause
-- ============================================================
CREATE OR REPLACE VIEW public.vw_erros_sync
WITH (security_invoker = true)
AS
SELECT
  mc.id,
  mc.created_at,
  mc.consumed_at,
  p_person.full_name                          AS participante_nome,
  mc.participant_id,
  es.name                                     AS etapa_nome,
  es.id                                       AS etapa_id,
  COALESCE(mw.label, mt.name)                 AS janela_nome,
  mw.service_date                             AS janela_data,
  -- sync fields
  CASE
    WHEN mc.duplicidade_detectada THEN 'duplicidade'
    WHEN mc.is_offline            THEN 'queue'
    ELSE 'realtime'
  END                                         AS sync_status,
  mc.is_offline,
  mc.sync_at,
  CASE
    WHEN mc.is_offline AND mc.sync_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (mc.sync_at - mc.created_at))::int
    ELSE NULL
  END                                         AS sync_delay_segundos,
  mc.duplicidade_detectada,
  mc.device_info,
  mc.method,
  mc.notes,
  COALESCE(prof.full_name, mc.registered_by::text)
                                              AS registrado_por_nome,
  mc.registered_by                            AS registrado_por_id,
  mw.event_id,
  mw.event_stage_id
FROM public.meal_consumptions mc
JOIN public.meal_windows       mw     ON mw.id     = mc.meal_window_id
JOIN public.meal_types         mt     ON mt.id     = mw.meal_type_id
JOIN public.participants       part   ON part.id   = mc.participant_id
JOIN public.people             p_person ON p_person.id = part.person_id
LEFT JOIN public.event_stages  es     ON es.id     = mw.event_stage_id
LEFT JOIN public.profiles      prof   ON prof.id   = mc.registered_by
WHERE mc.status = 'active'
  AND (mc.is_offline = true OR mc.duplicidade_detectada = true);

-- ============================================================
-- VIEW 6: vw_consumo_por_etapa
-- Consolidated totals per event stage.
-- FIX: Added AND mc.status = 'active' to LEFT JOIN ON clause
-- (mc is on the right side of a LEFT JOIN so filter goes in ON)
-- ============================================================
CREATE OR REPLACE VIEW public.vw_consumo_por_etapa
WITH (security_invoker = true)
AS
SELECT
  es.name                                     AS etapa_nome,
  es.id                                       AS etapa_id,
  es.starts_at                                AS data_inicio,
  es.ends_at                                  AS data_fim,
  es.event_id,
  COUNT(mc.id)                                AS total_refeicoes,
  COUNT(DISTINCT mc.participant_id)           AS total_participantes_distintos,
  CASE
    WHEN COUNT(DISTINCT mw.service_date) > 0
      THEN ROUND(COUNT(mc.id)::numeric / COUNT(DISTINCT mw.service_date), 1)
    ELSE 0
  END                                         AS media_por_dia,
  COUNT(mc.id) FILTER (WHERE mc.duplicidade_detectada = true)
                                              AS total_erros,
  COUNT(mc.id) FILTER (WHERE mc.is_offline = true)
                                              AS total_queue,
  COUNT(mc.id) FILTER (WHERE mc.is_offline = false OR mc.is_offline IS NULL)
                                              AS total_realtime,
  CASE
    WHEN COUNT(mc.id) > 0
      THEN ROUND(
        (COUNT(mc.id) FILTER (WHERE mc.duplicidade_detectada = true))::numeric
        / COUNT(mc.id) * 100,
        2
      )
    ELSE 0
  END                                         AS taxa_erro_percent
FROM public.event_stages es
LEFT JOIN public.meal_windows mw
       ON mw.event_stage_id = es.id
LEFT JOIN public.meal_consumptions mc
       ON mc.meal_window_id = mw.id AND mc.status = 'active'
GROUP BY es.name, es.id, es.starts_at, es.ends_at, es.event_id;
