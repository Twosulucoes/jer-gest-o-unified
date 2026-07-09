-- ============================================================
-- Fecha o gap encontrado na 2ª auditoria de KPIs de alimentação:
-- as views de relatório (vw_consumo_completo, vw_consumo_por_dia,
-- vw_consumo_por_janela, vw_consumo_por_operador, vw_erros_sync,
-- vw_consumo_por_etapa), criadas em
-- 20260511000002_consumo_report_views.sql, só liam de
-- meal_consumptions e nunca de meal_consumptions_unlinked (QRs que
-- não resolveram a um participante cadastrado, mas foram liberados
-- mesmo assim — ver 20260708232000_meal_consumptions_unlinked_table.sql).
--
-- Isso já tinha sido corrigido em AlimentacaoConsumoPage.tsx e
-- AlimentacaoRelatoriosPage.tsx (commit 7287055/PR #272), que somam
-- linked + unlinked no client, mas a tela "Relatório de Consumo"
-- (useRelatorioConsumo.ts / AlimentacaoRelatoriosConsumoPage.tsx)
-- depende só destas 6 views e ficou de fora — todo scan não
-- vinculado desaparecia de "Total Refeições", "Por Dia", "Por
-- Janela", "Por Operador" (coluna QR) e "Por Etapa" (numerador e
-- denominador de taxa_erro_percent).
--
-- Introduz vw_meal_consumptions_all, uma view base que unifica os
-- dois conjuntos de linhas (mesmo padrão de rótulo "Consumo avulso:
-- {qr_code}" já usado em AlimentacaoRelatoriosPage.tsx), e reaponta
-- as 6 views existentes para ela em vez de meal_consumptions
-- diretamente. Nenhuma coluna exposta pelas views foi removida ou
-- renomeada — apenas o FROM/JOIN mudou — para não quebrar o hook
-- nem os exports CSV existentes.
-- ============================================================

CREATE OR REPLACE VIEW public.vw_meal_consumptions_all
WITH (security_invoker = true)
AS
SELECT
  mc.id,
  mc.created_at,
  mc.consumed_at,
  mc.meal_window_id,
  mc.participant_id,
  mc.registered_by,
  mc.method,
  mc.is_offline,
  mc.duplicidade_detectada,
  mc.sync_at,
  mc.device_info,
  mc.notes,
  NULL::text                                  AS qr_code,
  'linked'::text                              AS source_type
FROM public.meal_consumptions mc

UNION ALL

SELECT
  mu.id,
  mu.consumed_at                              AS created_at,
  mu.consumed_at,
  mu.meal_window_id,
  NULL::uuid                                  AS participant_id,
  mu.registered_by,
  mu.method,
  false                                       AS is_offline,
  false                                       AS duplicidade_detectada,
  NULL::timestamptz                           AS sync_at,
  NULL::jsonb                                 AS device_info,
  NULL::text                                  AS notes,
  mu.qr_code,
  'unlinked'::text                            AS source_type
FROM public.meal_consumptions_unlinked mu;

GRANT SELECT ON public.vw_meal_consumptions_all TO authenticated;

-- ============================================================
-- VIEW 1: vw_consumo_completo
-- ============================================================
CREATE OR REPLACE VIEW public.vw_consumo_completo
WITH (security_invoker = true)
AS
SELECT
  vca.id,
  vca.created_at,
  vca.consumed_at,
  COALESCE(p_person.full_name, 'Consumo avulso: ' || vca.qr_code)
                                               AS participante_nome,
  p_person.cpf                                AS participante_cpf,
  vca.participant_id                          AS participante_id,
  es.name                                     AS etapa_nome,
  es.id                                       AS etapa_id,
  COALESCE(mw.label, mt.name)                 AS janela_nome,
  mw.service_date                             AS janela_data,
  mw.start_time                               AS janela_inicio,
  mw.end_time                                 AS janela_fim,
  mt.name                                     AS refeicao_tipo,
  prof.full_name                              AS registrado_por_nome,
  vca.registered_by                           AS registrado_por_id,
  CASE
    WHEN vca.is_offline = false THEN 'realtime'
    WHEN vca.is_offline = true  THEN 'queue'
    ELSE 'realtime'
  END                                         AS sync_status,
  vca.sync_at,
  CASE
    WHEN vca.is_offline = true AND vca.sync_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (vca.sync_at - vca.created_at))::int
    ELSE NULL
  END                                         AS sync_delay_segundos,
  CASE
    WHEN vca.method = 'qr_scan'  THEN 'scan_qr'
    WHEN vca.method = 'voucher'  THEN 'voucher'
    ELSE 'busca_manual'
  END                                         AS origem,
  vca.device_info,
  vca.duplicidade_detectada,
  vca.method,
  vca.notes,
  mw.event_id,
  mw.event_stage_id
FROM public.vw_meal_consumptions_all vca
JOIN public.meal_windows       mw     ON mw.id     = vca.meal_window_id
JOIN public.meal_types         mt     ON mt.id     = mw.meal_type_id
LEFT JOIN public.participants  part   ON part.id   = vca.participant_id
LEFT JOIN public.people        p_person ON p_person.id = part.person_id
LEFT JOIN public.event_stages  es     ON es.id     = mw.event_stage_id
LEFT JOIN public.profiles      prof   ON prof.id   = vca.registered_by;

GRANT SELECT ON public.vw_consumo_completo TO authenticated;

-- ============================================================
-- VIEW 2: vw_consumo_por_dia
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
  COUNT(vca.id)                               AS total_consumos,
  COUNT(vca.id) FILTER (WHERE vca.is_offline = false OR vca.is_offline IS NULL)
                                               AS total_realtime,
  COUNT(vca.id) FILTER (WHERE vca.is_offline = true)
                                               AS total_queue,
  COUNT(vca.id) FILTER (WHERE vca.duplicidade_detectada = true)
                                               AS total_duplicidade,
  COUNT(DISTINCT vca.registered_by)           AS usuarios_distintos,
  COUNT(DISTINCT vca.participant_id)          AS participantes_distintos
FROM public.vw_meal_consumptions_all vca
JOIN public.meal_windows mw ON mw.id = vca.meal_window_id
LEFT JOIN public.event_stages es ON es.id = mw.event_stage_id
GROUP BY mw.service_date, es.name, es.id, mw.event_id, mw.event_stage_id;

GRANT SELECT ON public.vw_consumo_por_dia TO authenticated;

-- ============================================================
-- VIEW 3: vw_consumo_por_janela
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
  COUNT(vca.id)                               AS total_consumos,
  COUNT(vca.id) FILTER (WHERE vca.is_offline = false OR vca.is_offline IS NULL)
                                               AS total_realtime,
  COUNT(vca.id) FILTER (WHERE vca.is_offline = true)
                                               AS total_queue,
  COUNT(vca.id) FILTER (WHERE vca.duplicidade_detectada = true)
                                               AS total_duplicidade,
  MIN(vca.consumed_at)                        AS primeiro_consumo,
  MAX(vca.consumed_at)                        AS ultimo_consumo
FROM public.meal_windows mw
JOIN public.meal_types mt ON mt.id = mw.meal_type_id
LEFT JOIN public.vw_meal_consumptions_all vca ON vca.meal_window_id = mw.id
LEFT JOIN public.event_stages es ON es.id = mw.event_stage_id
GROUP BY
  mw.service_date, es.name, es.id,
  mw.id, mw.label, mt.name,
  mw.start_time, mw.end_time,
  mw.event_id, mw.event_stage_id;

GRANT SELECT ON public.vw_consumo_por_janela TO authenticated;

-- ============================================================
-- VIEW 4: vw_consumo_por_operador
-- ============================================================
CREATE OR REPLACE VIEW public.vw_consumo_por_operador
WITH (security_invoker = true)
AS
SELECT
  COALESCE(prof.full_name, vca.registered_by::text, 'Sem operador')
                                               AS operador_nome,
  vca.registered_by                           AS operador_id,
  mw.service_date                             AS data,
  es.name                                     AS etapa_nome,
  es.id                                       AS etapa_id,
  COALESCE(mw.label, mt.name)                 AS janela_nome,
  mw.id                                       AS janela_id,
  mw.event_id,
  mw.event_stage_id,
  COUNT(vca.id)                               AS total_registrado,
  COUNT(vca.id) FILTER (WHERE vca.method = 'qr_scan')  AS total_scan_qr,
  COUNT(vca.id) FILTER (WHERE vca.method = 'manual')   AS total_manual,
  COUNT(vca.id) FILTER (WHERE vca.method = 'voucher')  AS total_voucher,
  MIN(vca.consumed_at)                        AS primeiro_scan,
  MAX(vca.consumed_at)                        AS ultimo_scan,
  CASE
    WHEN COUNT(vca.id) > 1
      THEN ROUND(
        EXTRACT(EPOCH FROM (MAX(vca.consumed_at) - MIN(vca.consumed_at)))
        / NULLIF(COUNT(vca.id) - 1, 0)
      )
    ELSE NULL
  END                                         AS media_intervalo_segundos
FROM public.vw_meal_consumptions_all vca
JOIN public.meal_windows mw ON mw.id = vca.meal_window_id
JOIN public.meal_types   mt ON mt.id = mw.meal_type_id
LEFT JOIN public.event_stages es ON es.id = mw.event_stage_id
LEFT JOIN public.profiles    prof ON prof.id = vca.registered_by
GROUP BY
  prof.full_name, vca.registered_by,
  mw.service_date, es.name, es.id,
  mw.label, mt.name, mw.id,
  mw.event_id, mw.event_stage_id;

GRANT SELECT ON public.vw_consumo_por_operador TO authenticated;

-- ============================================================
-- VIEW 5: vw_erros_sync
-- (meal_consumptions_unlinked não tem is_offline/duplicidade_detectada
-- reais — sempre entram como false em vw_meal_consumptions_all — então
-- nenhuma linha unlinked passa a aparecer aqui hoje; o reaponte só
-- garante que a view não fica presa a uma definição de "consumo"
-- diferente das demais caso esses campos venham a existir para
-- consumos avulsos no futuro.)
-- ============================================================
CREATE OR REPLACE VIEW public.vw_erros_sync
WITH (security_invoker = true)
AS
SELECT
  vca.id,
  vca.created_at,
  vca.consumed_at,
  COALESCE(p_person.full_name, 'Consumo avulso: ' || vca.qr_code)
                                               AS participante_nome,
  vca.participant_id,
  es.name                                     AS etapa_nome,
  es.id                                       AS etapa_id,
  COALESCE(mw.label, mt.name)                 AS janela_nome,
  mw.service_date                             AS janela_data,
  CASE
    WHEN vca.duplicidade_detectada THEN 'duplicidade'
    WHEN vca.is_offline            THEN 'queue'
    ELSE 'realtime'
  END                                         AS sync_status,
  vca.is_offline,
  vca.sync_at,
  CASE
    WHEN vca.is_offline AND vca.sync_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (vca.sync_at - vca.created_at))::int
    ELSE NULL
  END                                         AS sync_delay_segundos,
  vca.duplicidade_detectada,
  vca.device_info,
  vca.method,
  vca.notes,
  COALESCE(prof.full_name, vca.registered_by::text, 'Sem operador')
                                               AS registrado_por_nome,
  vca.registered_by                           AS registrado_por_id,
  mw.event_id,
  mw.event_stage_id
FROM public.vw_meal_consumptions_all vca
JOIN public.meal_windows       mw     ON mw.id     = vca.meal_window_id
JOIN public.meal_types         mt     ON mt.id     = mw.meal_type_id
LEFT JOIN public.participants  part   ON part.id   = vca.participant_id
LEFT JOIN public.people        p_person ON p_person.id = part.person_id
LEFT JOIN public.event_stages  es     ON es.id     = mw.event_stage_id
LEFT JOIN public.profiles      prof   ON prof.id   = vca.registered_by
WHERE vca.is_offline = true
   OR vca.duplicidade_detectada = true;

GRANT SELECT ON public.vw_erros_sync TO authenticated;

-- ============================================================
-- VIEW 6: vw_consumo_por_etapa
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
  COUNT(vca.id)                               AS total_refeicoes,
  COUNT(DISTINCT vca.participant_id)          AS total_participantes_distintos,
  CASE
    WHEN COUNT(DISTINCT mw.service_date) > 0
      THEN ROUND(COUNT(vca.id)::numeric / COUNT(DISTINCT mw.service_date), 1)
    ELSE 0
  END                                         AS media_por_dia,
  COUNT(vca.id) FILTER (WHERE vca.duplicidade_detectada = true)
                                               AS total_erros,
  COUNT(vca.id) FILTER (WHERE vca.is_offline = true)
                                               AS total_queue,
  COUNT(vca.id) FILTER (WHERE vca.is_offline = false OR vca.is_offline IS NULL)
                                               AS total_realtime,
  CASE
    WHEN COUNT(vca.id) > 0
      THEN ROUND(
        (COUNT(vca.id) FILTER (WHERE vca.duplicidade_detectada = true))::numeric
        / COUNT(vca.id) * 100,
        2
      )
    ELSE 0
  END                                         AS taxa_erro_percent
FROM public.event_stages es
LEFT JOIN public.meal_windows mw
       ON mw.event_stage_id = es.id
LEFT JOIN public.vw_meal_consumptions_all vca
       ON vca.meal_window_id = mw.id
GROUP BY es.name, es.id, es.starts_at, es.ends_at, es.event_id;

GRANT SELECT ON public.vw_consumo_por_etapa TO authenticated;
