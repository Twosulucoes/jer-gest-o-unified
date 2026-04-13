# 04 — Módulos Operacionais

## 1. Importação / Espelhamento SIGECOM (✅ Feito)
- **Página**: `/admin/importacao`
- **Backend**: Edge function `import-inscricoes` + RPC `import_inscricoes_batch`
- **Auditoria**: `import_logs` + `import_row_errors`
- **Comportamento**: idempotente, tolerante a falhas por linha (Padrão A), cria/reutiliza entidades, suporta múltiplas provas por linha
- **Nota**: a inscrição oficial é feita no SIGECOM. Este módulo apenas importa/espelha os dados para a base operacional do JER Gestão.

## 2. Credenciamento (✅ Feito)
- **Página**: `/admin/credenciamento`
- **Ações**: check-in (registrar presença), emitir credencial, reemitir (2ª via), batch com confirmação
- **Labels**: "Registrar presença" (check-in), "Emitir credencial" (geração), "Registrar presença e emitir" (combinado)
- **Status visíveis**: Pendente → Confirmado → Pronto p/ emissão → Credencial ativa

## 3. Credencial + QR Code (✅ Feito)
- **Templates**: `/admin/credenciais/modelos` — CRUD com upload de imagem base e config de campos
- **Geração**: client-side Canvas com QR Code via biblioteca `qrcode`
- **Utilitário**: `credentialUtils.ts` — formato único para `credential_code` e `qr_code_value`
- **Validação**: Edge function `validate-qr` + tabela `credential_scans`
- **Reemissão**: invalida anterior (status `reissued`), gera novos códigos

## 4. Transporte (🟡 Parcial)
- **Páginas**: veículos, rotas, viagens, embarque por viagem
- **Tabelas**: `transport_vehicles`, `transport_routes`, `transport_trips`, `transport_passengers`
- **Gap**: sem controle de retorno explícito, sem relatórios

## 5. Alimentação (🟡 Parcial)
- **Páginas**: tipos de refeição, janelas de serviço, registro de consumo
- **Tabelas**: `meal_types`, `meal_windows`, `meal_consumptions`
- **Gap**: ⚠️ sem UNIQUE constraint `(meal_window_id, participant_id)` para evitar duplicidade

## 6. Alojamento (🟡 Parcial)
- **Páginas**: locais, unidades, ocupação
- **Tabelas**: `lodging_locations`, `lodging_units`, `lodging_occupancies`
- **Trigger**: `validate_lodging_capacity` impede alocação acima da capacidade
- **Gap**: sem relatório de ocupação, sem controle temporal de permanência

## 7. Competição (✅ Feito)
- **Páginas**: fases, grupos, equipes, partidas, detalhe da partida, agenda, resultados
- **Tabelas**: 13 tabelas (phases, groups, matches, entries, results, scores, lineups, events, penalties, officials, attachments, attempts, player_stats)
- **Features**: lineup de jogadores, eventos de jogo, placares por período, tentativas (atletismo), estatísticas individuais, anexos

## 8. Motor de Regras por Prova (✅ Feito)
- **Página**: `/admin/competicao/regras` — editor individual por prova
- **Página**: `/admin/competicao/regras/lote` — revisão e seed em massa
- **Tabela**: `sport_event_rules` (sport_event_id, event_id, rules JSONB, is_active)
- **RPCs**:
  - `rpc_get_sport_event_rules` — busca regras ativas ou retorna defaults por família
  - `rpc_upsert_sport_event_rules` — upsert com validação de família/formato
  - `rpc_seed_sport_event_rules_for_event` — seed em massa com heurística por nome
- **Hook**: `useSportEventRules(eventId, sportEventId)` — query + mutation
- **Componentes**: `RulesPresetPicker`, `RulesForm`, `RulesJsonEditor`
- **Tipos**: `SportEventRulesV1`, `RulesFamily`, `RulesFormat`, `ParticipantMode`, `ScoreType`

### 8.1 Famílias de Regras
| Família | Descrição | Formatos compatíveis |
|---------|-----------|---------------------|
| `score` | Placar (gols/pontos) | group_stage, round_robin, knockout |
| `sets` | Sets (best-of) | group_stage, round_robin, knockout |
| `time` | Tempo (heats) | heats, heats_final, ranking |
| `mark` | Marca (campo/distância) | heats, heats_final, ranking |
| `combat` | Combate (lutas) | combat_bracket, knockout |
| `ranking` | Ranking (sem confronto) | ranking |

### 8.2 Presets Esportivos
| Preset | Família | W.O. | Pontuação grupo | Desempate eliminatório |
|--------|---------|------|-----------------|----------------------|
| FUTSAL | score | 5×0 | V3/E1/D0 | Pênaltis (5 cobranças) |
| FUTEBOL_DE_CAMPO | score | 5×0 | V3/E1/D0 | Pênaltis (5 cobranças) |
| HANDEBOL | score | 5×0 | V3/E0/D1 | Prorrogação + Tiro de 7m |
| BASQUETE | score | 20×0 | V2/D1 | Prorrogação até decisão |
| KARATE_KATA | ranking | — | — | Nota de juízes |
| KARATE_KUMITE | combat | — | — | Pontos (2 min, diff 8) |

### 8.3 Seed Automático
- **RPC**: `rpc_seed_sport_event_rules_for_event(p_event_id, p_mode, p_dry_run)`
- **Modos**: `missing_only` (padrão), `overwrite` (admin), `dry_run` (simulação)
- **Heurística**: detecta modalidade por nome (case-insensitive, sem acentos)
- **Retorno**: relatório JSON com totais por preset, criados, atualizados, ignorados

## 9. Central da Competição (✅ Feito)
- **Página**: `/admin/competicao/central`
- **Wizard**: Participantes → Estrutura → Confrontos/Chaves → Agenda → Classificação → Resultados → Pendências
- **Integração com regras**: lê `sport_event_rules` e ajusta labels/visibilidade conforme família/formato
- **Callout**: se sem regras cadastradas, exibe aviso com link para seed em lote
- **Passo 2 (Estrutura) para coletivas**: wizard com 3 sub-etapas:
  1. **Definir estrutura**: sugestão automática de grupos baseada na quantidade de equipes (1-3→mata-mata, 4-6→grupo único, 7-10→2 grupos, etc.), com ajuste manual
  2. **Alocar equipes**: interface de duas colunas (disponíveis × grupos) com botões de mover, sortear e redistribuir. Salva em `group_draw_lots`
  3. **Revisar e gerar partidas**: preview da quantidade de partidas por grupo (round-robin) e botão para gerar via `rpc_generate_matches_collective`
- **Passo 2 (Estrutura) para individuais time/mark**: componente `CentralStructureHeatsTab` com 3 sub-etapas:
  1. **Definir baterias**: define atletas por bateria, preview automático (ex: 40 atletas, 8/bateria → 5 baterias), alerta para baterias com 1 atleta
  2. **Revisar alocação**: distribuição aleatória equilibrada dos atletas, mover entre baterias, remover e realocar. Salva em `competition_match_entries` (via `participant_sport_event_id`)
  3. **Confirmar**: resumo com opção de editar ou avançar para Agenda
- **Persistência heats**: fase `phase_type="heats"` + `bracket_config.match_type="heat"`, cada bateria = 1 `competition_match`, cada atleta = 1 `competition_match_entry`
- **Step status**: `useCollectiveStepStatus` suporta tanto coletivas quanto individuais time/mark, bloqueando passos subsequentes até que critérios sejam atingidos
- **RPC corrigida**: `rpc_generate_matches_collective` agora lê equipes de `group_draw_lots` por grupo (antes usava todas as equipes em todos os grupos)
- **Passo 4 (Agenda)**: agendamento de partidas com:
  - **Agendamento individual**: modal com date picker, time picker, seletor de local (venues), observações e hora de término opcional
  - **Agendamento em lote**: define data, local, hora inicial e intervalo em minutos — calcula horários sequenciais com preview antes de confirmar
  - **Detecção de conflitos**: verifica sobreposição de horário no mesmo local após cada salvamento (alerta não-bloqueante)
  - **Contador de progresso**: "X de Y partidas agendadas" com badge verde quando 100%
  - **Permissões**: admin e coordenação técnica podem agendar; secretaria visualiza apenas
  - **Remoção**: permite remover agendamento com confirmação

## 10. Apuração e Resultados (🟡 Parcial)
- **Página**: `/admin/competicao/resultados`
- **Campos**: `result_status` (resultado_lancado → publicado), `validated_at`, `published_at`
- **RLS anon**: permite SELECT onde `result_status = 'publicado'`
- **Gap**: sem workflow explícito validação → publicação no frontend

## 11. Publicação Oficial (🟡 Parcial)
- **RLS**: funcional para anon
- **Gap**: sem portal público, sem boletins em PDF

## 12. Evidências / OSC (⛔ Não iniciado)
- **Existente**: bucket `match-attachments` para anexos de partidas
- **Gap**: sem modelo genérico de evidências vinculadas a contexto operacional
