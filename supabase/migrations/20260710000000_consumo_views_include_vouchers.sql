-- ============================================================
-- 3ª auditoria de alimentação — fecha a divergência "voucher"
-- entre as telas de relatório.
--
-- Contexto: a definição operacional de "consumo de refeição" tem
-- TRÊS fontes (mesma união usada na PWA e em
-- AlimentacaoRelatoriosPage.tsx / AlimentacaoListaConsumosPage.tsx):
--   1. meal_consumptions            (credencial vinculada)
--   2. meal_consumptions_unlinked   (QR avulso, não resolvido)
--   3. service_voucher_uses         (voucher de refeição resgatado
--      via QR — service_kind = 'meals'; ver comentário em
--      AlimentacaoListaConsumosPage.tsx:262 — "não caem em
--      meal_consumptions/meal_consumptions_unlinked").
--
-- A migration 20260709010000 unificou (1)+(2) em
-- vw_meal_consumptions_all, mas deixou (3) de fora. Resultado: a
-- tela "Relatório de Consumo" (useRelatorioConsumo → as 6 views) e o
-- Dashboard subcontavam "Total Refeições" / "Por Dia" / "Por Janela"
-- / "Por Etapa" em relação à tela "Relatórios" (que soma as três
-- fontes no client). Este é exatamente o mesmo tipo de gap que a
-- 20260709010000 já corrigiu para os avulsos — aqui estendemos o
-- mesmo padrão para os vouchers.
--
-- Escopo mínimo e aditivo: só recriamos a view base
-- vw_meal_consumptions_all com um 3º ramo UNION. As 6 views de
-- relatório já leem dela e não mudam. Nenhuma coluna é removida ou
-- renomeada.
--
-- Notas de mapeamento do ramo voucher:
--  * meal_window_id  ← svu.context_id (para service_kind='meals' o
--    context_id é a janela de refeição). Rows cujo context_id não
--    aponta para uma meal_window são descartadas naturalmente pelo
--    JOIN meal_windows das views downstream.
--  * participant_id  ← sv.participant_id (voucher nominal a um
--    participante resolve o nome via participants→people nas views;
--    voucher eventual/anônimo cai no fallback de qr_code abaixo).
--  * qr_code         ← nome do portador eventual OU label do voucher,
--    para o COALESCE de participante_nome das views downstream exibir
--    algo legível quando não há participant_id.
--  * is_offline / duplicidade_detectada / sync_at = false/null:
--    service_voucher_uses não tem esses campos (mesma decisão já
--    tomada para o ramo unlinked).
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
FROM public.meal_consumptions_unlinked mu

UNION ALL

SELECT
  svu.id,
  svu.used_at                                 AS created_at,
  svu.used_at                                 AS consumed_at,
  svu.context_id                              AS meal_window_id,
  sv.participant_id,
  svu.used_by                                 AS registered_by,
  'voucher'::text                             AS method,
  false                                       AS is_offline,
  false                                       AS duplicidade_detectada,
  NULL::timestamptz                           AS sync_at,
  NULL::jsonb                                 AS device_info,
  svu.notes,
  COALESCE(sep.full_name, sv.label, 'Voucher') AS qr_code,
  'voucher'::text                             AS source_type
FROM public.service_voucher_uses svu
JOIN public.service_vouchers sv ON sv.id = svu.voucher_id
LEFT JOIN public.service_eventual_people sep ON sep.id = sv.eventual_person_id
WHERE svu.service_kind = 'meals';

GRANT SELECT ON public.vw_meal_consumptions_all TO authenticated;
