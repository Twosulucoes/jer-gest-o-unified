# 04 — Módulos Operacionais

> Auditoria atualizada em 2026-04-14

## 1. Importação / Espelhamento SIGECOM (✅ Pronto)
- **Página**: `/admin/importacao`
- **Backend**: Edge function `import-inscricoes` + RPC `import_inscricoes_batch`
- **Auditoria**: `import_logs` + `import_row_errors`
- **Comportamento**: idempotente, tolerante a falhas por linha, cria/reutiliza entidades, suporta múltiplas provas por linha
- **Perfis**: admin, secretaria (importar) | coordenacao_tecnica (visualizar logs)
- **Estados de UI**: ✅ loading, ✅ vazio, ✅ erro, ✅ sucesso parcial

## 2. Credenciamento (✅ Pronto)
- **Página**: `/admin/credenciamento`
- **Ações**: check-in (registrar presença), emitir credencial, reemitir (2ª via), batch com confirmação
- **Labels**: "Registrar presença", "Emitir credencial", "Registrar presença e emitir"
- **Status visíveis**: Pendente → Confirmado → Pronto p/ emissão → Credencial ativa
- **Bloqueios**: bloqueia credenciamento se houver irregularidades pendentes
- **Perfis**: admin, secretaria, coordenacao_tecnica
- **Estados de UI**: ✅ loading, ✅ vazio, ✅ erro

## 3. Credencial + QR Code (✅ Pronto)
- **Templates**: `/admin/credenciais/modelos` — CRUD com config de campos (🟡 editor visual parcial)
- **Geração**: client-side Canvas com QR Code via biblioteca `qrcode`
- **Utilitário**: `credentialUtils.ts` — formato único para `credential_code` e `qr_code_value`
- **Validação**: Edge function `validate-qr` + tabela `credential_scans`
- **Reemissão**: invalida anterior (status `reissued`), gera novos códigos
- **Dados reais**: 378 credenciais emitidas

## 4. Transporte (🟡 Parcial)
- **Páginas admin**: veículos, rotas, viagens, embarque por viagem
- **Páginas PWA**: home, viagens, scan, embarque, rotas
- **Tabelas**: `transport_vehicles`, `transport_routes`, `transport_trips`, `transport_passengers`
- **Perfis**: admin, secretaria, coordenacao_tecnica, transporte
- **Implementado**: ✅ CRUD de veículos, rotas, viagens | ✅ Embarque com lista de passageiros
- **Gaps**: ❌ Sem controle de retorno | ❌ Sem relatórios | ❌ Scan QR no embarque parcial
- **Dados reais**: 0 viagens cadastradas

## 5. Alimentação (🟡 Parcial)
- **Páginas admin**: tipos de refeição, janelas de serviço, registro de consumo
- **Páginas PWA**: home, scan, buscar, janelas, histórico
- **Tabelas**: `meal_types`, `meal_windows`, `meal_consumptions`
- **Perfis**: admin, secretaria, coordenacao_tecnica, alimentacao
- **Implementado**: ✅ CRUD tipos/janelas | ✅ Registro de consumo
- **Gaps**: ⚠️ Sem UNIQUE constraint `(meal_window_id, participant_id)` no banco | ❌ Sem dashboard de consumo em tempo real
- **Dados reais**: 0 consumos registrados

## 6. Alojamento (🟡 Parcial)
- **Páginas admin**: locais, unidades, ocupação
- **Páginas PWA**: home, scan, buscar, ocupação, pessoa, incidentes
- **Tabelas**: `lodging_locations`, `lodging_units`, `lodging_occupancies`
- **Trigger**: `validate_lodging_capacity` impede alocação acima da capacidade
- **Perfis**: admin, secretaria, coordenacao_tecnica, alojamento
- **Implementado**: ✅ CRUD locais/unidades | ✅ Alocação com trigger de capacidade | ✅ PWA com incidentes
- **Gaps**: ❌ Sem relatório de ocupação | ❌ Sem controle temporal de permanência
- **Dados reais**: 0 ocupações

## 7. Competição (✅ Pronto — core funcional)
- **Tabelas**: 15 tabelas (phases, groups, matches, entries, results, scores, lineups, events, penalties, officials, attachments, attempts, player_stats, discipline, match_user_assignments)
- **Páginas admin**: fases, grupos, equipes, partidas, detalhe da partida, agenda, resultados, central, painel, pré-validação, regras, regras em lote, diagnóstico, sincronizar equipes
- **Features implementadas**:
  - ✅ Wizard de 7 passos (coletivas) / 6 passos (individuais time/mark)
  - ✅ Estrutura automática de grupos com sugestão
  - ✅ Baterias/séries para individuais (distribuição automática)
  - ✅ Geração de partidas round-robin por grupo
  - ✅ Agendamento individual e em lote com detecção de conflitos
  - ✅ Lineup de jogadores
  - ✅ Eventos de jogo (gols, cartões, faltas)
  - ✅ Placar por período (match_scores)
  - ✅ Tentativas para atletismo (match_attempts)
  - ✅ Estatísticas individuais (match_player_stats)
  - ✅ Disciplina (match_discipline)
  - ✅ Oficiais e designação (match_officials, match_user_assignments)
  - ✅ Anexos de partida (match_attachments)
  - ✅ Ranking individual por bateria (IndividualRankingCard)
  - ✅ Ranking cross-heat consolidado (CrossHeatRankingCard/Tab)
  - ✅ Standings de grupo (GroupStandingsTable)
  - ✅ Painel de controle com status automático por prova
  - ✅ Pré-validação de quórum
- **Perfis**: admin, secretaria, coordenacao_tecnica, coordenador_modalidade, mesario
- **Dados reais**: 79 provas, 26 partidas, 17 resultados, 40 equipes

## 8. Motor de Regras por Prova (✅ Pronto)
- **Páginas**: `/admin/competicao/regras` (individual), `/admin/competicao/regras/lote` (massa)
- **Tabela**: `sport_event_rules` (sport_event_id, event_id, rules JSONB, is_active)
- **RPCs**: `rpc_get_sport_event_rules`, `rpc_upsert_sport_event_rules`, `rpc_seed_sport_event_rules_for_event` (seed não existe como RPC, feito via frontend)
- **Famílias**: score, sets, time, mark, combat, ranking
- **Presets**: FUTSAL, FUTEBOL_DE_CAMPO, HANDEBOL, BASQUETE, KARATE_KATA, KARATE_KUMITE
- **Dados reais**: 79 regras cadastradas (100% das provas)

## 9. Resultados e Governança (🟡 Parcial)
- **Ciclo**: `resultado_lancado` → `resultado_validado` → `publicado`
- **RPCs**: `rpc_launch_match_result`, `rpc_validate_results_for_sport_event`, `rpc_publish_results_for_sport_event`
- **Frontend**: LaunchResultDialog (wizard), ResultGovernancePanel (validar/publicar em lote), CentralResultsTab
- **Publicação**: exige boletim oficial publicado
- **RLS anon**: `result_status = 'publicado'` permite SELECT para público
- **Strings canônicas**: `src/lib/resultStatus.ts` — fonte de verdade
- **Implementado**: ✅ Lançamento pelo wizard | ✅ Validação em lote | ✅ Publicação com boletim | ✅ Auto-finish da partida
- **Gaps**: ❌ Sem portal público para consulta externa | ❌ Sem geração de boletins em PDF | 🟡 CombatResultForm não integrado automaticamente

## 10. Boletins Oficiais (🟡 Parcial)
- **Página**: `/admin/boletins`
- **Tabela**: `official_bulletins` (number, title, status, event_id)
- **RPCs**: `rpc_create_bulletin`, `rpc_publish_bulletin`
- **Implementado**: ✅ CRUD de boletins | ✅ Publicação de boletim
- **Gaps**: ❌ Sem geração de PDF | ❌ Sem vinculação automática de resultados ao boletim
- **Dados reais**: 4 boletins

## 11. PWA Operacional (🟡 Parcial)
- **Módulos**: Alojamento (7 telas), Transporte (5 telas), Alimentação (5 telas), Coordenação (6 telas), Delegação (5 telas)
- **Auth**: Supabase Auth via PWA Login
- **Features**: scan QR, busca por nome, ações operacionais
- **Gaps**: ❌ Sem proteção de rota por perfil nas rotas PWA (verificação é no nível de dados/RLS)

## 12. PWA Ao Vivo (✅ Pronto)
- **Rotas**: `/aovivo/login`, `/aovivo`, `/aovivo/partida/:matchId`
- **Features**: interface touch-friendly, dark mode, suporte offline (localStorage), sincronização automática, cronômetro, placar automático
- **Acesso**: restrito via `match_user_assignments` (mesários designados)

## 13. Publicação Oficial (🟡 Parcial)
- **RLS**: funcional para anon (SELECT WHERE `result_status = 'publicado'`)
- **Edge Functions**: `public-events` e `public-results`
- **Gaps**: ❌ Sem portal público para consulta | ❌ Sem boletins PDF | ❌ Sem quadro de medalhas

## 14. Evidências / OSC (⛔ Não iniciado)
- **Existente**: bucket `match-attachments` para anexos de partidas
- **Gaps**: ❌ Sem modelo genérico de evidências | ❌ Sem bucket dedicado | ❌ Sem metadados OSC

## 15. Configurações (✅ Pronto)
- Parâmetros do Evento: limites de participação por atleta
- Irregularidades: detecção e resolução
- Normalização de Provas: mapeamento de aliases
- Validador de Estrutura: comparação schema vs planilha
- Mapa do Sistema: visão geral de todos os módulos

## 16. Acessos (🟡 Parcial)
- **Páginas**: `/admin/acessos/usuarios`, `/admin/acessos/delegacoes`
- **Tabelas**: `user_roles`, `user_delegations`, `user_sport_links`
- **Implementado**: ✅ Gestão de perfis por usuário | ✅ Vínculos delegação
- **Gaps**: ❌ Sem convite por e-mail | ❌ Sem log de alterações de vínculo

## 17. Pesquisa de Satisfação (🟡 Parcial)
- **Páginas admin**: dashboard, eventos, pesquisadores
- **Páginas PWA**: login (PIN), home, nova, confirmação
- **Tabelas**: `pesquisa_events`, `pesquisa_researchers`, `pesquisa_sessions`, `pesquisa_surveys`
- **Implementado**: ✅ CRUD | ✅ PWA com PIN | ✅ Sessões offline
- **Gaps**: ❌ Relatórios consolidados

## 18. Links e Páginas Públicas (✅ Pronto)
- **Páginas admin**: CRUD de links e preview
- **Rotas públicas**: `/go/:slug` (redirect), `/p/:slug` (página), `/a/:token` (perfil atleta)
- **Tabela**: `public_content`

## 19. Relatórios (🟡 Parcial)
- **Página**: `/admin/relatorios`
- **Engine**: framework de relatórios com filtros, colunas, presets
- **Renderers**: PDF (@react-pdf/renderer) e Excel (exceljs)
- **Definições**: `sample.delegationRoster`, `sample.resultsByGroup`
- **Gaps**: ❌ Poucos relatórios definidos | ❌ Falta relatórios operacionais (transporte, alimentação)
