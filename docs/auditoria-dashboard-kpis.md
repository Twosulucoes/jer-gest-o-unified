# Auditoria de Dashboards e KPIs — JER Gestão

**Data:** 2026-05-04
**Escopo:** Todos os KPIs do sistema (admin web + PWA), validando se as queries refletem o schema atual após as normalizações Fase A1, Fase G (substitutions), auditoria de Alojamento (Etapas 0–8) e auditoria de Arbitragem (Etapas 0–4). Verifica também coerência entre **rótulos** e **dados realmente computados**.

**Veredito global:** 🟡 **OPERACIONAL COM 2 KPIs QUEBRADOS E 7 MULTI-STAGE LEAKS**.

---

## 1. Achados consolidados (do mais grave ao menor)

### 🔴 1. `useDashboardData.ts` — "Árbitros designados" sempre **zero**

- **Arquivo:** `src/pages/admin/relatorios/useDashboardData.ts:451-456`
- **KPI:** "Árbitros" → `referees_assigned`
- **Causa:** query referencia `referee_event_assignments`, **tabela inexistente** (deve ser resíduo de planejamento). Hoje há um comentário no código `// NOTA:` retornando hardcoded `0`.
- **Solução:** trocar para `match_user_assignments` agregando `count(distinct user_id) where event_id = ? and role in ('arbitro_principal','arbitro_auxiliar','mesario','fiscal','anotador')`. Aliás, depois da Etapa 3 da Arbitragem dá pra usar `event_stage_id` direto.
- **Severidade:** 🔴 KPI sempre exibe 0 → painel mente para a coordenação.

### 🔴 2. `AlojamentoHomePage` (PWA) — "Reservados" sempre **zero** (RPC com enum errado)

- **Arquivo:** `src/pages/pwa/alojamento/AlojamentoHomePage.tsx:54-60`
- **RPC:** `get_alojamento_kpis(p_facility_id)`
- **Causa:** o RPC conta `status = 'planned'` para "reservados", mas no fluxo operacional o status comum para alocação pré-check-in é `'allocated'` (definido pelo CHECK em Etapa 3 do Alojamento: `planned, allocated, checked_in, checked_out, cancelled`).
- **Solução:** ajustar o RPC para contar `'allocated'` no campo "reservados" (ou usar a soma `'planned' + 'allocated'` se a coordenação usa os dois para casos diferentes).
- **Severidade:** 🔴 Operador no campo vê "0 reservados" mesmo com agendamentos.

### 🟡 3. `useStageDashboardData.ts` — "Árbitros" rotulado como **designações** mas mede **indisponibilidades**

- **Arquivo:** `src/pages/admin/useStageDashboardData.ts:128-138`
- **KPI:** rotulado "Árbitros designados / não tratados"
- **Causa:** query chama `rpc("get_unhandled_referee_indisponibilidades", { p_etapa_id })` — ou seja, mede recusas pendentes de tratamento, NÃO designações.
- **Solução:** ou (a) renomear o card para "Indisponibilidades não tratadas"; ou (b) adicionar segundo card real de "designações" via `match_user_assignments` distinct user_id.
- **Severidade:** 🟡 Label engana (mostra número certo, conceito errado).

### 🟡 4. `useDashboardData.ts` — "Inscrições por modalidade" trunca silenciosamente em **top 10**

- **Arquivo:** `src/pages/admin/relatorios/useDashboardData.ts:664-666`
- **KPI:** "Modalidades (Inscrições)"
- **Causa:** `by_modality.slice(0, 10)` hardcoded.
- **Solução:** ou retornar todas com gráfico scrollable, ou exibir contador "11 modalidades não exibidas".
- **Severidade:** 🟡 Dados ocultos; acessibilidade ruim para eventos com 20+ modalidades.

### 🟡 5. `useDashboardData.ts` — "Credenciados" via fallback ad-hoc

- **Arquivo:** `src/pages/admin/relatorios/useDashboardData.ts:474-485`
- **KPI:** "Credenciados"
- **Causa:** soma `distinct participant_id` de `participant_credentials.status='active'` MAIS um fallback para `participants.credentialed_at`. Lógica dupla esconde possíveis dessincronizações entre as duas fontes.
- **Solução:** decidir source-of-truth (deve ser `participant_credentials.status='active'`); migrar `credentialed_at` para coluna derivada ou view.
- **Severidade:** 🟡 KPI provavelmente certo, código frágil.

### 🟡 6. `ArbitragemHomePage` (PWA) — KPIs sem `event_stage_id` direto

- **Arquivo:** `src/pages/pwa/arbitragem/ArbitragemHomePage.tsx:74-114`
- **KPIs:** Designações / Confirmadas / Pendentes
- **Causa:** filtra `match_user_assignments.event_id` mas a Etapa 3 da Arbitragem adicionou `event_stage_id` direto + trigger de sync. KPIs no PWA do árbitro contam designações de TODOS os stages do evento — diferente do contexto operacional ("minha agenda nesta etapa").
- **Solução:** adicionar `.eq("event_stage_id", activeStageId)` quando o stage estiver setado no contexto.
- **Severidade:** 🟡 Multi-stage leak; em eventos multi-etapa o número fica inflado.

### 🟡 7. `TransporteHomePage` (PWA) — KPIs sem `event_stage_id`

- **Arquivo:** `src/pages/pwa/transporte/TransporteHomePage.tsx:48-57`
- **KPIs:** Embarques hoje / Viagens / Pendentes
- **Causa:** queries em `transport_trips` filtram por `event_id` apenas.
- **Solução:** adicionar filtro de stage quando contexto de etapa existir.
- **Severidade:** 🟡 Multi-stage leak.

### 🟡 8. `DelegacaoHomePage` (PWA) — KPIs sem `event_stage_id`

- **Arquivo:** `src/pages/pwa/delegacao/DelegacaoHomePage.tsx:67-72`
- **KPIs:** Atletas / Credenciados / Pendentes
- **Causa:** filtra `participants` por `delegation_id` + (implícito) `event_id`. Sem `event_stage_id`.
- **Solução:** adicionar filtro de stage quando contexto existir. Considerar se "atletas da delegação" deve ser por evento (cadastrais) ou por stage (operacional). Provavelmente cadastral (evento) — então documentar e relaxar a exigência.
- **Severidade:** 🟡 Conceitualmente ambíguo: precisa decidir o significado.

### 🟡 9. `AlimentacaoHomePage` (PWA) — KPIs com filtro de stage **condicional**

- **Arquivo:** `src/pages/pwa/alimentacao/AlimentacaoHomePage.tsx:54-68`
- **KPIs:** Refeições hoje / Janelas ativas / Janelas hoje
- **Causa:** o `if (stageId)` aplica o filtro só se houver stage; sem stage, conta o evento todo. UI do operador deveria bloquear até selecionar stage.
- **Solução:** ou bloquear hard se não houver stage, ou marcar visualmente que está em "modo evento" para ele entender o número grande.
- **Severidade:** 🟡 Multi-stage leak silencioso.

### 🟡 10. `AlojamentoHomePage` (PWA) — RPC `get_alojamento_kpis` não recebe stage

- **Arquivo:** `src/pages/pwa/alojamento/AlojamentoHomePage.tsx:71-76`
- **Causa:** RPC só recebe `p_facility_id`, mas `lodging_units.event_stage_id` agora é denormalizado (Etapa 3). Mesma facility pode ter quartos em múltiplos stages se reusada entre eventos.
- **Solução:** evoluir RPC para aceitar `p_event_stage_id` e filtrar.
- **Severidade:** 🟡 Multi-stage leak (geralmente baixo impacto porque facility raramente é cross-stage).

### 🟡 11. `CoordenacaoHomePage` (PWA) — variável confusa + labels redundantes

- **Arquivo:** `src/pages/pwa/coordenacao/CoordenacaoHomePage.tsx:48-95`
- **Causa:**
  - `pendentesRes.count` é atribuído a card "Finalizadas" — variável mal-nomeada (pega `status='finished'`, mas o nome `pendentesRes` engana o leitor).
  - Funções `statusLabel()`/`statusTone()` (linhas 72-85) convertem enums em PT-BR (`em_andamento`, `finalizada`) que **não existem** no banco. Código defensivo morto.
- **Solução:** renomear variável e remover branches mortos.
- **Severidade:** 🟡 KPI exibe número correto; código confuso.

---

## 2. Não-achados (validados como OK)

| Arquivo | Status | Nota |
|---|---|---|
| `AlojamentoHubPage` (admin) | ✅ | Pós Etapa 6: usa `useLodgingOccupancy(stageId)`. KPIs corretos. |
| `AlojamentoUnidadesPage` (admin) | ✅ | Idem. |
| `useStageDashboardData.ts` (alojamento) | ✅ | `IN ['allocated','checked_in']` correto pós-Etapa 3. |
| `AlimentacaoDashboardPage` / Hub (admin) | ✅ | Filtra por `event_stage_id` corretamente. |
| `PesquisaHomePage` (PWA) | ✅ | Usa RPC `pesquisa_pwa_get_home()`. |
| `ResultadosHomePage` (PWA) | ✅ | Hook `useLancamentoResultados()` abstrai. |
| `AoVivoHomePage` | ✅ | Filtra por `event_id` por design (ao vivo não é stage-scoped). |
| `DashboardProgressCard` | ✅ | Componente puro de apresentação. |
| `ArbitragemHomePage`: banner cadastro CPF/RNE | ✅ | Pós-Etapa 2.3 da Arbitragem. |

---

## 3. Plano de evolução proposto

> Sliced em 3 PRs por tamanho/risco. Prefiro arrumar em ordem de severidade.

### **Fase 1 — Corrigir KPIs quebrados (🔴)** ✅
- [x] (1) `useDashboardData.ts:447-465` — query "Árbitros designados" agora usa `match_user_assignments` filtrando por `event_id` e contando `distinct user_id`. Antes era hardcoded `0` porque a tabela `referee_event_assignments` referenciada nunca existiu.
- [x] (2) **Migração `20260504093919_dashboard_fix_alojamento_kpis_status.sql`** — `get_alojamento_kpis` agora conta `status IN ('planned', 'allocated')` em `reserved_beds`. Antes só somava `'planned'`, mas o fluxo operacional grava `'allocated'`. Cobre os dois casos para resistir a alocações em lote pré-evento (que podem usar `'planned'`).
- [x] (3) **Falso positivo descartado** — `useStageDashboardData.ts:128-138` retorna o array como `refereeIndisponibilities` e o consumidor `StageHomePage.tsx:77` já exibe label honesto: "*N* oficial(is) que reportaram indisponibilidade para partidas desta etapa e ainda não foram substituídos". A inspeção mais profunda mostrou que o agente confundiu o nome interno da query com o label exibido. Sem ação necessária.

### **Fase 2 — Aplicar Lei de Escopo nos PWA homes (🟡 4-10)** — Médio, risco baixo
- ArbitragemHomePage: filtrar `match_user_assignments.event_stage_id` quando contexto.
- TransporteHomePage: idem `transport_trips.event_stage_id` (se denormalizado).
- DelegacaoHomePage: decidir conceito (cadastral vs operacional) e ajustar.
- AlimentacaoHomePage: bloquear sem `stageId` ou rotular.
- RPC `get_alojamento_kpis`: adicionar parâmetro `p_event_stage_id`.

### **Fase 3 — Melhorias e limpezas (🟡 11)** — Pequeno
- Renomear `pendentesRes` em CoordenacaoHomePage e remover branches mortos.
- Resolver source-of-truth de "credenciados" entre `participant_credentials.status` e `participants.credentialed_at`.
- "Inscrições por modalidade": remover top-10 hardcoded ou exibir contador.

---

## 4. Critérios de Pronto

- ✅ Diagnóstico documentado com 11 achados ranqueados.
- [ ] Aprovação do usuário sobre a ordem (recomendação: Fase 1 → 2 → 3).
- [ ] Cada Fase em PR draft separado.

---

## 5. Recomendação

**Começar pela Fase 1.** Os 2 KPIs em 🔴 ("Árbitros designados sempre 0" e "Reservados sempre 0") fazem o painel **mentir** para coordenação e operador de campo — risco alto de decisão errada baseada em dado falso. Depois Fase 2 (multi-stage leaks) — esses geram inflação de números mas não são "mentira", só "leitura ampliada". Fase 3 é polimento.
