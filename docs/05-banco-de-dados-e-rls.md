# 05 — Banco de Dados e RLS

## Visão Geral

- **42+ tabelas** no schema `public`, todas com RLS habilitado
- **1 view**: `vw_participant_sport_history`
- **13 triggers de validação** de integridade referencial
- **Triggers de `updated_at`** em todas as tabelas

## Tabelas por Domínio

### Core
| Tabela | Descrição |
|--------|-----------|
| `events` | Edições do evento (JER 2025, 2026...) |
| `profiles` | Perfil do usuário autenticado (nome, avatar) |
| `user_roles` | Associação usuário ↔ role (admin, secretaria...) |

### Pessoas e Participantes
| Tabela | Descrição |
|--------|-----------|
| `people` | Cadastro de pessoas (nome, CPF, data nascimento, gênero, foto) |
| `institutions` | Escolas/instituições |
| `delegations` | Delegações por evento (instituição + chefe) |
| `participants` | Participante = pessoa + evento + delegação + tipo |
| `participant_sport_events` | Inscrição do participante em prova |

### Esportivo
| Tabela | Descrição |
|--------|-----------|
| `sports` | Modalidades (futsal, atletismo...) |
| `categories` | Categorias (sub-14 masc, livre fem...) |
| `sport_events` | Prova = modalidade + categoria |
| `venues` | Locais de competição |
| `teams` | Equipes (delegação + prova) |
| `team_members` | Membros da equipe |
| `sport_event_rules` | **Regras parametrizáveis por prova (JSONB)** |

### Credenciamento
| Tabela | Descrição |
|--------|-----------|
| `participant_credentials` | Credenciais emitidas (código, QR, status) |
| `credential_scans` | Registro de cada validação de QR |
| `credential_templates` | Modelos visuais de credencial |

### Competição (13 tabelas)
`competition_phases`, `competition_groups`, `competition_matches`, `competition_match_entries`, `competition_match_results`, `match_scores`, `match_lineups`, `match_events`, `match_penalties`, `match_officials`, `match_attachments`, `match_attempts`, `match_player_stats`

### Logística
| Grupo | Tabelas |
|-------|---------|
| Transporte | `transport_vehicles`, `transport_routes`, `transport_trips`, `transport_passengers` |
| Alimentação | `meal_types`, `meal_windows`, `meal_consumptions` |
| Alojamento | `lodging_locations`, `lodging_units`, `lodging_occupancies` |

### Auditoria
| Tabela | Descrição |
|--------|-----------|
| `import_logs` | Histórico de importações |
| `import_row_errors` | Erros por linha de importação |

## Tabela: sport_event_rules

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid PK | Identificador |
| `sport_event_id` | uuid UNIQUE | Prova vinculada (FK → sport_events) |
| `event_id` | uuid | Evento (FK → events, opcional) |
| `is_active` | boolean | Regra ativa |
| `rules_version` | int | Versão do contrato JSON (default 1) |
| `rules` | jsonb | Configuração completa (família, formato, pontuação, desempate, etc.) |
| `created_at` / `updated_at` | timestamptz | Timestamps automáticos |
| `created_by` / `updated_by` | uuid | Auditoria de autoria |

### Estrutura do campo `rules` (versão 1)
```jsonc
{
  "family": "score",           // score | sets | time | mark | combat | ranking
  "format": "group_stage",     // knockout | group_stage | round_robin | heats | heats_final | combat_bracket | ranking
  "participant_mode": "team",  // individual | team | pair | relay
  "scoring": {
    "score_type": "goals",     // goals | points | rally_points | time_ms | distance_cm | combat_points | placement_points
    "best_of": null,
    "set_points": null,
    "walkover_policy": { "home_goals": 5, "away_goals": 0 }
  },
  "scheduling": {
    "lanes_min": null,
    "lanes_max": null,
    "min_rest_minutes": null
  },
  "tie_breakers": ["head_to_head", "goal_average", "goals_for"],
  "enrollment_limits": {},
  "group_points": { "win": 3, "draw": 1, "loss": 0 },
  "knockout_tie_resolution": { "type": "penalties", "initial_kicks": 5 },
  "preset_key": "FUTSAL",
  "notes": null
}
```

## RPCs de Regras

| RPC | Descrição |
|-----|-----------|
| `rpc_get_sport_event_rules(p_sport_event_id, p_event_id)` | Retorna regras ativas ou defaults por família |
| `rpc_upsert_sport_event_rules(p_sport_event_id, p_event_id, p_rules, p_is_active)` | Upsert com validação |
| `rpc_seed_sport_event_rules_for_event(p_event_id, p_mode, p_dry_run)` | Seed em massa por evento |

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
- **transporte/alimentacao**: SELECT em tabelas operacionais + INSERT em scans/consumos próprios
- **delegacao**: SELECT restrito
- **anon**: SELECT em `competition_match_results` WHERE `result_status = 'publicado'`

### RLS em sport_event_rules
- **SELECT**: admin, coordenacao_tecnica, secretaria
- **INSERT/UPDATE/DELETE**: admin, coordenacao_tecnica
- **Seed (overwrite)**: somente admin (validado na RPC)

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
