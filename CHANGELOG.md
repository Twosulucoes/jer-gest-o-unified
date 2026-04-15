# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Added
- Centro de Regras do Evento: 4 páginas públicas em `/eventos/:eventSlug/` (regras, modalidades, qualificação, assistente-inscrição)
- Componentes compartilhados de badges regulatórios: `RuleStatusBadge`, `EligibilityBadge`, `SelectionMethodBadge`, `DisciplineTypeBadge`
- `SportEventRuleDrawer`: drawer lateral com resumo regulatório, campos estruturados e JSON bruto
- `RuleWarningCallout`: alertas visuais para confirmação manual, somente estadual, não elegível
- `RuleJsonAccordion`: accordion para auditoria de JSONs estruturados
- Hook `useEventRulesCenter`: consolidação de `sport_event_rules` + `sport_events` + `sports` + `categories`
- Tipo `RuleSportEventView`: view derivada com campos calculados (national_flow_status, institution_limit_summary, etc.)
- Utilitários em `rulesTransform.ts`: parseAllowedGenders, buildNationalFlowStatus, buildSelectionMethodLabel, etc.
- Filtros por tipo de disciplina, status nacional, busca textual e exportação CSV em todas as tabelas
- Mapa de Qualificação com agrupamento por modalidade/sede/prioridade e regras especiais expansíveis
- Assistente Operacional de Inscrição com painel de regras, restrições e elegibilidade nacional por modalidade
- Consolidação de ranking cross-heat para modalidades individuais (time/mark)
- `CrossHeatRankingCard`: ranking geral exibido na página da partida (bateria) com destaque da bateria atual
- `CrossHeatRankingTab`: tab de classificação no wizard (Passo 5) com filtros, busca e exportação CSV
- `useCrossHeatRanking` hook: busca batch de todas as baterias/resultados/tentativas com refresh automático a cada 30s
- `computeCrossHeatRanking` em individualRanking.ts: ranking consolidado com empates (posição compartilhada) e outcomes ordenados (DSQ > DNS > DNF > WO)
- Geração automática de baterias (heats) para modalidades individuais de família time e mark (Atletismo, Natação, etc.)
- Componente `CentralStructureHeatsTab` com wizard de 3 sub-etapas (Definir → Revisar → Confirmar)
- `useCollectiveStepStatus` agora suporta bloqueio de passos para individuais time/mark
- Documentação completa do projeto (README, /docs, CHANGELOG, CONTRIBUTING)

### Changed
- Labels de credenciamento padronizados ("Registrar presença", "Emitir credencial")

### Fixed
- Unificação de `credential_code` e `qr_code_value` em utilitário centralizado
- Confirmação modal em ações batch de credenciamento

### Security
- RLS habilitado em 100% das tabelas (41/41)
- 13 triggers de validação de integridade referencial

---

## Convenção de Registro

Ao registrar mudanças, use o módulo como prefixo:

```
### Added
- **[Credenciamento]** Link direto para página do participante na listagem
- **[Competição]** Página de agenda visual de partidas

### Fixed
- **[Alimentação]** Constraint de duplicidade em consumo por janela
```

### Categorias

| Seção | Quando usar |
|-------|------------|
| `Added` | Funcionalidade nova |
| `Changed` | Alteração em funcionalidade existente |
| `Deprecated` | Funcionalidade marcada para remoção |
| `Removed` | Funcionalidade removida |
| `Fixed` | Correção de bug |
| `Security` | Correção ou melhoria de segurança |
