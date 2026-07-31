# Auditoria do Módulo de Competição — JER Gestão

**Data:** 2026-05-04
**Escopo:** Inventário completo do módulo de competição (~15k linhas, 14 rotas, 21 páginas, 28 componentes, 4 sub-pastas), schema, RPCs, RLS e fluxo operacional do organizador. Conduzida em paralelo a 3 Explore agents (rotas/componentes, schema/RLS/RPCs, fluxo).

**Veredito:** 🟡 **PARCIALMENTE FUNCIONAL COM REDUNDÂNCIAS GRAVES E SOURCE-OF-TRUTH AMBÍGUO**. Infraestrutura técnica robusta (RLS, RPCs, drag-and-drop), mas:

- 🔴 Source-of-truth de "resultado" duplicado entre `competition_match_results`, `match_scores` e `arbitragem.results`.
- 🔴 3 páginas de lançamento (`Score/Sets/Combat`) existem mas **nunca são usadas** — sistema usa `LaunchResultDialog`.
- 🔴 Sem progressão automática de bracket — vencedor não avança sozinho.
- 🔴 Inscrição de atletas vive **fora** do módulo: organizador é forçado a sair do fluxo central.
- 🟡 Geração de partidas 100% manual; sem templates (round-robin, eliminatória).

---

## 1. Inventário Real

### 1.1 Rotas (14 admin + 6 painéis)

| Rota | Componente | ACL | Função |
| :--- | :--- | :--- | :--- |
| `/etapa/:stageId/competicao/partidas-agenda` | `CompeticaoPartidasAgendaPage` | admin/secretaria/coord_tec | Agenda + filtros |
| `/etapa/:stageId/competicao/resultados` | `CompeticaoResultadosPage` | + coord_modalidade | Status de resultados |
| `/etapa/:stageId/competicao/painel` | `CompeticaoPainelPage` | + coord_modalidade | Dashboard KPI por modalidade |
| `/etapa/:stageId/competicao/equipes` | `CompeticaoEquipesPage` | admin/secretaria/coord_tec | Equipes/inscritos |
| `/etapa/:stageId/competicao/central` | `CompeticaoCentralPage` | + coord_modalidade | **Hub wizard 7-passos** |
| `/etapa/:stageId/competicao/fases` | `CompeticaoFasesPage` | admin/secretaria/coord_tec | CRUD fases |
| `/etapa/:stageId/competicao/grupos` | `CompeticaoGruposPage` | admin/secretaria/coord_tec | CRUD grupos + standings |
| `/etapa/:stageId/competicao/pre-validacao` | `CompeticaoPreValidacaoPage` | admin/secretaria/coord_tec | Checklist |
| `/etapa/:stageId/competicao/partida/:matchId` | `CompeticaoPartidaDetalhePage` (1279 linhas) | + mesario | Detalhe partida |
| `/etapa/:stageId/competicao/substituicoes` | `SubstituicoesPage` | + mesario | Substituições |
| `/admin/competicao/painel-score/:sportEventId/confronto/:matchId/resultado` | `CompeticaoLancamentoScorePage` (1150 linhas) | + mesario | **NUNCA USADA** (LaunchResultDialog faz o serviço) |
| `/admin/competicao/painel-sets/:sportEventId/confronto/:matchId/resultado` | `CompeticaoLancamentoSetsPage` (774 linhas) | + mesario | **NUNCA USADA** |
| `/admin/competicao/painel-combat/:sportEventId/confronto/:matchId/resultado` | `CompeticaoLancamentoCombatPage` (709 linhas) | + mesario | **NUNCA USADA** |
| `/admin/competicao/painel-time-mark/:sportEventId` | `CompeticaoPainelTimeMarkPage` | admin/secretaria/coord_tec | Painel especializado |

### 1.2 Componentes (28 arquivos / ~9.500 linhas)

Wizards: `WizardStepper`, `IndividualHeatBuilderTab`, `DisputeBuilderTab`, `BracketView`, `WinnerProgressionPanel`.
Tabs Central: `CentralParticipantsTab`, `CentralMatchesTab`, `CentralResultsTab`, `CentralAgendaTab`, `CentralArbitragemTab`, `CentralEnrolledTab`.
Inputs: `MatchScoreFormDrawer`, `MatchCombatFormDrawer`, `MatchResultInlineCard`, `LaunchResultDialog`, `RequestSubstitutionDialog`.
Governança: `ResultGovernancePanel`, `DisputePublishControl`, `HomologarClassificadoCard`, `AutoBulletinDialog`.
Outros: `RulesForm`/`RulesJsonEditor`/`RulesPresetPicker`, `SeedingPanel`, `SportEventPicker`, `GroupStandingsTable`, `ProvaReadinessChecklist`, `CompetitionSummaryCards`.

### 1.3 Tabelas-chave

| Tabela | event_id | event_stage_id | Triggers? |
| :--- | :---: | :---: | :--- |
| `competition_matches` | NOT NULL | NULLABLE | só `updated_at` |
| `competition_match_entries` | — | — | só `updated_at` |
| `competition_match_results` | — | **AUSENTE** | só `updated_at` |
| `competition_groups` | NOT NULL | — | só `updated_at` |
| `match_scores` | — | **AUSENTE** | só `updated_at` |
| `match_user_assignments` | NOT NULL | NULLABLE (Etapa 3.1 Arbitragem) | só `updated_at` |
| `arbitragem.results` | NOT NULL | NULLABLE (Etapa 3.2 Arbitragem) | só `updated_at` |
| `arbitragem.result_files` | NOT NULL | — | — |

### 1.4 RPCs

| RPC | Função | Crítica? |
| :--- | :--- | :---: |
| `rpc_launch_match_result` | Lança resultado (tabela `competition_match_results`) | ✅ Core |
| `rpc_homologate_match_result` | Marca como `resultado_validado` | ✅ State machine |
| `rpc_publish_match_result` | Publica oficialmente | ✅ Public release |
| `rpc_extract_match_outcome` | Lê outcome (prioriza `match_scores` → fallback `competition_match_results`) | 🔴 Source-of-truth |
| `rpc_sync_match_scores_to_results` | Sync MANUAL entre as duas tabelas | 🔴 Sem trigger automático |
| `rpc_generate_matches_knockout` | Gera partidas KO de uma fase | ✅ |
| `rpc_get_knockout_bracket` | Lê bracket | ✅ |
| `rpc_revert_match_result_status` | Admin reverte estado | Util |

---

## 2. Achados ranqueados

### 🔴 **Crítico 1 — Source-of-truth ambíguo entre 3 tabelas**

- `competition_match_results.outcome` E `match_scores.outcome` armazenam o mesmo conceito.
- `rpc_extract_match_outcome` prioriza `match_scores` e tem fallback. Boletins (`useBulletinData`, `useMedalTable`) leem `competition_match_results`.
- `arbitragem.results` é uma **terceira via** que nunca sincroniza com nenhum dos dois — fica orfã.
- **Risco:** árbitro publica em `arbitragem.results` e ninguém vê; reportes da coordenação podem divergir.

### 🔴 **Crítico 2 — 3 páginas de lançamento orfãs**

- `CompeticaoLancamentoScorePage` (1150 linhas), `CompeticaoLancamentoSetsPage` (774), `CompeticaoLancamentoCombatPage` (709) — total **~2.600 linhas** que **nunca são chamadas**.
- O sistema usa `LaunchResultDialog` (modal pequeno) para tudo.
- **Risco:** confusão de manutenção; ~2.6k linhas de código morto que ainda são alvo de PRs/refactors esporádicos.

### 🔴 **Crítico 3 — Sem progressão automática de bracket**

- `rpc_generate_matches_knockout` cria as partidas das rodadas, mas quando uma vira `status='finished'`, nada propaga o vencedor para a partida da próxima rodada.
- `WinnerProgressionPanel` é manual: organizador arrasta vencedores um por um.
- **Risco:** em torneios com muitas rodadas, a coordenação tem trabalho repetitivo e sujeito a erro humano.

### 🔴 **Crítico 4 — Inscrição de atletas fora do módulo**

- `CompeticaoCentralPage` mostra inscritos via `CentralParticipantsTab`, mas **não permite criar inscrição**. Lê `participant_sport_events` ou `teams` que devem ter sido populados em outro fluxo.
- **Risco:** organizador novo trava — o wizard começa do passo 2 e ele não sabe como chegou no passo 1.

### 🔴 **Crítico 5 — RLS sem `WITH CHECK` em `FOR ALL`**

- `competition_match_results`, `competition_matches`, `competition_match_entries`, `competition_groups`, `match_scores`: todas têm policies `FOR ALL` apenas com `USING`, sem `WITH CHECK`.
- **Risco:** usuário com role correto pode INSERT/UPDATE com dados que violem o conceito (ex.: gravar resultado em partida de outro evento).

### 🟡 **Importantes**

6. **"Painel" tem 5 significados** — `CompeticaoPainelPage` (KPI), `painel-score/-sets/-combat` (lançamento), `painel-time-mark/-ranking` (dashboard especializado). Confunde navegação.
7. **`competition_match_results` e `match_scores` sem `event_stage_id`** — relatórios cross-stage podem retornar dado errado em eventos multi-etapa.
8. **Geração de partidas 100% manual** — sem templates (round-robin, eliminatória, swiss). Para 50+ partidas é inviável.
9. **Dois fluxos paralelos de publicação** — `DisputePublishControl` (publica disputas/grupos) vs `ResultGovernancePanel` (publica resultados). Sem ordem clara de dependência.
10. **`CentralEnrolledTab` vs `CentralParticipantsTab`** — duplicação aparente; precisa desambiguar.
11. **`DisputeBuilderTab` vs `IndividualHeatBuilderTab`** — em qual caso usar qual? Não há label/dica clara na UI.
12. **`rpc_sync_match_scores_to_results` é manual** — sem trigger automático após INSERT em `match_scores`.

### 🟢 **OK**

- `WizardStepper` é componentizado e visual.
- `RulesForm + RulesJsonEditor + RulesPresetPicker` são abstratos e reutilizáveis.
- ACL canônica via `COMPETITION_ROLES`.
- RLS habilitada em todas as tabelas competition_* e match_*.
- RPCs usam `has_role()` + `app_role`.
- `LancamentoSimplificadoDialog` (PR #61) já entrega um caminho operacional bypass que funciona mesmo se o resto trava.

---

## 3. 5 maiores pontos de fricção operacional (do agent C)

1. **Fluxo de inscrição quebrado** — organizador presume que atletas já estão inscritos. Bloqueia início do wizard.
2. **Geração de partidas 100% manual** — sem automação de round-robin / eliminatória / swiss.
3. **3 páginas de lançamento código-morto** — geram dúvida ("qual rota é a correta?").
4. **2 fluxos paralelos de publicação** — `DisputePublishControl` vs `ResultGovernancePanel` sem dependência clara.
5. **Sem validação visual de progresso** — wizard deixa avançar mesmo sem precondições atendidas.

---

## 4. Plano de evolução proposto

> Fatiado em fases pequenas. Cada uma é uma PR draft separada. Você decide quais executar.

### **Fase 1 — Quick win operacional** ✅ JÁ ENTREGUE
PR #61: `LancamentoSimplificadoDialog`. Operador grava placar, súmula PDF, fotos, presença de árbitros e relatório em uma só tela, **bypass** do wizard formal. Funciona em qualquer partida.

### **Fase 2 — Limpeza de código morto** 🟡 Pequeno, risco baixo
- Remover `CompeticaoLancamentoScorePage`, `LancamentoSetsPage`, `LancamentoCombatPage` (3 arquivos, ~2.600 linhas).
- Remover rotas `painel-score/-sets/-combat`.
- Remover `CentralEnrolledTab` (mantendo `CentralParticipantsTab`).
- Adicionar redirects para `LaunchResultDialog`.
- **Ganho:** -2.600 linhas, -3 rotas, sistema mais navegável.

### **Fase 3 — Source-of-truth única** 🔴 Médio, risco médio
- Decidir: `competition_match_results` é a tabela canônica. `match_scores` vira detalhe técnico (nunca lido como outcome).
- Trigger AFTER INSERT/UPDATE em `match_scores` que sincroniza `competition_match_results`.
- Aposentar `rpc_sync_match_scores_to_results` (vira interno do trigger).
- `arbitragem.results` continua só para evidências/auditoria — nunca como source-of-truth.
- Adicionar `event_stage_id` em `competition_match_results` e `match_scores` (denormalização + trigger sync, similar ao que fizemos em alojamento Etapa 3).

### **Fase 4 — Lei de Escopo + RLS canônica** 🟡 Médio, risco médio
- Adicionar `WITH CHECK` em todas policies `FOR ALL` (evita corromper dados de outro evento mesmo com role correto).
- Padronizar `has_role()` em qualquer policy ainda usando `EXISTS (SELECT FROM user_roles)`.

### **Fase 5 — Fluxo de inscrição integrado** 🔴 Grande
- Adicionar passo "Inscrições" no `WizardStepper` (Tab 0 antes de Participantes).
- Form de inscrever atleta diretamente no Central.
- Validação antes de avançar para Builder.
- Resolve a fricção #1 (raiz da experiência do organizador novo).

### **Fase 6 — Geração automática de partidas** 🔴 Grande
- Templates: round-robin (todos contra todos), eliminatória simples, dupla, swiss.
- RPC `rpc_generate_matches_template(p_phase_id, p_template, p_seeding_mode)`.
- UI no `DisputeBuilderTab`: dropdown "Tipo de disputa" + botão "Gerar partidas automaticamente".
- Resolve a fricção #2 — 50+ partidas em 1 clique.

### **Fase 7 — Progressão automática de bracket** 🟡 Médio
- Trigger AFTER UPDATE de `competition_matches.status` quando vira `finished`: identifica vencedor e popula entry da próxima rodada.
- Funciona junto da Fase 6 para fluxo KO completo.

### **Fase 8 — Unificação de fluxo de publicação** 🟡 Pequeno
- Decidir ordem: validar resultado → publicar disputa.
- Renomear `DisputePublishControl` → "Publicação de Fase" e `ResultGovernancePanel` → "Homologação de Resultados".
- Wizard mostra dependência: não publica disputa antes de todos resultados validados.

### **Fase 9 — Validação visual de precondições** 🟡 Pequeno
- `WizardStepper` valida cada aba antes de habilitar a próxima.
- "Inscrições" não conclui sem ≥2 inscritos por modalidade.
- "Builder" não conclui sem partidas geradas.
- "Resultado" não conclui sem todos resultados lançados.
- "Publicação" não conclui sem boletim oficial criado.

---

## 5. Recomendação de ordem

Conforme o tipo de uso que vai dar ao sistema:

- **Operação imediata (evento próximo):** Fase 1 ✅ já feita. Use o `LancamentoSimplificadoDialog` no PR #61. Você lança qualquer partida em segundos.
- **Limpeza barata depois do evento:** Fase 2 (remover código morto) + Fase 4 (apertar RLS). Ambas são pequenas, baixo risco.
- **Sistema "funcionar de verdade":** Fases 3 → 5 → 6 → 7 → 8 → 9 nessa ordem. Tempo total estimado: ~15-25h ao longo de 6-9 PRs.

---

## Histórico

- **2026-05-04** — Auditoria inicial, com 3 Explore agents (rotas/componentes, schema/RLS/RPCs, fluxo). PR #61 entrega Fase 1.
