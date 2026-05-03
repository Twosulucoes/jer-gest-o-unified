# Diagnóstico: Domínio Pessoas, Inscrição e Competição
**Data:** 2026-05-03
**Escopo:** apenas leitura — não há mudança de schema ou de código nesta PR.

> Este documento mapeia tabelas, colunas e nomes do "core" do sistema
> (pessoa → inscrição → delegação/instituição → modalidade/categoria/prova
> → time/partida/resultado) para identificar duplicidade, débito técnico
> e inconsistências que estavam escondidas. A proposta é decidir, com
> base nele, o quanto vale ou não consolidar antes de continuar com as
> evoluções de Alimentação/Alojamento/Transporte.

---

## 1. Hierarquia atual (estado real)

```
PESSOA (cadastro civil, agnóstico de evento)
└── people
       ├── 1 linha por CPF
       ├── full_name, birth_date, gender, cpf, rg, email, phone,
       │   photo_url, food_restrictions, medical_notes, disability_type,
       │   institution_id (FK opcional → institutions),
       │   is_active, created_at, updated_at
       └── CHECK gender ∈ {male, female}

INSTITUIÇÃO (cadastro de escola/órgão, agnóstico de evento)
└── institutions
       ├── 1 linha por escola/órgão
       ├── name, official_name, slug, network_type, city, state, district,
       │   contact_*, is_active

EVENTO (edição do JER)
└── events (id, name, slug, year, status, start_date, end_date, ...)
       └── event_stages (etapas: classificatoria/semifinal/final/legado/outro)

DELEGAÇÃO (representação da instituição no evento)
└── delegations
       ├── (event_id, institution_id) UNIQUE
       ├── status, chief_name, chief_phone, chief_email, notes
       ├── + 11 colunas school_* duplicadas de institutions (ver §3.2)

INSCRIÇÃO (pessoa em evento)
└── participants
       ├── (person_id, event_id) UNIQUE
       ├── delegation_id (opcional)
       ├── participant_type (text com CHECK: athlete|coach|head_of_delegation|official|staff)
       ├── category (enum: delegation|organization)  ← cuidado, confunde com tabela "categories"
       ├── status (text com CHECK: pending|confirmed|cancelled|rejected)
       ├── is_active, regular_attendance_confirmed, active_status
       ├── credentialed_at, credentialed_by
       ├── needs_meals, needs_lodging, needs_transport
       ├── left_event_at, left_event_reason, left_event_by  ← Etapa 2 Alim.
       ├── notes, logistics_notes, logistics_restrictions
       ├── seed_tag, seed_batch_id (rastreio de importação)
       ├── + ≈12 colunas cadastrais duplicadas de people (ver §3.1)
       └── + 7 colunas org-only (organization_subtype, role_function, sector_area,
           responsibilities, access_permissions, observations)

       ├── participant_credentials (1↔N por participante: emissões/reemissões)
       ├── participant_event_stages (N↔N: em quais etapas opera)
       └── participant_sport_events (N↔N: em quais provas inscrito)

COMPETIÇÃO
└── sports (modalidades por evento — futsal, atletismo, xadrez)
└── categories (faixa etária+gênero por evento — sub-14 masc, livre fem)
└── sport_events (PROVA = sport × category)
       └── teams (sport_event × delegation, com nome próprio)
              └── team_members (team × participant, com role/jersey)
       └── competition_phases → competition_groups → competition_matches
              └── competition_match_entries (1 entry = ou time, ou pessoa-prova)
                     ├── match_lineups (escalações)
                     ├── match_scores
                     └── competition_match_results (status: resultado_lancado|...)
```

---

## 2. O que está bem nomeado e consistente

- **Inglês uniforme** nos nomes de tabelas e colunas (`people`, `participants`, `sport_events`, `competition_matches`, etc.). Não há mistura de PT-BR no schema; só nos **valores** de string (`'classificatoria'`, `'motorista'`).
- **Convenção de FK** seguida em quase todo o domínio: `<entidade>_id` apontando para `<entidades>.id`.
- **`event_id` quase sempre presente** nas tabelas operacionais, permitindo escopo por evento via filtro simples.
- **Sufixo `_at` para timestamps** e `_by` para autoria — consistente em `created_at`/`updated_at`/`credentialed_at`/`checked_in_at`/`checked_out_at`/`left_event_at`/`recorded_at`.
- **Tabelas de junção têm UNIQUE composto** que documenta a regra:
  `participants(person_id, event_id)`, `participant_event_stages(participant_id, event_stage_id)`, `participant_sport_events(participant_id, sport_event_id)`, `team_members(team_id, participant_id)`.
- **Hierarquia de competição** (`sport → category → sport_event → team/entry → match`) é limpa e fácil de explicar; foi o que permitiu modelar o caso do João da Silva sem ambiguidade.

---

## 3. Inconsistências e débitos técnicos

### 3.1 `participants` está super-bloated com cadastrais que pertencem a `people`

A tabela `participants` recebeu, ao longo de 4 migrations distintas, colunas
que conceitualmente são de **cadastro civil** (pertencem à pessoa, não à
inscrição):

| Coluna em `participants` | Já existe em `people`? | Comentário |
|:---|:---:|:---|
| `birth_date` | ✅ (`people.birth_date NOT NULL`) | **DUP** — duas fontes da mesma info por evento. |
| `biological_sex` | ✅ (`people.gender`) | **DUP** + naming divergente (`gender` × `biological_sex`). |
| `disability_type` | ✅ (`people.disability_type`) | **DUP**. |
| `coach_name`, `coach_phone` | ❌ | Cadastral, mas faz sentido por evento (técnico atual da equipe) — discutível. |
| `guardian_name`, `guardian_phone` | ❌ | Cadastral civil, idealmente em `people` ou tabela `people_guardians`. |
| `eja_flag`, `wheelchair_user_flag` | ❌ | Cadastrais — pertencem a `people`. |
| `enrollment_date`, `school_role_label` | ❌ | Vínculo escola-pessoa, mais perto de `people`/`institutions`. |
| `national_ban_until` | ❌ | Status disciplinar civil, deveria estar em `people` (banimento atravessa eventos). |

> Consequência prática: queries como `participantManualSearch` e
> `AlojamentoListaCompletaPage` ora leem de `people`, ora de
> `participants`, conforme a memória do desenvolvedor. Em casos como
> `biological_sex`, o PWA de pesquisa (`PesquisaNovaPage`) **lê
> exclusivamente o campo legado** — se alguém atualizar `people.gender`
> pensando que é a fonte canônica, a pesquisa continua usando o valor
> antigo.

### 3.2 `delegations` × `institutions`: fusão pela metade

A migration `20260417223919` ("Fase 3: Fusão institutions → delegations não-destrutiva") adicionou em `delegations` **11 colunas com prefixo `school_*`**, todas espelhando `institutions`:

```
delegations.school_name, school_official_name, school_slug,
school_network_type, school_city, school_state, school_district,
school_contact_name, school_contact_phone, school_contact_email,
school_is_active
```

E criou **dois triggers bidirecionais** (`trg_delegations_sync_to_institution` + `trg_institutions_sync_to_delegations`) para manter as duas tabelas em sincronia. Mais um terceiro trigger (`trg_delegations_autocreate_institution`) que cria uma institution sintética sempre que se insere uma delegação sem `institution_id`.

> Consequência prática:
> - Atualizar `institutions.name` dispara update de N delegations.
> - Atualizar `delegations.school_name` dispara update da institution.
> - Há risco de loop em cenários onde os triggers sejam ativados em
>   cascata. Hoje funciona porque as condições `IS DISTINCT FROM` quebram
>   o ciclo, mas é frágil.
> - Queries no código misturam: muitas selecionam `delegations(school_name)` (é o "estado vivo"), outras ainda fazem `delegations(institution:institutions(name))`. Sem regra clara.

A fusão precisa terminar (deprecar `institutions` ou remover as colunas `school_*` e voltar ao FK puro). Sem decisão, o débito cresce.

### 3.3 `participants.category` × tabela `categories`

Foram introduzidos juntos sem aviso:

| Nome | Significado | Tipo |
|:---|:---|:---|
| `participants.category` | "categoria" da inscrição: `delegation` ou `organization` | enum `participant_category` |
| `categories` (tabela) | "categoria" esportiva: sub-14 masc, livre fem... | tabela com FK `event_id` |

Para um leitor SQL, `SELECT category FROM participants` pode parecer apontar para `categories.id`. Não aponta. **Renomear `participants.category` para `participation_kind` ou `enrollment_class`** ajudaria muito.

### 3.4 `participant_type` é texto livre na prática

Apesar do CHECK declarado (`athlete|coach|head_of_delegation|official|staff`), a migration `20260421_separate_participant_types.sql` faz:

```sql
UPDATE participants SET category = 'organization'
WHERE participant_type IN (
  'motorista','agente_operacao','logistica','cozinheira','guia',
  'secretaria','mesario','arbitro','delegado','fiscal',
  'operador_pesquisa','tecnico_ti','terceiro','colaborador'
);
```

Ou seja, **na produção real existem ≥14 valores além do CHECK declarado**, sem enum, sem FK, sem auto-completar nas telas. Operadores precisam digitar a string exata. Risco de typo silencioso.

### 3.5 Status duplicado em N tabelas, sem enum

Cada tabela do domínio tem seu próprio universo de strings de status, sempre `text` com `CHECK`:

| Tabela | Domínio do status |
|:---|:---|
| `participants` | `pending`, `confirmed`, `cancelled`, `rejected` |
| `participant_sport_events` | `pending`, `confirmed`, `cancelled`, `rejected` |
| `delegations` | `pending`, `confirmed`, `rejected`, `cancelled` (ordem diferente) |
| `participant_credentials` | `pending`, `active`, `suspended`, `revoked` |
| `service_vouchers` | `active`, `revoked`, `expired` |
| `event_stages` | `active`, `archived` |
| `competition_matches` | `scheduled`, `in_progress`, `completed`, ... |
| `competition_match_results` | `resultado_lancado`, `resultado_validado`, `publicado` (PT-BR) |
| `lodging_occupancies` | `planned`, `checked_in`, `checked_out`, `cancelled` |

Não há **um único enum reutilizado**. As duplicidades semânticas (`active` × `confirmed` para "vivo no evento", `cancelled` × `revoked` × `archived` para "morto") já se manifestaram em queries que comparam strings com casing/spelling errado.

Adicionalmente, `competition_match_results.result_status` é o **único caso PT-BR** no schema — destoa de tudo o resto.

### 3.6 `active_status` em `participants` é redundante com `status` + `is_active`

Existem três colunas para o "está vivo?":

- `participants.is_active boolean NOT NULL DEFAULT true`
- `participants.status text NOT NULL DEFAULT 'pending'`
- `participants.active_status text NULL`

A semântica de `active_status` não está documentada em nenhuma migration de comentário. RPCs operacionais (`pwa_lodging_checkin`) só leem `is_active` e `status='active'`. Forte candidato a remoção.

### 3.7 Naming menor — `_event_stage_id` × `_stage_id`

A maioria das tabelas usa `event_stage_id`. Mas `participant_event_stages` (a junction) tem **`event_stage_id`** na coluna e **`stage_id`** em código antigo (`pwa_lodging_checkin` usa `stage_id INTO v_current_stage_id` lendo de `participant_event_stages`). O TS types já mostra `event_stage_id` consistente; é só a RPC com nomenclatura interna divergente.

### 3.8 Resultados (`competition_match_results`) — sem enum, em PT-BR

`result_status text DEFAULT 'resultado_lancado'`, com transições `lancado → validado → publicado` documentadas no glossário, mas sem `CREATE TYPE` correspondente. Risco de typo, e quebra a regra "schema em inglês".

---

## 4. Onde isso afeta o código vivo

| Arquivo | Sintoma |
|:---|:---|
| `src/pages/pwa/PesquisaNovaPage.tsx` | Lê `participants.biological_sex` em vez de `people.gender`. Único caller que ainda depende do campo legado. |
| `src/lib/participantManualSearch.ts` | Mistura `people` (nome/CPF) + `participants` (presença) — ok, mas reforça o desejo de não duplicar mais nada cadastral em `participants`. |
| `src/pages/pwa/alojamento/AlojamentoListaCompletaPage.tsx` | Lê `participants.people.birth_date` (dois saltos), evidenciando que a fonte canônica é `people` mesmo quando existe `participants.birth_date`. |
| `src/pages/admin/PessoasPage.tsx` | Permite editar `participants.birth_date` e potencialmente diverge de `people.birth_date` no mesmo evento. |
| Vários | `delegations.school_name` é o que aparece nas telas (não `institutions.name`) — confirma que o fluxo "vivo" prefere a cópia em `delegations`. |
| `pwa_lodging_checkin` | Usa `stage_id` como variável interna apesar do schema chamar `event_stage_id`. Estética, sem impacto. |

---

## 5. Proposta de plano de normalização (não implementado nesta PR)

> Cada item abaixo é uma migration + refactor independente, com testes
> de regressão. Não recomendo fazer tudo de uma vez.

### Lote A — limpeza cadastral (alto impacto, médio risco)
1. **A1 — `biological_sex`** → migrar `PesquisaNovaPage` para `people.gender`, depois `DROP COLUMN participants.biological_sex`.
2. **A2 — `birth_date` em `participants`** → migrar todos os callers para `people.birth_date`, então remover. Bonificação: trigger que copia `people.birth_date` para `people.disability_type`/`food_restrictions` se algum caller estiver atualizando o errado.
3. **A3 — `disability_type` em `participants`** → idem.
4. **A4 — `eja_flag`, `wheelchair_user_flag`, `national_ban_until`** → mover para `people` (são da pessoa, atravessam eventos).

### Lote B — fusão institutions × delegations (médio impacto, alto risco)
5. **B1 — Decidir um lado**:
   - **Opção 1 (preferida):** manter `institutions` como cadastro mestre, remover as colunas `school_*` de `delegations` e os 3 triggers, padronizar o front em `delegations(institution:institutions(name))`.
   - **Opção 2:** completar a fusão — `DROP TABLE institutions`, `delegations` carrega tudo. Implica refactor de FKs.
6. **B2 — Antes de qualquer escolha**, congelar gravação direta nos campos espelhados e medir uso real (telemetria) por uma semana.

### Lote C — enums e statuses (baixo impacto, baixo risco)
7. **C1 — Criar `enum lifecycle_status`** (`pending|active|cancelled|archived`) e migrar `participants`, `participant_sport_events`, `delegations` para usar (mantém compatibilidade com casts). `participant_credentials`, `service_vouchers` e `competition_matches` continuam com seus próprios enums por terem semântica distinta.
8. **C2 — Remover `participants.active_status`** (3.6).
9. **C3 — Renomear `participants.category` → `enrollment_class`** (3.3) com view de compatibilidade temporária.
10. **C4 — Criar `enum participant_type` real** com os ≥14 valores em uso, substituir o CHECK por enum (3.4).
11. **C5 — Criar `enum match_result_status`** (`resultado_lancado|resultado_validado|publicado`), considerando renomeação para inglês (`pending|validated|published`) com view em PT-BR para compatibilidade.

### Lote D — naming menor
12. **D1 — Padronizar `event_stage_id`** em todas as RPCs (substituir `stage_id` interno). Cosmético.

### Lote E — documentação
13. **E1 — Atualizar `docs/12-glossario.md`** com a hierarquia desenhada na §1.
14. **E2 — Atualizar `docs/05-banco-de-dados-e-rls.md`** com as tabelas reais (hoje desatualizado).

---

## 6. Recomendação de prioridade

Para o evento JER 2026 já em operação:

| Prioridade | Item | Justificativa |
|:---:|:---|:---|
| 🔴 Alta | **A1** (biological_sex) | Único caller vivo do campo legado; fácil de quebrar uma pesquisa por dessincronia. |
| 🔴 Alta | **B1** (decidir institutions × delegations) | Risco de loop nos triggers e queries que escolhem fonte ao acaso. |
| 🟡 Média | **A2/A3** (birth_date, disability_type) | Duplicidade incômoda mas estabilizada. |
| 🟡 Média | **C3** (renomear participants.category) | Confusão semântica forte para novos contribuidores. |
| 🟢 Baixa | **A4, C1, C2, C4, C5, D1, E1, E2** | Saneamento contínuo, pode entrar em janelas específicas. |

---

## 7. Decisão pendente do operador (humano)

Antes de começar qualquer limpeza:
1. Aceitar a versão real desenhada em §1 como contrato.
2. Decidir B1 (Opção 1 ou 2) — é a única decisão de arquitetura.
3. Aprovar a sequência A1 → B1 (decisão) → A2/A3 → C3 → resto.

Sem essa decisão, qualquer migration corre risco de pisar em código que ainda lê o campo "errado".
