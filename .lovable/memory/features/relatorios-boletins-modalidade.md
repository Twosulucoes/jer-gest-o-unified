---
name: Boletins por Modalidade (Etapa 2 Relatórios)
description: Página /admin/relatorios/boletins com filtros (modalidade/categoria/gênero/fase), 5 layouts por família (score/sets/combat/time/mark), exportação PDF e XLSX. Substituiu o módulo antigo /admin/boletins (redirect).
type: feature
---
**Página**: `/admin/relatorios/boletins` (admin, secretaria, coordenacao_tecnica).

**Família detectada via** `sport_event_rules.rules.family`:
- `score` → BulletinScore (classificação P/J/V/E/D/GP/GC/SG + partidas)
- `sets` → BulletinSets (SP/SC/PP/PC + sets detalhados extraídos de combat_detail ou score textual)
- `combat` → BulletinCombat (rodadas eliminatórias + pódio por position)
- `time`/`mark` → BulletinTimeMark (ranking ordenado por time_ms asc / distance_cm desc)

**Pontos defensivos**:
- `getGroupPoints()` lê `group_points` ou `group_stage_points`, fallback se vier no formato `{ordem, criterio}` (evita React #31).
- Categoria `gender_scope` filtra gênero (sport_events não tem coluna gender).
- Tabelas inexistentes (competition_match_events, lineups, player_stats) são opcionais; ausência não quebra.

**Exportadores**: `bulletinPdfExporter.tsx` (@react-pdf/renderer com branding) e `bulletinXlsxExporter.ts` (exceljs com abas Capa/Classificação/Partidas/Ranking).

**Removido**: `src/pages/admin/BoletinsPage.tsx` e `src/components/admin/BulletinPdfGenerator.tsx`. Rota `/admin/boletins` agora redireciona.
