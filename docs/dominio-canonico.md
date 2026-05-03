# Domínio Canônico — JER Gestão
**Versão:** 1.0 · 2026-05-03
**Status:** Constituição do projeto. Toda decisão de schema, código ou doc deve respeitar este documento ou alterá-lo explicitamente.

> Este documento define o vocabulário, os quadrantes e as leis de
> escopo (evento × etapa × pessoa) do JER Gestão. Substitui interpretações
> conflitantes encontradas em diagnósticos anteriores e fixa as
> convenções obrigatórias para evolução do schema e do código.

---

## 1. Os 4 quadrantes

```
┌─────────────────────────────┬──────────────────────────────────────┐
│ 1. PESSOAS                  │ 2. INSCRIÇÃO                         │
│ (sem evento)                │ (escopo: evento)                     │
│                             │                                      │
│ Quem é a pessoa?            │ Em qual evento ela está e como?      │
│ Quem é a escola?            │                                      │
│                             │                                      │
│ Atravessa edições do JER.   │ Vive durante uma edição do JER.      │
└─────────────────────────────┴──────────────────────────────────────┘
┌─────────────────────────────┬──────────────────────────────────────┐
│ 3. OPERAÇÃO (consumos)      │ 4. COMPETIÇÃO                        │
│ (escopo: ETAPA)             │ (estrutural: evento, executivo: ETAPA)│
│                             │                                      │
│ O que aconteceu em campo?   │ Quem joga, quem ganhou, em que fase? │
│ Refeições, hospedagem,      │                                      │
│ transporte, vouchers.       │                                      │
└─────────────────────────────┴──────────────────────────────────────┘
```

### Regra mental para classificar uma entidade nova

1. Posso responder a pergunta dela **sem citar um evento específico**? → **Quadrante 1**.
2. Eu cito o evento mas **uma única vez serve para tudo no evento**? → **Quadrante 2**.
3. A informação **muda fisicamente entre Caracaraí e Boa Vista**? → **Quadrante 3**.
4. É resultado esportivo ou estrutura de disputa? → **Quadrante 4**.

---

## 2. Lei de escopo (evento × etapa)

### Lei
> 1. Toda entidade do **Quadrante 1** vive sem `event_id` e sem `event_stage_id`.
> 2. Toda entidade do **Quadrante 2** tem `event_id NOT NULL` e usa **junções por etapa** (`participant_event_stages`, `participant_sport_events.event_stage_id`) quando precisa segregar por etapa.
> 3. Toda entidade do **Quadrante 3** tem `event_stage_id NOT NULL`.
> 4. Toda entidade do **Quadrante 4 estrutural** (sports/categories/sport_events/teams/team_members) tem `event_id NOT NULL`. Toda entidade do **Quadrante 4 executiva** (phases/groups/matches/entries/lineups/scores/results) tem `event_stage_id NOT NULL`.

### Por quê
- **Pessoas atravessam eventos.** Cadastro civil estável.
- **Inscrição é por evento.** "João está inscrito no JER 2026" — isso vale para todas as etapas. Substituições e mudanças entre etapas se modelam por **junções com etapa** ou por **mudança de elenco**, não por nova inscrição.
- **Operação é por etapa.** Caracaraí tem refeitório próprio, casas próprias, ônibus próprios, vouchers próprios. Boa Vista também. **Não há "consumo do evento" — só "consumo da etapa Caracaraí" ou "consumo da etapa Final".**
- **Competição estrutural é por evento.** A modalidade Futsal Sub-14 Masc é a mesma em todas as etapas. O time da Escola X é o mesmo conceito.
- **Competição executiva é por etapa.** A fase eliminatória pertence à etapa de classificação. A fase final pertence à etapa final. Cada partida acontece em uma etapa específica.

---

## 3. Quadrante 1 — Pessoas

### Entidades

#### `people`
**Pergunta:** "Quem é essa pessoa?"
**Escopo:** civil. Atravessa eventos.
**FK:** nenhuma para events/event_stages.

| Coluna | Tipo | Notas |
|:---|:---|:---|
| `id` | uuid | PK |
| `full_name`, `cpf`, `rg`, `birth_date`, `gender`, `email`, `phone`, `photo_url` | — | Cadastro civil. |
| `food_restrictions`, `disability_type`, `medical_notes` | — | Saúde/restrições civis. |
| `eja_flag`, `wheelchair_user_flag` | bool | Acessibilidade/educação (cadastral). |
| `national_ban_until` | timestamptz | Banimento federal vigente até esta data (cadastral; atravessa eventos). |
| `coach_name`, `coach_phone` | text | Técnico/professor responsável (cadastral). |
| `guardian_name`, `guardian_phone` | text | Responsável legal (cadastral). |
| `school_role_label` | text | Rótulo de papel escolar (cadastral). |
| `institution_id` | FK → institutions | Escola da pessoa (vínculo civil, agnóstico de evento). Nullable. |
| `is_active` | bool | Pessoa pode ser desativada no cadastro mestre (ex.: óbito, registro duplicado). |

**Não pertencem a `people`** (mesmo que historicamente estejam aqui ou em participants):
- `seed_tag`, `seed_batch_id` — pertencem a participants (Quadrante 2), são da inscrição.
- `school_role_label`, `enrollment_date` — pertencem a participants. São da participação naquele evento.

#### `institutions`
**Pergunta:** "Que escola é essa?"
**Escopo:** civil. Atravessa eventos.
**FK:** nenhuma.

| Coluna | Tipo | Notas |
|:---|:---|:---|
| `id`, `name`, `official_name`, `slug`, `network_type`, `city`, `state`, `district` | — | Identidade da escola. |
| `contact_*`, `is_active` | — | Operacional do cadastro mestre. |

**Decisão arquitetural:** `delegations` aponta para `institutions` por FK simples. Não há colunas duplicadas em `delegations` com prefixo `school_*` (a fusão "Fase 3" será revertida — ver §8).

---

## 4. Quadrante 2 — Inscrição

### Entidades

#### `events`
**Pergunta:** "Que edição do JER?"
**Escopo:** raiz do evento.

| Coluna | Tipo | Notas |
|:---|:---|:---|
| `id`, `name`, `slug`, `year`, `status`, `start_date`, `end_date` | — | Identidade da edição. |
| `is_public`, `public_agenda_published` | bool | Visibilidade externa. |

#### `event_stages`
**Pergunta:** "Qual etapa dessa edição?"
**Escopo:** sub-evento da edição. **A unidade física e operacional do JER.**
**FK:** event_id NOT NULL.

| Coluna | Tipo | Notas |
|:---|:---|:---|
| `kind` | text | `classificatoria`, `semifinal`, `final`, `legado`, `outro`. |
| `starts_at`, `ends_at`, `sort_order`, `status` | — | Calendário e estado. |

> **Etapa não é divisão de tempo arbitrária. É a sede física da operação.**
> Cada `event_stage` tem (ou deveria ter) suas próprias casas, refeitórios, frota,
> fases de competição e partidas.

#### `delegations`
**Pergunta:** "Quem representa a escola X no JER 2026?"
**Escopo:** evento.
**FK:** event_id, institution_id.

| Coluna | Tipo | Notas |
|:---|:---|:---|
| `(event_id, institution_id)` | UNIQUE | Uma delegação por escola por evento. |
| `status`, `chief_*`, `notes` | — | Estado da delegação no evento. |

**Não pertence a `delegations`:** colunas `school_*` espelhadas de `institutions` (a remover, ver §8).

#### `participants`
**Pergunta:** "Esta pessoa está inscrita neste evento, e como?"
**Escopo:** evento.
**FK:** person_id, event_id, delegation_id (nullable).

| Coluna | Tipo | Notas |
|:---|:---|:---|
| `(person_id, event_id)` | UNIQUE | Uma inscrição por pessoa por evento. |
| `participant_type` | enum (`participant_type`) | `athlete`, `coach`, `head_of_delegation`, `official`, `staff`, `motorista`, `agente_operacao`, `logistica`, `cozinheira`, `guia`, `secretaria`, `mesario`, `arbitro`, `delegado`, `fiscal`, `operador_pesquisa`, `tecnico_ti`, `terceiro`, `colaborador` (19 valores; enum desde Fase C). |
| `enrollment_class` | enum (`participant_category`) | `delegation` ou `organization`. **Renomeado** de `category` na Fase C para evitar conflito com a tabela `categories`. |
| `status` | enum (`lifecycle_status`) | `pending`, `confirmed`, `cancelled`, `rejected`. **A unificar** com outras tabelas. |
| `is_active` | bool | Vivo no evento. |
| `regular_attendance_confirmed` | bool | Confirmação administrativa. |
| `credentialed_at`, `credentialed_by` | — | Quando foi credenciado e por quem. |
| `left_event_at`, `left_event_reason`, `left_event_by` | — | Saída antecipada do evento (Etapa 2 da auditoria de Alimentação). |
| `needs_meals`, `needs_lodging`, `needs_transport` | bool | Declarações da inscrição. |
| `notes`, `logistics_notes`, `logistics_restrictions` | — | Notas operacionais por evento. |
| `seed_tag`, `seed_batch_id` | — | Rastreio de importação SIGECOM. |
| `organization_subtype`, `role_function`, `sector_area`, `responsibilities`, `access_permissions`, `observations` | — | Dados específicos de `enrollment_class='organization'`. |

**Não pertencem a `participants`**:
| Coluna a remover | Motivo | Status |
|:---|:---|:---:|
| `birth_date` | Já existe em `people.birth_date`. Cadastral. | ✅ removido (Fase A1) |
| `biological_sex` | Sinônimo de `people.gender`. Cadastral. | ✅ removido (Fase A1) |
| `disability_type` | Já existe em `people.disability_type`. Cadastral. | ✅ removido (Fase A1) |
| `eja_flag`, `wheelchair_user_flag`, `national_ban_until` | Cadastrais — migrados para `people`. | ✅ removido (Fase A2) |
| `coach_name`, `coach_phone`, `guardian_name`, `guardian_phone` | Vínculos civis — migrados para `people`. | ✅ removido (Fase A2) |
| `enrollment_date` | Redundante com `created_at`. | ✅ removido (Fase A2) |
| `school_role_label` | Cadastral escolar — migrado para `people`. | ✅ removido (Fase A2) |
| `active_status` | Redundante com `is_active` + `status`. | ✅ removido (Fase D) |

#### `participant_credentials`
**Pergunta:** "Qual credencial física essa pessoa tem nesse evento?"
**Escopo:** evento. (uma credencial física vale para todas as etapas).
**FK:** participant_id, event_id.

| Coluna | Tipo | Notas |
|:---|:---|:---|
| `external_*` | — | Vínculo com SIGECOM. |
| `credential_code`, `qr_code_value` | — | Identificadores para scan. |
| `binding_source`, `status` | enum | `import`/`manual`/`api_sync`; `pending`/`active`/`suspended`/`revoked`. |
| `issued_at`, `activated_at` | — | Ciclo de vida da credencial. |

#### `participant_event_stages`
**Pergunta:** "Esta pessoa está operando nesta etapa específica?"
**Escopo:** evento + etapa (junction).
**FK:** participant_id, event_stage_id, event_id.

| Coluna | Tipo | Notas |
|:---|:---|:---|
| `(participant_id, event_stage_id)` | UNIQUE | Uma linha por participação em etapa. |
| `status` | enum | `active`, `withdrawn`, `archived` (a definir). |

> **Esta é a tabela que materializa "João foi para a final".** A presença
> (ou ausência) de uma linha aqui é o que define se o participante "existe"
> na etapa para fins de alimentação, alojamento, transporte e divergências.

**Pendência (Fase F):** flag por etapa — se o participante esteve ativo em Caracaraí mas desistiu antes da Final, a linha de Caracaraí continua existindo (histórica) e a da Final vira `status='withdrawn'` ou simplesmente não existe.

#### `participant_sport_events`
**Pergunta:** "Esta pessoa está inscrita nesta prova nesta etapa?"
**Escopo:** evento + etapa (junction com a prova).
**FK:** participant_id, sport_event_id, `event_stage_id` (NOT NULL desde Fase F2).

| Coluna | Tipo | Notas |
|:---|:---|:---|
| `(participant_id, sport_event_id, event_stage_id)` | UNIQUE | Uma linha por inscrição esportiva por etapa. |
| `status` | enum | `pending`, `confirmed`, `cancelled`, `rejected`. |

> **Implementação cumprida (Fase F2):** `event_stage_id NOT NULL`,
> permitindo representar "João correu 100m em Caracaraí E na Final"
> com uma linha por etapa. UNIQUE redefinido para
> `(participant_id, sport_event_id, event_stage_id)` direto, sem
> COALESCE com zero-uuid.

---

## 5. Quadrante 3 — Operação (consumos)

> **Lei:** toda tabela aqui tem `event_stage_id NOT NULL` (direto ou herdado).
>
> **Por que:** cada etapa é uma operação física isolada — refeitórios diferentes em cidades diferentes, casas diferentes, frota diferente, vouchers válidos só para aquela etapa.

### Alimentação
| Tabela | Escopo | Comentário |
|:---|:---|:---|
| `meal_types` | **etapa** ✓ | Cardápio pode mudar entre etapas. `event_stage_id NOT NULL` desde a Fase F1. |
| `meal_locations` | **etapa** ✓ | Refeitórios físicos. `event_stage_id NOT NULL` desde a Fase F1. |
| `meal_windows` | **etapa** ✓ | Janela de serviço. Já no padrão correto. |
| `meal_window_eligibility` | herda de window | Regras de elegibilidade (perfil/delegação/instituição). |
| `meal_consumptions` | herda de window | Consumos efetivos. Único por (window, participant). |
| `meal_incidents` | herda de window | Tentativas recusadas com motivo. |
| `meal_forecast_exports` | **etapa** | Trilha de exportações XLSX/PDF para a cozinha. |

### Alojamento
| Tabela | Escopo | Comentário |
|:---|:---|:---|
| `lodging_locations` | **etapa** ✓ | Casas/colégios da etapa. |
| `lodging_units` | **etapa** ✓ (via location) | Quartos físicos. |
| `lodging_occupancies` | **etapa** ✓ | Hospedagem. **Mesmo participante pode ter ocupações distintas em etapas distintas.** |
| `lodging_audit_logs` | **etapa** (herda) | Trilha completa. |
| `lodging_incidents` | **etapa** ✓ | Incidentes operacionais. |
| `lodging_presence_logs` | **etapa** (herda) | Modo lua / presença noturna. |

### Transporte
| Tabela | Escopo | Comentário |
|:---|:---|:---|
| `transport_vehicles` | **etapa** ✓ | Frota da etapa. |
| `transport_routes` | **etapa** ✓ | Rotas físicas. |
| `transport_trips` | **etapa** ✓ | Viagens executadas. |
| `transport_passengers` | **etapa** (herda) | Embarque por viagem. |

### Vouchers
| Tabela | Escopo | Comentário |
|:---|:---|:---|
| `service_vouchers` | **etapa** ✓ | **Voucher é consumo da etapa** (canônico §11.5). `event_stage_id NOT NULL` desde a Fase F1. `replaces_voucher_id` permite versionamento (substituição/reemissão). |
| `service_voucher_uses` | herda do voucher | Trilha de uso. |
| `service_eventual_people` | evento | Cadastro do prestador é por evento (o mesmo prestador pode ter vouchers em duas etapas, com vouchers distintos). |

---

## 6. Quadrante 4 — Competição

> **Sub-divisão importante:**
> - **Estrutural** (sports/categories/sport_events/teams/team_members): `event_id`. Atravessa etapas.
> - **Executivo** (phases/groups/matches/entries/lineups/scores/results): **`event_stage_id NOT NULL`**. Cada partida acontece em uma etapa específica.

### Estrutural (event-scoped)
| Tabela | Escopo | Comentário |
|:---|:---|:---|
| `sports` | evento ✓ | Modalidade no evento (futsal, atletismo, xadrez). |
| `categories` | evento ✓ | Faixa etária+gênero (sub-14 masc). **Não confundir com `participants.enrollment_class`.** |
| `sport_events` | evento ✓ | Prova = sport × category. |
| `teams` | evento ✓ | (sport_event, delegation). O time conceitual da Escola X em Futsal Sub-14 Masc é o mesmo em Caracaraí e na Final. |
| `team_members` | evento ✓ | (team, participant). Quem está no time como cadastro. |

### Executivo (stage-scoped)
| Tabela | Escopo | Comentário |
|:---|:---|:---|
| `competition_phases` | **etapa** ✓ | `event_stage_id NOT NULL` desde a Fase F3 — fase eliminatória pertence à Caracaraí, fase final pertence à Boa Vista. |
| `competition_groups` | herda de phase | OK uma vez que phases tenha event_stage_id. |
| `competition_matches` | **etapa** ✓ | Já tem `event_stage_id`. Cada partida acontece em uma etapa. |
| `competition_match_entries` | herda de match | Entry = team OU participant_sport_event. |
| `match_lineups` | herda de match | **Sutileza:** o time é o mesmo, mas o lineup pode mudar entre etapas. Por isso lineup é por match (que é por stage). |
| `match_scores` | herda de match | Detalhes do placar. |
| `competition_match_results` | herda de match | `result_status`: `submitted`, `validated`, `published` (a renomear do PT-BR atual `resultado_lancado`/`validado`/`publicado`). |

---

## 7. Substituições (regulamento) — feature futura

O regulamento JER prevê **substituição**: durante o evento, uma delegação pode trocar atletas (saída de um, entrada de outro) em determinadas provas, respeitando regras de prazo e categoria. Isso ainda não está implementado no schema.

### Conceito
A substituição é um **evento administrativo** que afeta:
- Inscrição esportiva (`participant_sport_events`).
- Lineup de time coletivo (`team_members` / `match_lineups`).
- Possivelmente vouchers e ocupação (se a pessoa que sai já tinha consumo registrado).

### Princípios para o desenho

1. **Auditoria imutável.** Cada substituição gera linha em uma tabela `substitutions` com:
   - `id`, `event_id`, `event_stage_id` (em qual etapa ocorreu)
   - `delegation_id`, `sport_event_id`
   - `participant_out_id` (quem sai)
   - `participant_in_id` (quem entra)
   - `reason` (motivo regulamentar: lesão, problema disciplinar, etc.)
   - `requested_by`, `approved_by`, `requested_at`, `approved_at`
   - `status`: `requested`, `approved`, `rejected`, `executed`
2. **A inscrição esportiva é versionada, não deletada.** Quando a substituição é executada:
   - Marcar `participant_sport_events` da pessoa que sai como `status='cancelled_by_substitution'` + `substituted_by_substitution_id` (FK para a substituição).
   - Inserir novo `participant_sport_events` para a pessoa que entra com `created_by_substitution_id`.
   - Histórico esportivo (passes, gols, baterias antes da substituição) **permanece atribuído à pessoa original**.
3. **Lineup respeita o momento.** `match_lineups` aponta para `participant_id` no momento do jogo. Se a substituição ocorre antes do jogo, lineup vai com a pessoa nova. Se ocorre entre jogos da mesma fase, lineups passados ficam com a pessoa antiga.
4. **Operação (consumos) não é versionada.** Refeições/hospedagem/transporte de quem saiu permanecem registradas. Quem entra começa a consumir a partir da execução. **Não retroativo.**
5. **Substituição é stage-scoped.** Faz sentido em uma etapa, não no evento como um todo. (`event_stage_id NOT NULL` na tabela `substitutions`.)

### Casos limite a tratar (decisão pendente)

- **Substituição entre etapas:** João desistiu antes da Final, mas a vaga não pode ficar vazia. Substituição é registrada com `event_stage_id` da Final. A linha em `participant_event_stages` da pessoa nova é criada nesse momento.
- **Substituição em prova individual:** raro, mas o regulamento permite em algumas categorias com prazo. Mesmo modelo, mas afeta apenas `participant_sport_events`.
- **Substituição revogada:** se aprovada e depois revertida, criar nova substituição com `reason='revogacao_de_<id>'` em vez de mexer na original. Auditoria continua imutável.

### Quando implementar
**Fase G** do plano de normalização. Depende de:
- Fase A (participants enxuto).
- Fase B (delegations × institutions resolvido).
- Confirmação do regulamento JER 2026 sobre prazos e tipos de substituição permitidos.

---

## 8. Plano de normalização (resumido)

| Fase | Escopo | Status |
|:---:|:---|:---:|
| **A1** | Desbloat de `participants` — DROP `birth_date`, `biological_sex`, `disability_type` (duplicatas óbvias) | ✅ |
| **A2** | Mover `coach_*`, `guardian_*`, `eja_flag`, `wheelchair_user_flag`, `national_ban_until`, `school_role_label` para `people`; `enrollment_date` removido sem migrar | ✅ |
| **B1** | Refactor de leituras: 27 arquivos passam a ler `delegations(institutions(name))` em vez de `delegations(school_name)` | ✅ |
| **B2** | Refactor de edição: `DelegationFormDialog` (sem prefixo `school_`) + `DelegacoesPage` (insert/update em `institutions` + `delegations`, filters/sort/search via JOIN) | ✅ |
| **B3** | Migration final: DROP 11 colunas `school_*` em `delegations` + DROP 3 triggers de sync + DROP 3 funções + DROP índice único legado + types.ts limpo | ✅ |
| **C** | Renomear `participants.category` → `enrollment_class`; criar `enum participant_type` real com 19 valores em uso. (`match_result_status` enum já existia desde 20260422.) | ✅ |
| **D** | DROP `participants.active_status` (redundante); corrige bug latente em `get_participant_counts_by_institution` e `get_present_participant_counts_by_institution` (passam a fazer JOIN com `delegations` para resolver `institution_id`) | ✅ |
| **E** | Atualização de docs: `05-banco-de-dados-e-rls.md` reescrito refletindo os 4 quadrantes, enums, constraints, triggers e fases de normalização; `12-glossario.md` ganhou termos novos (Etapa, Quadrante, Lei de Escopo, Stage-scoped, Inscrição em Etapa, Documento Canônico, Substituição). | ✅ |
| **F1** | Logística stage-scoped — `meal_types.event_stage_id` e `meal_locations.event_stage_id` NOT NULL; `service_vouchers.event_stage_id` adicionado e NOT NULL (voucher é consumo da etapa, canônico §11.5) | ✅ |
| **F2** | `participant_sport_events.event_stage_id` NOT NULL após backfill; UNIQUE redefinido para `(participant_id, sport_event_id, event_stage_id)` direto (sem COALESCE) | ✅ |
| **F3** | `competition_phases.event_stage_id` ADD COLUMN + backfill + FK ON DELETE RESTRICT + NOT NULL + INDEX. Encerra Fase F. | ✅ |
| **G1** | Schema + RPC: tabela `substitutions` (auditoria imutável, stage-scoped), `participant_sport_events` ganha `cancelled_by_substitution_id`/`created_by_substitution_id` + status `cancelled_by_substitution`, RPC `execute_substitution` atômica e idempotente, RLS (admin/secretaria/coord_tecnica full; delegacao read+request da própria) | ✅ |
| **G2** | UI Admin `/admin/etapa/:stageId/competicao/substituicoes` — listagem com filtros (status/busca), `RequestSubstitutionDialog` (escolhe delegação, prova, atleta out/in, motivo), ações Aprovar/Rejeitar/Executar/Cancelar; `delegacao` só vê e solicita as próprias | ✅ |
| **G3** | Visão da delegação no PWA — `/pwa/delegacao/substituicoes` mobile-first (lista RLS-escopada + botão para solicitar reusando `RequestSubstitutionDialog`); card "Substituições" no `DelegacaoHomePage` | ✅ |

### Sequência recomendada
A → B → F → C → D → E → G

> **Nota:** F vem antes de C/D porque é a mais "estrutural" — define o
> contrato de escopo. Mudar nomes (C) e remover redundâncias (D) é
> cosmético comparado a fixar a lei de etapa.

---

## 9. Convenções obrigatórias para novo código/schema

### Schema
- Toda tabela tem `id uuid PK DEFAULT gen_random_uuid()`, `created_at timestamptz`, `updated_at timestamptz`.
- Toda tabela do Quadrante 3/4-executivo tem `event_stage_id NOT NULL`.
- Status sempre como **enum** quando cabe semântica fechada. Evitar `text + CHECK`.
- Campos cadastrais civis ficam em `people`/`institutions`. **Nunca duplicar em `participants`/`delegations`.**
- Sufixos `_at` (timestamps), `_by` (autoria), `_id` (FKs).
- Junction tables: `<a>_<b>(<a>_id, <b>_id, ...)` com UNIQUE composto.

### Código
- Queries de operação (alimentação/alojamento/transporte) sempre filtram por `event_stage_id`.
- Queries de inscrição filtram por `event_id` (e por `event_stage_id` quando aplicável via junctions).
- Queries de pessoas não filtram por nada.
- Manual search (PWA): sempre carrega presença efetiva (`is_active`, `needs_*`, `credentialed_at`, `left_event_at`) para aplicar travas no front.

### Naming
- Inglês em tudo (tabelas, colunas, enums, RPCs).
- Valores de string em PT-BR são tolerados em `participant_type` por compatibilidade SIGECOM, mas devem virar enum real.
- `event_stage_id` em todo lugar — nunca `stage_id` solto (RPCs internas devem usar a variável com nome canônico).

### Docs
- Sempre que uma migration mudar o domínio, atualizar este documento na mesma PR.
- Auditorias de módulo (`docs/modulos/*.md`) referenciam este documento como fonte da verdade.

---

## 10. Termos do glossário (fixos)

| Termo | Definição canônica |
|:---|:---|
| **Pessoa** | Linha em `people`. Atravessa eventos. |
| **Inscrição** | Linha em `participants` (1 por pessoa por evento). |
| **Delegação** | Representação de uma instituição em um evento. |
| **Etapa** | `event_stage` — sub-evento físico (cidade/sede), com infraestrutura própria. |
| **Inscrição em etapa** | Linha em `participant_event_stages`. Define se a pessoa "existe" naquela etapa. |
| **Inscrição esportiva** | Linha em `participant_sport_events` por (participante, prova, etapa). |
| **Prova** | `sport_event` = modalidade × categoria (Futsal Sub-14 Masc). |
| **Time** | `team` (sport_event, delegation). Conceitual; o mesmo time atravessa etapas. |
| **Lineup** | Escalação de jogadores **para uma partida específica**. Pode mudar entre partidas/etapas. |
| **Fase** | `competition_phase` — bloco da disputa **dentro de uma etapa**. |
| **Substituição** | Ato regulamentar de trocar atletas em uma prova/time durante o evento. Versiona `participant_sport_events`. |
| **Saída antecipada** | `participants.left_event_at` — encerra elegibilidade para refeições/alojamento (Etapa 2 da auditoria de Alimentação). |
| **Trava de presença** | Conjunto de validações no PWA: `is_active`, `needs_*`, `credentialed_at`, `left_event_at` (Etapa 0/1/2 da auditoria de Alimentação). |

---

## 11. Decisões fixadas neste documento

1. ✅ `institutions` é cadastro mestre. `delegations` aponta por FK simples. **Sem colunas `school_*`** em `delegations`.
2. ✅ Cadastrais civis ficam em `people`. `participants` carrega só estado de inscrição naquele evento.
3. ✅ Operação é stage-scoped. Refeitórios, casas, frota, vouchers, divergências têm `event_stage_id NOT NULL`.
4. ✅ Competição estrutural é event-scoped; competição executiva é stage-scoped.
5. ✅ Voucher é consumo da etapa. `service_vouchers.event_stage_id NOT NULL`.
6. ✅ Substituição é versionamento de `participant_sport_events`, com auditoria imutável em `substitutions`.
7. ✅ `participant_event_stages` é a fonte de verdade para "pessoa opera nesta etapa".
8. ✅ Sufixos `_at`/`_by`/`_id` consistentes; statuses como enum.

Quem alterar qualquer uma dessas decisões precisa atualizar este documento na mesma PR.
