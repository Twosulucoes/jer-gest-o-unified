# Auditoria do Módulo de Arbitragem — JER Gestão

> **Reauditoria:** 2026-05-03
> **Status real:** ⚠️ **REABERTO** — divergência entre auditoria anterior e código em produção, gaps de segurança no PWA e órfãos relevantes.
> **Veredito honesto:** A auditoria de 2026-04-28 declarou o módulo "FECHADO", mas a verificação de hoje encontrou (a) uma página administrativa rica fora de roteamento, (b) uma rota PWA sem guarda de papel sobre tabela com PII, (c) divergência entre rotas declaradas no doc e rotas reais, (d) tabela `referee_profiles` sem migração formal e (e) inconsistências de escopo (Lei de Escopo) no schema `arbitragem`. Não há bloqueante de operação imediato, mas há risco de exposição de dados bancários e confusão de navegação.

---

## 0. Inventário Real Hoje (Web + PWA)

### 0.1 Rotas existentes em `src/routes/AppRoutes.tsx`

| Rota | Componente | Guard / Roles | Observação |
| :--- | :--- | :--- | :--- |
| `/admin/arbitragem` | `ArbitrosPage` | admin, secretaria, coordenacao_tecnica | Renderiza apenas `<ArbitrosTab />` (lista enxuta de árbitros + convite + import CSV). |
| `/admin/arbitragem/config` | `RefereeRemunerationConfigPage` | admin (única role com escrita) | Configura `remuneration_type` por etapa × modalidade. |
| `/admin/arbitragem/relatorios` | `RefereeReportingPage` | admin, secretaria | Apuração de diárias/partidas a partir da view `vw_fulfilled_referee_assignments`. |
| `/pwa/arbitragem/perfil` | `RefereeProfilePage` | **NENHUM** (sem `PwaRouteGuard`) | ⚠️ Edita `referee_profiles` (CPF, banco, conta) com upsert por `user_id`. |

### 0.2 Páginas no repositório, não roteadas (órfãs)

| Arquivo | Ricura funcional | Status |
| :--- | :--- | :--- |
| `src/pages/admin/ArbitragemEquipePage.tsx` (800+ linhas) | KPIs (oficiais, designações, partidas, modalidades), filtros (etapa/modalidade/função/busca), 4 abas (Árbitros, Por oficial, Por modalidade, Escala em lote), exportação CSV/PDF, integração com `EscalaLoteDialog` | **ÓRFÃ.** `systemMap.ts` declara rota `/admin/competicao/arbitragem`, mas essa rota não existe em `AppRoutes.tsx`. |

A rota `/admin/arbitragem` ativa hoje é a página enxuta `ArbitrosPage`, e não a rica `ArbitragemEquipePage`. A auditoria anterior descreveu funcionalidades que existem na página órfã.

### 0.3 Componentes auxiliares

`src/components/admin/arbitragem/` — `ArbitrosImportDialog`, `ArbitrosTab`, `EscalaLoteDialog`, `ExportColumnsDialog`, `RefereeProfileDialog`, `escalaExport.ts` (CSV/PDF da escala). Bem estruturados; o `RefereeProfileDialog` (admin) e o `RefereeProfilePage` (PWA) escrevem na mesma tabela `referee_profiles` mas por caminhos distintos.

### 0.4 PWA

- Não há `RefereeHomePage` em `src/pages/pwa/arbitragem/`. A entrada do menu (em `PwaLayout.tsx`) é "Ao Vivo" → `/pwa/resultados` + "Meu Perfil" → `/pwa/arbitragem/perfil`.
- A "Minha Agenda" mencionada na auditoria anterior é, na verdade, a página de Resultados (`ResultadosPartidasPage`) filtrando por `auth.uid()`. Não existe tela dedicada de "agenda do árbitro" hoje.
- Não há fallback `arbitragem/*` no PWA (existe para `delegacao/*`, `alimentacao/*` etc.). URLs erradas caem no `PwaNotFoundHandler`.

---

## 1. Mapa de Dados Real

| Objeto | Escopo | event_id | event_stage_id | RLS | Notas |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `referee_profiles` | Pessoa (master, por `user_id`) | — | — | **Sem migração formal** | Tabela só presente em `types.ts`; CPF/banco/conta sem política versionada. |
| `match_user_assignments` | Operação | NOT NULL | — (via `competition_matches`) | OK (admin/secretaria/coord_tec/coord_modalidade + UPDATE próprio do oficial) | **Lei de Escopo:** falta coluna direta `event_stage_id` (apenas inferida via JOIN). |
| `public.match_officials` | — | **NÃO TEM** | NÃO TEM | admin/secretaria/coord_tec | Resíduo histórico; redundante com `arbitragem.match_officials`. |
| `arbitragem.match_officials` | Operação | NOT NULL | NÃO TEM | OK + `arbitragem` SELECT | Falta `event_stage_id`. |
| `arbitragem.officials` | Inscrição? Operação? | NOT NULL | NÃO TEM | OK | Conceito ambíguo; coexiste com `referee_profiles`. |
| `arbitragem.results` | Operação | NOT NULL | NÃO TEM | OK | Falta `event_stage_id`. |
| `referee_remuneration_configs` | Operação | — | NOT NULL | **Inconsistente** — usa `user_roles` direto, não `has_role()` | Padrão divergente do resto do sistema. |
| `vw_fulfilled_referee_assignments` | View consolidada | YES | YES | herda das tabelas-base | OK. |
| `referee_indisponibilidades` | — | — | — | — | **Não existe.** Indisponibilidade vive em `match_user_assignments.acceptance_status` + `indisponibility_reason`. |

---

## 2. Gaps Identificados

### 🔴 Críticos / Risco de Dados

1. **PWA `/pwa/arbitragem/perfil` sem `PwaRouteGuard`.** Qualquer usuário autenticado consegue acessar a tela e tentar ler/escrever `referee_profiles`. A defesa em profundidade está ausente; o único anteparo é a RLS — que não consta de migração rastreável (gap #2).
2. **`referee_profiles` sem migração formal.** A tabela existe (e `RefereeProfileDialog` + PWA escrevem nela) mas não há `CREATE TABLE` versionado em `supabase/migrations/`. Significa que: (a) RLS não é auditável via repositório; (b) ambientes novos podem divergir; (c) PII (CPF, banco) corre sem garantia de policy explícita.

### 🟡 Importantes (Operacional / UX)

3. **Página rica `ArbitragemEquipePage` órfã.** A rota `/admin/competicao/arbitragem` declarada no `systemMap.ts` não existe; `/admin/arbitragem` aponta para uma página simplificada. Funcionalidades de escala em lote, exportação CSV/PDF e visões agregadas por oficial/modalidade estão escondidas.
4. **Links internos quebrados em `ArbitragemEquipePage`.** Os botões "Remuneração" e "Apuração" usam paths relativos (`remuneracao` e `apuracao`) que não correspondem às rotas reais (`config` e `relatorios`).
5. **Documentação divergente.** O documento anterior mencionava `/admin/arbitragem/apuracao` e `/admin/arbitragem/remuneracao`; a realidade é `/admin/arbitragem/relatorios` e `/admin/arbitragem/config`. Quem chega via doc não encontra a tela.
6. **`systemMap.ts` desincronizado.** Entrada `arbitragem-equipe` aponta para rota inexistente.
7. **Sem "home" PWA do árbitro.** Não há landing dedicada com agenda + perfil + indisponibilidades; a navegação despeja o usuário em `/pwa/resultados`.

### 🟢 Melhorias / Lei de Escopo

8. **`match_user_assignments` sem `event_stage_id` direto.** Toda query agrega via JOIN com `competition_matches`. Adicionar coluna denormalizada (com trigger) reduziria custo de filtros e alinharia ao quadrante "Operação".
9. **`arbitragem.results`, `arbitragem.officials`, `arbitragem.match_officials` sem `event_stage_id`.** Mesma observação.
10. **Dual `match_officials` (public vs arbitragem).** A pública é resíduo histórico — confirmar se ainda é lida em algum lugar e remover.
11. **`referee_remuneration_configs` usa `user_roles` no policy em vez de `has_role()`.** Padronizar.
12. **`<>` em React (`RefereeReportingPage.tsx:269`).** Linha `{consolidated.map((ref) => (<>...</>))}` pode emitir warning de `key` em fragmento. Trocar por `<Fragment key={ref.userId}>`.

---

## 3. Plano de Evolução (Etapas)

### Etapa 0 — Quick wins de segurança e consistência (esta PR)

- [x] **Reescrever este documento** com diagnóstico realista.
- [x] **Adicionar `PwaRouteGuard` em `/pwa/arbitragem/perfil`** (`allowedRoles=["arbitragem","admin","secretaria"]`). Defesa em profundidade até a Etapa 2.
- [x] **Sincronizar `systemMap.ts`** — apontar `arbitragem-equipe` para a realidade (sem rota até a Etapa 1) ou marcar como ÓRFÃ explicitamente.

### Etapa 1 — Resgate da página rica e correção de navegação

- [ ] Decidir destino de `ArbitragemEquipePage`:
  - **Opção A (recomendada):** rotear em `/admin/arbitragem/escala` (sub-rota); manter `/admin/arbitragem` como Base (`ArbitrosTab`); adicionar links cruzados.
  - **Opção B:** substituir a página atual de `/admin/arbitragem` pela versão rica e mover a aba "Árbitros" para dentro dela (já existe lá, na verdade).
- [ ] Corrigir links internos da página rica para `/admin/arbitragem/config` e `/admin/arbitragem/relatorios`.
- [ ] Atualizar `systemMap.ts` e `docs/modulos/arbitros-auditoria.md` com a rota final.

### Etapa 2 — Migração formal de `referee_profiles` + RLS

- [ ] Escrever `CREATE TABLE` retroativo em `supabase/migrations/` (idempotente: `CREATE TABLE IF NOT EXISTS ...; ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).
- [ ] Definir RLS:
  - Próprio árbitro: SELECT/UPDATE da própria linha (`user_id = auth.uid()`).
  - Admin / secretaria: total.
  - `coordenacao_tecnica`: SELECT (para escalar).
  - Bloquear DELETE para não-admin.
- [ ] Confirmar que o PWA `RefereeProfilePage` continua funcional (não cria linhas em nome de outro `user_id`).

### Etapa 3 — Lei de Escopo no schema `arbitragem` e em `match_user_assignments`

- [ ] Adicionar `event_stage_id` (NOT NULL com backfill) em:
  - `match_user_assignments`
  - `arbitragem.results`
  - `arbitragem.officials`
  - `arbitragem.match_officials`
- [ ] Trigger para manter `event_stage_id` consistente com `competition_matches.event_stage_id` quando `match_id` for atualizado.
- [ ] Padronizar policies de `referee_remuneration_configs` para usar `has_role()`.
- [ ] Remover `public.match_officials` se confirmado sem leitores (grep + vista de logs).

### Etapa 4 — PWA do árbitro (UX completa)

- [ ] Criar `ArbitragemHomePage` em `src/pages/pwa/arbitragem/` (KPI da agenda do dia + atalhos).
- [ ] Criar `ArbitragemAgendaPage` (próximas designações com confirmar/recusar).
- [ ] Criar `ArbitragemIndisponibilidadePage` (recusa com justificativa, lista histórica).
- [ ] Adicionar fallback `arbitragem/*` em `AppRoutes.tsx`.
- [ ] Reapontar `PwaLayout` para a nova home.

### Etapa 5 — Melhorias opcionais (pós-evento)

- Súmula digital (PDF da partida com oficiais + eventos).
- Push notification ao designar.
- Projeção de custo por escala futura (pré-evento).

---

## 4. Critérios de "Pronto" por Etapa

| Etapa | Pronto quando |
| :--- | :--- |
| 0 | PR mergeada com guard adicionado, doc novo, systemMap honesto. |
| 1 | Página rica acessível por URL própria, links internos funcionam, nenhuma rota órfã. |
| 2 | `supabase/migrations/` tem o `CREATE TABLE referee_profiles` + policies; CI passa; testes manuais de PWA funcionam. |
| 3 | Coluna `event_stage_id` em todas as 4 tabelas, com NOT NULL e trigger; queries continuam funcionando. |
| 4 | PWA do árbitro tem home + agenda + indisponibilidade dedicadas, com guard. |

---

## 5. Permissões por Perfil (estado-alvo)

| Recurso | admin | secretaria | coord_tecnica | coord_modalidade | arbitragem |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `/admin/arbitragem` (base) | CRUD | CRUD | CRU- | — | — |
| `/admin/arbitragem/escala` (rica) | CRUD | CRUD | CRU- | R-- (própria modalidade) | — |
| `/admin/arbitragem/config` | CRUD | R-- | R-- | R-- | — |
| `/admin/arbitragem/relatorios` | CRUD | R-- | R-- | — | — |
| `/pwa/arbitragem/*` | R-- (debug) | R-- (debug) | — | — | CRUD próprio |
| `referee_profiles` (PII) | CRUD | CRUD | R-- | — | CRU- próprio |

---

## 6. Riscos Conhecidos (não mitigados nesta PR)

- **`referee_profiles` em produção sem migração rastreável** — se RLS for permissiva ou ausente, qualquer usuário autenticado pode ler PII de árbitros. Etapa 2 trata disso.
- **Confusão de UX** — admin que clica em "Equipe de Arbitragem" no `systemMap` recebe 404 ou cai na página enxuta sem KPIs. Etapa 1 trata.
- **Lei de Escopo** — relatórios cross-stage podem retornar dados de etapas erradas se filtros falharem; hoje a defesa está só na UI. Etapa 3 endurece.

---

## Histórico de Auditorias

### Auditoria de Reabertura (2026-05-03)
Diagnóstico completo acima. Conclui que o módulo **não estava efetivamente fechado** em 2026-04-28: existem órfãos, divergência doc × código e gap de segurança no PWA. Plano em 5 Etapas.

### Auditoria Anterior (2026-04-28) — declaração obsoleta
Declarou o módulo "FECHADO PARA OPERAÇÃO". Várias afirmações não correspondem ao estado real do repositório (rotas inexistentes, página rica órfã, "Minha Agenda" inexistente como tela própria). Mantido como referência histórica; superado por esta reauditoria.
