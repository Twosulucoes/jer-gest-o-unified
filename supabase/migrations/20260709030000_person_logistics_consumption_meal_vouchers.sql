-- ============================================================
-- 3ª rodada da auditoria de KPIs de alimentação — corrige
-- vw_person_logistics_consumption (usada pelo relatório "Consumo
-- Consolidado por Pessoa", src/reports/definitions/pessoa.consumoConsolidado.ts):
--
-- 1) meals_consumed contava só public.meal_consumptions — refeições
--    resgatadas via voucher nominal (service_voucher_uses.service_kind
--    = 'meals', voucher vinculado ao participant_id da pessoa) nunca
--    entravam na coluna "Refeições", mesmo a pessoa tendo comido de
--    fato.
-- 2) voucher_uses_total somava sv.current_uses (contador bruto do
--    voucher, sem distinguir serviço) e nunca entrava em
--    total_consumption, apesar da descrição do relatório prometer
--    "soma de embarques, refeições, diárias e usos de voucher".
--
-- Troca a soma de current_uses por COUNT(*) sobre
-- service_voucher_uses (fonte mais precisa — conta eventos de uso
-- reais, não um contador agregado) e expõe meal_voucher_uses em
-- separado, para o client (customLoader) somar em "Refeições" sem
-- contar duas vezes em total_consumption.
-- ============================================================

CREATE OR REPLACE VIEW public.vw_person_logistics_consumption
WITH (security_invoker = true) AS
SELECT
  p.id                                AS person_id,
  p.full_name,
  p.cpf,
  pa.id                               AS participant_id,
  pa.event_id,
  pa.delegation_id,
  i.name                              AS delegation_name,
  pa.participant_type,
  pa.needs_transport,
  pa.needs_meals,
  pa.needs_lodging,
  COALESCE((
    SELECT COUNT(*) FROM public.transport_passengers tp
    WHERE tp.participant_id = pa.id AND tp.boarded_at IS NOT NULL
  ), 0)                               AS transport_boardings,
  COALESCE((
    SELECT COUNT(*) FROM public.meal_consumptions mc
    WHERE mc.participant_id = pa.id
  ), 0)                               AS meals_consumed,
  COALESCE((
    SELECT COUNT(*) FROM public.lodging_occupancies lo
    WHERE lo.participant_id = pa.id
  ), 0)                               AS lodging_nights,
  COALESCE((
    SELECT COUNT(*)
    FROM public.service_voucher_uses svu
    JOIN public.service_vouchers sv ON sv.id = svu.voucher_id
    WHERE sv.participant_id = pa.id
      AND svu.service_kind = 'meals'
  ), 0)                               AS meal_voucher_uses,
  COALESCE((
    SELECT COUNT(*)
    FROM public.service_voucher_uses svu
    JOIN public.service_vouchers sv ON sv.id = svu.voucher_id
    WHERE sv.participant_id = pa.id
  ), 0)                               AS voucher_uses_total
FROM public.people p
JOIN  public.participants  pa ON pa.person_id    = p.id
LEFT JOIN public.delegations   d  ON d.id            = pa.delegation_id
LEFT JOIN public.institutions  i  ON i.id            = d.institution_id;

GRANT SELECT ON public.vw_person_logistics_consumption TO authenticated;
