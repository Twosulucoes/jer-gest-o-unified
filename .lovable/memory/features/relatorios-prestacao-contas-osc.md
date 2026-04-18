---
name: Prestação de Contas OSC
description: Página /admin/relatorios/osc — relatório consolidado para Governo RR/IDJUV/Acolher com KPIs, modalidades, delegações e exportação PDF/XLSX
type: feature
---
Etapa 5 (final) do módulo Relatórios. Página `/admin/relatorios/osc` (admin/secretaria).

**Hook**: `useOscData(eventId)` em `src/pages/admin/relatorios/useOscData.ts` agrega:
- Participantes/atletas/credenciados (via `participants` + `participant_credentials`)
- Refeições (via `meal_windows` → `meal_consumptions`, sem `event_id` direto)
- Alojamento (`lodging_occupancies` + `lodging_units`, coluna correta é `unit_id`)
- Transporte (`transport_trips` + count de `transport_passengers`)
- Modalidades + partidas + publicadas (`sport_events` → `competition_matches` → `competition_match_results` publicado)
- Medalhas por delegação via cadeia entry → team/participant_sport_event → delegation
- Doação de alimentos = `event_participation_rules.food_donation_kg` × nº delegações

**PDF** (`oscPdfExporter.tsx`): 4 páginas — KPIs+Medalhas, Modalidades, Delegações (landscape), Declaração+Assinatura.
**XLSX** (`oscXlsxExporter.ts`): 3 abas — Resumo, Modalidades, Delegações.
Nomes: `Prestacao_Contas_{evento}_{ISO}.{pdf,xlsx}`.

Registry: `prestacao-contas-osc` em `src/reports/definitions/prestacao.contas.osc.ts`.
