# 05 — Banco de Dados e RLS

> Atualizado em 2026-05-03 (após Fase E da Normalização). Para a constituição
> formal do domínio, consulte [`dominio-canonico.md`](dominio-canonico.md).

## Visão Geral

- **Esquema canônico em 4 quadrantes**: Pessoas (sem evento), Inscrição (evento), Operação/Logística (etapa) e Competição (estrutural=evento, executivo=etapa). Detalhes em `docs/dominio-canonico.md`.
- Todas as tabelas operacionais têm RLS habilitado.
- 2 views públicas: `vw_participant_sport_history`, `public_results_view` (materialized).
- ≈ 30 RPCs públicas (operacionais + relatórios + agregados de presença).
- Triggers de `updated_at` em todas as tabelas com a coluna.

## Tabelas por Quadrante

### 1. Pessoas (cadastro civil — atravessa eventos)
| Tabela | Descrição | Observações |
|--------|-----------|-------------|
| `people` | Cadastro de pessoas físicas. CPF único parcial. | Carrega `birth_date`, `gender`, `food_restrictions`, `disability_type`, `eja_flag`, `wheelchair_user_flag`, `national_ban_until`, `coach_*`, `guardian_*`, `school_role_label` (cadastrais civis movidos da tabela `participants` na Fase A2). |
| `institutions` | Escolas/instituições. Cadastro mestre, sem `event_id`. | Reutilizada em múltiplas edições. Após a Fase B3, é a **única** fonte do nome/dados da escola — `delegations` aponta por FK simples. |

### 2. Inscrição (escopo: evento; junções com etapa quando precisa)
| Tabela | Descrição | Observações |
|--------|-----------|-------------|
| `events` | Edições do JER (2025, 2026...). | Raiz do quadrante. |
| `event_stages` | Etapas físicas (Caracaraí classificatória, Boa Vista final...). | A unidade física e operacional do JER. |
| `delegations` | Representação de uma `institutions` em um `events`. UNIQUE `(event_id, institution_id)`. | Carrega só vínculo + chefia (`chief_*`) + `status` + `notes`. Sem mais colunas `school_*` (Fase B3). |
| `participants` | Inscrição de uma `people` em um `events`. UNIQUE `(person_id, event_id)`. | Carrega só estado da inscrição: `participant_type` (enum, 19 valores), `enrollment_class` (`delegation`/`organization`), `status`, `is_active`, `regular_attendance_confirmed`, `credentialed_at/by`, `left_event_at/reason/by`, `needs_meals/lodging/transport`, `delegation_id` (opcional). |
| `participant_credentials` | Credencial física no evento (uma por participante por evento). | `credential_code`, `qr_code_value`, ciclo `pending → active → suspended → revoked`. |
| `participant_event_stages` | Junction: pessoa opera nesta etapa. UNIQUE `(participant_id, event_stage_id)`. | É a **fonte de verdade** para "atleta presente nesta etapa". |
| `participant_sport_events` | Inscrição esportiva. UNIQUE `(participant_id, sport_event_id, event_stage_id)`. | `event_stage_id NOT NULL` desde Fase F2 — uma linha por etapa. |

### 3. Operação / Logística (escopo: etapa — toda tabela tem `event_stage_id NOT NULL`)
| Grupo | Tabelas | Observações |
|-------|---------|-------------|
| Alimentação | `meal_types`, `meal_locations`, `meal_windows`, `meal_window_eligibility`, `meal_consumptions`, `meal_incidents`, `meal_forecast_exports` | `meal_types`, `meal_locations` e `meal_windows` com `event_stage_id NOT NULL` (Fase F1). |
| Alojamento | `lodging_locations`, `lodging_units`, `lodging_occupancies`, `lodging_audit_logs`, `lodging_incidents`, `lodging_presence_logs` | `event_stage_id NOT NULL` em `locations`/`units`/`occupancies`. Trigger `ck_meal_consumption_left_event` cruza com saída antecipada. |
| Transporte | `transport_vehicles`, `transport_routes`, `transport_trips`, `transport_passengers` | `event_stage_id NOT NULL` em vehicles/routes/trips. |
| Vouchers | `service_vouchers`, `service_voucher_uses`, `service_voucher_batches`, `service_eventual_people` | **`service_vouchers.event_stage_id NOT NULL`** desde Fase F1: voucher é consumo da etapa. |

### 4. Competição
**Estrutural (event-scoped)**:
| Tabela | Descrição |
|--------|-----------|
| `sports` | Modalidades por evento. |
| `categories` | Faixas de idade/gênero por evento. |
| `sport_events` | Prova = `sport × category`. |
| `teams` | (sport_event, delegation) com nome próprio. |
| `team_members` | (team, participant). |

**Executivo (stage-scoped — `event_stage_id NOT NULL`)**:
| Tabela | Observações |
|--------|-------------|
| `competition_phases` | `event_stage_id NOT NULL` desde Fase F3 — uma fase pertence a uma etapa. |
| `competition_groups` | Herda de phase. |
| `competition_matches` | Tem `event_stage_id` direto. |
| `competition_match_entries`, `match_lineups`, `match_scores`, `competition_match_results` | Herdam de match. |
| `match_events`, `match_penalties`, `match_officials`, `match_attachments`, `match_attempts`, `match_player_stats`, `match_discipline`, `match_user_assignments` | Auxiliares de partida. |

### Outros Domínios
- **Credenciamento**: `participant_credentials`, `credential_scans`, `credential_templates`.
- **Governança**: `official_bulletins`, `audit_events`.
- **Importação**: `import_logs`, `import_row_errors`, `import_pendencias`.
- **Acessos**: `user_roles`, `user_delegations`, `user_sport_links`, `user_stage_assignments`.
- **Normalização SIGECOM**: `prova_catalog`, `prova_aliases`, `sport_event_prova_map`.
- **Pesquisa**: `pesquisa_events`, `pesquisa_researchers`, `pesquisa_sessions`, `pesquisa_surveys`.
- **Conteúdo público**: `public_content`.
- **Relatórios**: `report_presets`.

## Enums centrais

| Enum | Tabela alvo | Valores |
|------|-------------|---------|
| `app_role` | `user_roles.role` | `admin`, `secretaria`, `coordenacao_tecnica`, `coordenador_modalidade`, `mesario`, `transporte`, `alimentacao`, `alojamento`, `arbitragem`, `cde`, `delegacao`, `super_admin` |
| `participant_type` | `participants.participant_type` | `athlete`, `coach`, `head_of_delegation`, `official`, `staff`, `motorista`, `agente_operacao`, `logistica`, `cozinheira`, `guia`, `secretaria`, `mesario`, `arbitro`, `delegado`, `fiscal`, `operador_pesquisa`, `tecnico_ti`, `terceiro`, `colaborador` (19; enum desde Fase C) |
| `participant_category` | `participants.enrollment_class` | `delegation`, `organization` |
| `match_result_status` | `competition_match_results.result_status` | `resultado_lancado`, `resultado_validado`, `publicado` |
| `bulletin_status` | `official_bulletins.status` | `rascunho`, `publicado`, `cancelado` |
| `meal_incident_type` | `meal_incidents.incident_type` | `NOT_ELIGIBLE`, `OUTSIDE_WINDOW`, `DUPLICATE`, `VOUCHER_INVALID`, `VOUCHER_REVOKED`, `VOUCHER_EXPIRED`, `VOUCHER_ALREADY_USED`, `OTHER`, `NO_CREDENTIAL`, `PARTICIPANT_INACTIVE`, `NEEDS_MEALS_FALSE`, `LEFT_EVENT` (Etapa 1 da auditoria de Alimentação) |

## Constraints de Unicidade Críticas

| Tabela | Constraint | Propósito |
|--------|-----------|-----------|
| `people` | `(cpf)` (parcial) | CPF único quando preenchido. |
| `delegations` | `(event_id, institution_id)` | Uma delegação por escola por evento. |
| `participants` | `(person_id, event_id)` | Uma inscrição por pessoa por evento. |
| `participant_credentials` | `(event_id, credential_code)` + `(qr_code_value)` | Código único por evento + QR globalmente único. |
| `participant_event_stages` | `(participant_id, event_stage_id)` | Uma linha por (participante × etapa). |
| `participant_sport_events` | `(participant_id, sport_event_id, event_stage_id)` | Inscrição esportiva por etapa (Fase F2). |
| `teams` | `(sport_event_id, delegation_id)` | Uma equipe por delegação/prova. |
| `team_members` | `(team_id, participant_id)` | Membro único por equipe. |
| `sport_event_rules` | `(sport_event_id)` | Uma regra por prova. |
| `service_vouchers` | `(qr_code_value)` | QR único globalmente. |

## RLS — Padrão por Perfil

Policies usam a função `has_role(auth.uid(), 'perfil'::app_role)` (SECURITY DEFINER, com curto-circuito para `super_admin`).

| Perfil | Escopo |
|--------|--------|
| **admin** | ALL em todas as tabelas. |
| **secretaria** | ALL na maioria, com restrições por etapa em algumas. |
| **coordenacao_tecnica** | SELECT na maioria + ALL em competição/credenciais/regras. |
| **coordenador_modalidade** | ALL em `match_entries`, `match_results`, `match_events`, `match_lineups`. |
| **mesario** | SELECT em partidas/entries/results designadas via `match_user_assignments`. |
| **transporte / alimentacao / alojamento** | SELECT em tabelas operacionais do próprio domínio + INSERT em scans/consumos próprios. |
| **alimentacao** | Etapa 1 da auditoria: leitura também em `meal_locations`, `meal_types`, `meal_windows` por role (RLS estrita). |
| **delegacao** | SELECT restrito à própria delegação (helper `get_user_delegation_id(uid)`). PWA ganhou tela de Alimentação na Etapa 5 da auditoria. |
| **anon** | SELECT em `competition_match_results` WHERE `result_status = 'publicado'`. |

Algumas tabelas têm também política **stage-restricted** via `check_user_stage_access(stage_id)` para isolar operadores por etapa.

## Triggers de Validação Importantes

| Trigger | Tabela | Garante |
|---------|--------|---------|
| `trg_validate_participant_delegation_event` | `participants` | Delegação no mesmo evento. |
| `trg_validate_pse_event_consistency` | `participant_sport_events` | Participante e prova no mesmo evento. |
| `trg_validate_credential_event` | `participant_credentials` | Credencial e participante no mesmo evento. |
| `trg_validate_sport_event_references` | `sport_events` | Sport e category no mesmo evento. |
| `trg_validate_team_event` | `teams` | Equipe, prova e delegação no mesmo evento. |
| `trg_validate_team_member_event` | `team_members` | Membro e equipe no mesmo evento. |
| `trg_validate_match_entry_event` | `competition_match_entries` | Entrada e partida no mesmo evento. |
| `trg_validate_lineup_entry` | `match_lineups` | Lineup consistente com entry/team. |
| `trg_auto_fill_match_sport_event` | `competition_matches` | Preenche `sport_event_id` via fase. |
| `trg_validate_lodging_capacity` | `lodging_occupancies` | Capacidade da unidade respeitada. |
| `trg_participant_left_event_lodging` | `participants` | Auto-checkout em alojamento quando `left_event_at` é registrado (Etapa 1 da auditoria de Alojamento). |
| `ck_meal_consumption_left_event` | `meal_consumptions` | Bloqueia consumo após `left_event_at::date` (Etapa 2 da auditoria de Alimentação). |

## Histórico de mudanças estruturais relevantes

- **Fase A (Normalização)**: cadastrais civis movidos de `participants` para `people` (`birth_date`, `gender`, `disability_type`, `eja_flag`, `wheelchair_user_flag`, `national_ban_until`, `coach_*`, `guardian_*`, `school_role_label`).
- **Fase B**: desfusão `delegations` × `institutions` — removidas 11 colunas `school_*` espelhadas e 3 triggers de sincronia bidirecional. `institutions` voltou a ser cadastro mestre puro.
- **Fase F**: lei de escopo aplicada — `event_stage_id NOT NULL` em `meal_types`, `meal_locations`, `service_vouchers`, `participant_sport_events`, `competition_phases`.
- **Fase C**: `participants.category → enrollment_class` (rename) + enum `participant_type` com 19 valores.
- **Fase D**: DROP `participants.active_status` (redundante) e correção das RPCs `get_*_participant_counts_by_institution` para resolver `institution_id` via JOIN com `delegations`.

Para a sequência completa de fases (A1, A2, B1, B2, B3, C, D, E, F1, F2, F3, G), consulte `docs/dominio-canonico.md` §8.
