---
name: Quadro de Medalhas e Classificação Geral
description: Página /admin/relatorios/quadro-medalhas com critério olímpico, pontuação Art. 108/111, filtros JER/JERPA, exportação PDF/XLSX
type: feature
---
Etapa 4 do módulo Relatórios. Página `/admin/relatorios/quadro-medalhas` (admin/secretaria/coordenacao_tecnica).

**Hook**: `useMedalTableData(eventId, filters)` em `src/pages/admin/relatorios/useMedalTableData.ts`.
- Cadeia: result → entry → (team.delegation_id | participant_sport_event → participant.delegation_id) → delegations.school_name.
- Só considera `result_status='publicado'` com `position` 1-3 (medalhas) ou 1-8 (pontos).
- Famílias coletivas: `score`, `sets` (de `sport_event_rules.rules.family`).
- JERPA detectado por regex em nome da modalidade/categoria: `paralímpic|paralimpic|\bpara\b|jerpa|parabadminton`.

**Pontuação Art. 108**: 1º=10, 2º=8, 3º=6, 4º=5, 5º=4, 6º=3, 7º=2, 8º=1.
- Coletivas: posição da equipe no torneio → pontos diretos.
- Individuais: medal-table interno por modalidade (critério olímpico) → posição resultante → pontos.

**Desempate Art. 111**: total → ouros → pratas → bronzes → pts coletivas.
**Critério olímpico**: ouros → pratas → bronzes (empate total mantém mesma posição).

**Banner parcial**: aparece quando há SE com partidas `completed/finished` mas sem `result_status='publicado'`.

**Exports**: 
- `medalTablePdfExporter.tsx` (@react-pdf/renderer) — selo OFICIAL/PARCIAL.
- `medalTableXlsxExporter.ts` (exceljs).
- Nomes: `Quadro_Medalhas_{escopo}_{ISO}.{pdf,xlsx}` e `Classificacao_Geral_{escopo}_{ISO}.{pdf,xlsx}`.
