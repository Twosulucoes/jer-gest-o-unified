# 05 — Banco de Dados e RLS

> Auditoria atualizada em 2026-04-14

## Visão Geral

- **63 tabelas** no schema `public`, todas com RLS habilitado
- **1 view**: `vw_participant_sport_history`
- **1 view materializada**: `public_results_view`
- **29 RPCs** públicas (prefixo `rpc_`)
- **13+ triggers de validação** de integridade referencial
- **Triggers de `updated_at`** em todas as tabelas

## Tabelas por Domínio (63 total)

### Core (3)
| Tabela | Descrição |
|--------|-----------|
| `events` | Edições do evento (JER 2025, 2026...) |
| `profiles` | Perfil do usuário autenticado (nome, avatar) |
| `user_roles` | Associação usuário ↔ role (admin, secretaria...) |

### Pessoas e Participantes (5)
| Tabela | Descrição |
|--------|-----------|
| `people` | Cadastro de pessoas (nome, CPF, data nascimento, gênero, foto) |
| `institutions` | Escolas/instituições |
| `delegations` | Delegações por evento (instituição + chefe) |
| `participants` | Participante = pessoa + evento + delegação + tipo |
| `participant_sport_events` | Inscrição do participante em prova |

### Esportivo (8)
| Tabela | Descrição |
|--------|-----------|
| `sports` | Modalidades (futsal, atletismo...) |
| `categories` | Categorias (sub-14 masc, livre fem...) |
| `sport_events` | Prova = modalidade + categoria |
| `venues` | Locais de competição |
| `teams` | Equipes (delegação + prova) |
| `team_members` | Membros da equipe |
| `sport_event_rules` | Regras parametrizáveis por prova (JSONB) |
| `group_draw_lots` | Alocação de equipes em grupos (sorteio) |

### Credenciamento (3)
| Tabela | Descrição |
|--------|-----------|
| `participant_credentials` | Credenciais emitidas (código, QR, status) |
| `credential_scans` | Registro de cada validação de QR |
| `credential_templates` | Modelos visuais de credencial |

### Competição (15)
`competition_phases`, `competition_groups`, `competition_matches`, `competition_match_entries`, `competition_match_results`, `match_scores`, `match_lineups`, `match_events`, `match_penalties`, `match_officials`, `match_attachments`, `match_attempts`, `match_player_stats`, `match_discipline`, `match_user_assignments`

### Logística (7)
| Grupo | Tabelas |
|-------|---------|
| Transporte | `transport_vehicles`, `transport_routes`, `transport_trips`, `transport_passengers` |
| Alimentação | `meal_types`, `meal_windows`, `meal_consumptions` |

### Alojamento (3)
`lodging_locations`, `lodging_units`, `lodging_occupancies`

### Governança (2)
| Tabela | Descrição |
|--------|-----------|
| `official_bulletins` | Boletins oficiais (número, título, status) |
| `audit_events` | Registro de ações de auditoria |

### Importação (2)
`import_logs`, `import_row_errors`

### Acessos e Vínculos (2)
`user_delegations`, `user_sport_links`

### Normalização (3)
`prova_catalog`, `prova_aliases`, `sport_event_prova_map`

### Irregularidades (1)
`participation_irregularities`

### Parâmetros (1)
`event_participation_rules`

### Pesquisa (4)
`pesquisa_events`, `pesquisa_researchers`, `pesquisa_sessions`, `pesquisa_surveys`

### Conteúdo Público (1)
`public_content`

### Relatórios (1)
`report_presets`

## RPCs (29)

| RPC | Descrição |
|-----|-----------|
| `rpc_launch_match_result` | Lança resultado com status `resultado_lancado`, marca partida como `finished` |
| `rpc_validate_results_for_sport_event` | Transiciona `resultado_lancado` → `resultado_validado` |
| `rpc_publish_results_for_sport_event` | Transiciona `resultado_validado` → `publicado`, exige boletim |
| `rpc_extract_match_outcome` | Extrai outcome de match (COALESCE scores/results) |
| `rpc_compute_standings_score` | Calcula standings por pontuação (score family) |
| `rpc_compute_standings_sets` | Calcula standings por sets (sets family) |
| `rpc_compute_ranking_simple` | Ranking simples para individuais |
| `rpc_get_group_points_rules` | Retorna regras de pontuação do grupo |
| `rpc_get_sport_event_rules` | Retorna regras ativas ou defaults |
| `rpc_upsert_sport_event_rules` | Upsert de regras com validação |
| `rpc_generate_groups` | Gera grupos para fase |
| `rpc_generate_matches_collective` | Gera partidas round-robin |
| `rpc_generate_matches_individual` | Gera partidas para individuais |
| `rpc_generate_matches_knockout` | Gera chave eliminatória |
| `rpc_get_knockout_bracket` | Retorna dados do bracket |
| `rpc_can_regenerate_matches` | Verifica se pode regenerar partidas |
| `rpc_detect_schedule_conflicts` | Detecta conflitos de agenda |
| `rpc_get_competition_summary` | Resumo da competição |
| `rpc_kpi_partidas_sem_resultado` | KPI de partidas sem resultado |
| `rpc_kpi_provas_sem_partidas` | KPI de provas sem partidas |
| `rpc_list_eligibility_pending` | Lista pendências de elegibilidade |
| `rpc_sync_collective_teams` | Sincroniza equipes coletivas |
| `rpc_create_bulletin` | Cria boletim oficial |
| `rpc_publish_bulletin` | Publica boletim |
| `rpc_reprocess_event` | Reprocessa dados do evento |
| `rpc_get_rls_policies` | Lista policies RLS |
| `rpc_get_schema_columns` | Lista colunas do schema |
| `rpc_get_schema_constraints` | Lista constraints |
| `rpc_get_schema_tables` | Lista tabelas |

## Constraints de Unicidade

| Tabela | Constraint | Propósito |
|--------|-----------|-----------|
| `participant_credentials` | `(event_id, credential_code)` | Código único por evento |
| `participant_credentials` | `(qr_code_value)` | QR globalmente único |
| `participants` | `(person_id, event_id)` | Uma pessoa por evento |
| `participant_sport_events` | `(participant_id, sport_event_id)` | Inscrição única |
| `teams` | `(sport_event_id, delegation_id)` | Uma equipe por delegação/prova |
| `team_members` | `(team_id, participant_id)` | Membro único por equipe |
| `user_roles` | `(user_id, role)` | Role única por usuário |
| `sport_event_rules` | `(sport_event_id)` | Uma regra por prova |

## RLS — Padrão por Perfil

Todas as policies usam a função `has_role(auth.uid(), 'perfil')` (SECURITY DEFINER).

- **admin**: ALL em todas as tabelas
- **secretaria**: SELECT + INSERT + UPDATE na maioria
- **coordenacao_tecnica**: SELECT na maioria + ALL em competição, credenciais e regras
- **coordenador_modalidade**: ALL em match_entries, match_results, match_events, match_lineups
- **mesario**: SELECT em partidas/entries/results designadas (via `match_user_assignments`)
- **transporte/alimentacao**: SELECT em tabelas operacionais + INSERT em scans/consumos próprios
- **delegacao**: SELECT restrito à própria delegação
- **anon**: SELECT em `competition_match_results` WHERE `result_status = 'publicado'`

## Triggers de Validação

| Trigger | Garante |
|---------|---------|
| `trg_validate_participant_delegation_event` | Delegação pertence ao mesmo evento |
| `trg_validate_pse_event_consistency` | Participante e prova no mesmo evento |
| `trg_validate_credential_event` | Credencial e participante no mesmo evento |
| `trg_validate_sport_event_references` | Sport e category no mesmo evento |
| `trg_validate_team_event` | Equipe, prova e delegação no mesmo evento |
| `trg_validate_team_member_event` | Membro e equipe no mesmo evento |
| `trg_validate_match_entry_event` | Entrada e partida no mesmo evento |
| `trg_validate_lineup_entry` | Lineup consistente com entry/team |
| `trg_auto_fill_match_sport_event` | Preenche sport_event_id via fase |
| `trg_validate_lodging_capacity` | Capacidade da unidade respeitada |
