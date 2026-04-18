---
name: Registry de Relatórios e Presets Persistentes
description: src/reports/core/registry.ts agrupa definições reais (boletins/dashboard/quadro) + samples; ReportPresetsButton persiste filtros via report_presets
type: feature
---
**Registry**: `src/reports/core/registry.ts` lista 5 definições — `boletins-modalidade`, `dashboard-operacional`, `quadro-medalhas` (âncoras para presets, sem datasource real), `results-by-group` e `delegation-roster` (samples da engine genérica).

**Definições-âncora** em `src/reports/definitions/`: `boletins.modalidade.ts`, `dashboard.operacional.ts`, `quadro.medalhas.ts`. Servem só para identificar o `report_id` e declarar quais filtros são persistíveis em presets — o cálculo real continua nas páginas dedicadas.

**Presets persistentes**: tabela `public.report_presets` (já existe). Componente compacto `src/components/relatorios/ReportPresetsButton.tsx` (Popover) usado nos headers de:
- `/admin/relatorios/boletins` → filtros sportId/categoryId/gender/phaseId
- `/admin/relatorios/dashboard` → sem filtros configuráveis (botão presente para consistência)
- `/admin/relatorios/quadro-medalhas` → filtros scope/type/sportId

Cada usuário vê apenas os próprios presets (RLS). Filtro extra `event_id.eq.X OR event_id.is.null` permite presets globais ou por evento.
