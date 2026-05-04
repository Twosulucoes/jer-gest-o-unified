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
8. **Importação CSV joga 17 das 20 colunas no lixo.** A planilha real tem `Nome, CPF, Modalidades, Categorias, Celular, RG, Email, RNE, Sexo, Data Nascimento, CEP, Endereço, Complemento, Bairro, Cidade, UF, Banco, Agência, Conta Corrente, Nacionalidade`, mas o parser atual em `ArbitrosImportDialog.tsx` só lê Nome/Email/Telefone. CPF, RNE, modalidades, categorias, endereço e dados bancários são silenciosamente descartados. Doc anterior afirmava "idempotência por CPF" — falso, idempotência real é por e-mail.
9. **Importação não cria `people`.** Árbitro convidado fica fora do quadrante "Pessoas Unificadas" do modelo canônico; mesmo CPF pode existir como atleta em `people` e como árbitro só em `referee_profiles`/`profiles`, sem vínculo.

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

> **Decisão (2026-05-04):** escolhida **Opção B** ao examinar `ArbitragemEquipePage` — ela já contém `<ArbitrosTab />` como uma das 4 abas internas (default `arbitros`). Substituir a rota direto evita URL fragmentada e elimina o órfão sem perder funcionalidade.

- [x] `/admin/arbitragem` agora renderiza `ArbitragemEquipePage` (rich page com 4 abas: Árbitros, Por oficial, Por modalidade, Escala em lote + KPIs + exportação CSV/PDF).
- [x] Links internos da página rica corrigidos: `to="remuneracao"` → `to="/admin/arbitragem/config"`; `to="apuracao"` → `to="/admin/arbitragem/relatorios"`.
- [x] `ArbitrosPage.tsx` deletada (conteúdo é a aba `arbitros` da página rica — sem perda).
- [x] `systemMap.ts` consolidado: entradas `arbitragem-base` e `arbitragem-equipe (ÓRFÃ)` viraram uma única entrada `arbitragem-equipe` apontando para a rota real, sem gaps.
- [x] ACL preservada: `admin`, `secretaria`, `coordenacao_tecnica` (mesma do `/admin/arbitragem` antigo). Expansão para `coordenador_modalidade` deixada para futuro, porque a aba "Árbitros" tem invite/import sem gating de role no componente.

### Etapa 2 — Importação canônica + migração formal de `referee_profiles`

> **Decisões registradas (2026-05-03):**
> 1. Importação **cria/vincula `people`** (alinha ao quadrante Pessoas do `dominio-canonico.md`).
> 2. **CPF não é obrigatório**: árbitro estrangeiro pode entrar só com RNE. Constraint: `CHECK (cpf IS NOT NULL OR rne IS NOT NULL)`.
> 3. Quando o CPF já existe em `people`, **reaproveita** a mesma `people.id` (pessoa pode ser árbitro hoje e ter sido atleta antes).
> 4. **Edge function nova** (`import-referees`), separada de `admin-users`.
> 5. Quando o e-mail já está em outro `user_id`, **adiciona** a role `arbitragem` (comportamento atual).
> 6. Dados bancários do CSV **importam direto**, mas com auditoria reforçada (log por linha que tem banco preenchido).

#### Etapa 2.1 — Migração formal de `referee_profiles` + RLS *(pré-requisito)*

- [x] `supabase/migrations/20260504020000_arbitragem_2_1_referee_profiles_formalize.sql`:
  - `CREATE TABLE IF NOT EXISTS referee_profiles (...)` retroativo (todas as 26 colunas).
  - `ADD COLUMN person_id UUID REFERENCES people(id)` (nullable; populado pela 2.3).
  - `UNIQUE(cpf) WHERE cpf IS NOT NULL`, `UNIQUE(user_id) WHERE user_id IS NOT NULL`.
  - FK `user_id → auth.users(id) ON DELETE SET NULL`.
  - Trigger `update_updated_at_column`.
  - `ENABLE ROW LEVEL SECURITY`.
- [x] Policies com `has_role()`:
  - `arbitragem`: SELECT/UPDATE/INSERT da própria linha (`user_id = auth.uid()`); INSERT necessário porque o PWA usa `upsert`.
  - `admin`/`secretaria`: ALL.
  - `coordenacao_tecnica` e `coordenador_modalidade`: SELECT (precisam para escalar).
  - DELETE: implicitamente só admin/secretaria (sem policy adicional para outros).
- [x] Smoke test: PWA `RefereeProfilePage` continua funcional (INSERT do upsert tem WITH CHECK + UPDATE tem USING/WITH CHECK; ambos válidos com `user_id = auth.uid()`).
- [ ] **Adiado para Etapa 2.3:** `CHECK (cpf IS NOT NULL OR rne IS NOT NULL)`. Adicionar agora quebraria o primeiro Save no PWA (que permite salvar só com `full_name` hoje). A 2.3 ajusta importer + PWA para garantir o invariante e só então o constraint entra.

#### Etapa 2.2 — Parser CSV completo (front)

- [x] Módulo puro `src/components/admin/arbitragem/refereeImport.ts` (lógica isolada de React, reutilizável pela edge function da 2.3).
- [x] Reconhece **20 colunas** com aliases (case-insensitive, sem acento):
  Nome, CPF, Modalidades, Categorias, Celular, RG, Email, RNE, Sexo, Data Nascimento, CEP, Endereço, Complemento, Bairro, Cidade, UF, Banco, Agência, Conta Corrente, Nacionalidade.
- [x] Normalizadores:
  - CPF/CEP/Telefone: só dígitos.
  - `isValidCpf`: 11 dígitos + dígitos verificadores; vazio é OK se houver RNE.
  - Data: aceita `dd/mm/aaaa`, `dd-mm-aaaa`, `aaaa-mm-dd` → ISO.
  - Modalidades/Categorias: split por `;` ou `,` interno; canonicaliza com `"; "`.
  - UF: `upper()`; validador acusa se ≠ 2 letras.
  - Sexo: aceita M/F/Masculino/Feminino/Outro → canonicaliza para M/F/O.
- [x] Validação por linha **antes** do envio: nome ausente, e-mail inválido, CPF inválido, falta CPF e RNE, UF inválida, CEP fora de 8 dígitos, data inválida.
- [x] UI: tabela de preview com ícone de status, erros inline, expand de linha mostrando todos os 20 campos parseados; banco aparece como `(preenchido)` para não vazar valor; KPIs (válidas/com erro/convidados/duplicados/falharam).
- [x] Disclosure no topo do dialog: "Esta versão envia apenas Nome, E-mail e Telefone; demais campos são validados aqui e integrados na 2.3".
- [x] `safeRowSummary()` exportada para logging seguro (nunca inclui valores bancários).
- [x] Botão "Importar X válidas" pula automaticamente linhas com `validationErrors.length > 0`.

#### Etapa 2.3 — Edge function `import-referees` (backend)

- [x] Nova função `supabase/functions/import-referees/index.ts`.
- [x] Auth: caller deve ser `admin`, `secretaria` ou `super_admin`. JWT validado via `auth.getUser(token)` + `user_roles`.
- [x] Recebe payload `{ rows: ImportRow[] }`, processa linha a linha (sequencial):
  1. Validações inline: e-mail presente, nome ≥ 2 chars, CPF ou RNE obrigatório, CPF válido (algoritmo dos dígitos verificadores).
  2. Match em `people` por **CPF** (lookup direto). Se existir: atualiza apenas campos não-nulos (não sobrescreve). Se não: cria novo (exige `birth_date` por ser NOT NULL no people).
     - **Limitação assumida:** árbitro estrangeiro (sem CPF, só RNE) **não** é vinculado a `people` — `person_id` fica NULL. Etapa futura adiciona coluna `rne` em `people` para fechar esse caso.
  3. `auth.admin.inviteUserByEmail` (envia link `/pwa/set-password`); se já existe, recupera via `listUsers()` paginado.
  4. Upsert em `profiles` (id, full_name, active=true).
  5. Upsert em `user_roles` (user_id, role='arbitragem').
  6. Upsert em `referee_profiles` com **todos os 20 campos** + `person_id`.
  7. `audit_events` por linha (`action='referee_imported'`) + audit agregado no fim (`action='referee_import_batch'`); ambos com flag `had_bank_data: bool` mas **sem despejar valores**.
- [x] Resposta: `{ ok, summary: {total, created, linked_existing, duplicate, error, with_bank_data}, results: [{index, email, status, reason?, user_id?, person_id?, had_bank_data}] }`.
- [x] Limites de segurança: 1000 linhas por chamada; CORS canônico do projeto.
- [x] **Migração** `20260504003050_arbitragem_2_3_referee_check_cpf_or_rne.sql` ativa o `CHECK (cpf IS NOT NULL OR rne IS NOT NULL)` (`NOT VALID` + tentativa de `VALIDATE` com fallback gracioso se houver linhas legadas).
- [x] **Front (`ArbitrosImportDialog`):** chama `import-referees` em vez de `admin-users.invite_user`; envia payload com 20 campos; mapeia resultados de volta para a tabela; status diferenciados (created/linked_existing/duplicate/error).
- [x] **PWA (`RefereeProfilePage`):** valida `CPF || RNE` antes do Save (alinhado ao CHECK); novo campo `RNE (estrangeiros)` com placeholder.

#### Etapa 2.4 — UX de erro e re-importação

- [x] Coluna de motivo por linha falhada já visível inline (validação client-side ou erro do backend).
- [x] Botão **"Baixar CSV de erros"** — exporta linhas com `validationErrors`, `status='error'` ou `status='duplicate'` no mesmo formato da planilha-fonte (20 colunas) + coluna `Motivo`. Separador `;` (Excel BR) e BOM UTF-8 para abrir corretamente em Excel.
- [x] Botão **"Tentar novamente N falha(s)"** — re-envia somente as linhas com `status='error'` (não re-tenta `duplicate`, que é estado intencional).
- [x] Refatoração: extraída `importRowsMatching(predicate, contextLabel)` que serve tanto para a importação inicial quanto para o retry, mantendo o mapeamento `originalIndex` → linha na tabela.
- [x] KPIs no header já mostram: válidas / com erro / convidados / duplicados / falharam (somam direto do estado, sem recontagem manual).

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

- [x] `src/pages/pwa/arbitragem/ArbitragemHomePage.tsx` — landing do árbitro com KPIs (Designações/Confirmadas/Pendentes), banner de cadastro incompleto (sem `referee_profiles`) e CPF/RNE pendente, lista das próximas 5 partidas e grid de atalhos (Agenda, Indisponibilidades, Perfil, Ao Vivo).
- [x] `ArbitragemAgendaPage` — todas as designações em 3 abas (Próximas / Passadas / Indisp.); cada partida pendente tem botão **Confirmar** (`acceptance_status='confirmed'` + `reported_at`) e botão **Indisp.** que abre dialog com `Textarea` (mín. 4 chars, máx. 500) e grava `acceptance_status='unavailable'` + `indisponibility_reason`.
- [x] `ArbitragemIndisponibilidadePage` — histórico das partidas reportadas como indisponíveis no evento, com motivo e data do report.
- [x] `AppRoutes.tsx`: rotas `/pwa/arbitragem`, `/pwa/arbitragem/agenda`, `/pwa/arbitragem/indisponibilidade` (+ a já existente `/perfil`) com `PwaRouteGuard` para `arbitragem`/`admin`/`secretaria`. Fallback `arbitragem/*` adicionado para URLs erradas caírem na home (mesmo padrão de `delegacao/*`, `alimentacao/*`, `alojamento/*`).
- [x] `PwaLayout`: `moduleConfig.arbitragem` adicionado (`homeTo: /pwa/arbitragem`, primaryAction = "Agenda"); switcher trocou "Meu Perfil" por "Arbitragem" como entrada principal (perfil continua acessível pelos atalhos da home).
- [x] `constants/modules.ts`: `arbitragem` registrado como `ModuleId` para que `getModuleByPath` identifique corretamente todas as sub-rotas.

### Etapa 5 — Melhorias opcionais (pós-evento)

- Súmula digital (PDF da partida com oficiais + eventos).
- Push notification ao designar.
- Projeção de custo por escala futura (pré-evento).

---

## 4. Critérios de "Pronto" por Etapa

| Etapa | Pronto quando |
| :--- | :--- |
| 0 | PR mergeada com guard adicionado, doc novo, systemMap honesto. |
| 1 | Página rica acessível em `/admin/arbitragem`, links internos funcionam, nenhuma rota órfã. ✅ |
| 2.1 | `supabase/migrations/` tem o `CREATE TABLE referee_profiles` + policies + FK `person_id`; CI passa; PWA continua funcional. CHECK `cpf OR rne` fica para 2.3. |
| 2.2 | Parser do CSV reconhece 20 colunas; pré-visualização mostra erros por linha; bancário não vaza no console. |
| 2.3 | Edge `import-referees` cria/vincula `people` por CPF, popula `referee_profiles` completo, ativa o CHECK `cpf OR rne`, PWA valida antes do Save. Foreigners RNE-only ficam com `person_id=null` até Etapa futura adicionar `rne` em `people`. |
| 2.4 | Tela mostra erros por linha, exporta CSV de erros (mesmo schema da planilha + Motivo), suporta re-importar só falhas. ✅ |
| 3 | Coluna `event_stage_id` em todas as 4 tabelas, com NOT NULL e trigger; queries continuam funcionando. |
| 4 | PWA do árbitro tem home + agenda + indisponibilidade dedicadas, com guard. ✅ |

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
