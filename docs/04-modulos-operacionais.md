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

## 4. Transporte (✅ Pronto — 85%)
- **Páginas admin**: veículos, rotas, viagens, embarque por viagem, **relatórios** (`/admin/transporte/relatorios`)
- **Páginas PWA**: home, viagens, scan, embarque, rotas
- **Tabelas**: `transport_vehicles`, `transport_routes`, `transport_trips`, `transport_passengers`
- **Perfis**: admin, secretaria, coordenacao_tecnica, transporte
- **Implementado**: ✅ CRUD de veículos, rotas, viagens | ✅ Embarque com lista de passageiros | ✅ Relatório exportável CSV com filtros por data/rota/veículo
- **Gaps**: ❌ Sem controle de retorno | ⚠️ Scan QR no embarque parcial
- **Dados reais**: 0 viagens cadastradas

## 5. Alimentação (✅ Pronto — 100%)
- **Páginas admin**: tipos de refeição, janelas de serviço, registro de consumo, **dashboard tempo real** (`/admin/alimentacao/dashboard`), **relatórios** (`/admin/alimentacao/relatorios`)
- **Páginas PWA**: home, scan, buscar, janelas, histórico
- **Tabelas**: `meal_types`, `meal_windows`, `meal_consumptions`
- **Perfis**: admin, secretaria, coordenacao_tecnica, alimentacao
- **Implementado**: ✅ CRUD tipos/janelas | ✅ Registro de consumo | ✅ Dashboard com auto-refresh 30s | ✅ Relatório exportável CSV com totalizadores por delegação e tipo
- **Gaps**: Nenhum bloqueante
- **Dados reais**: 0 consumos registrados

## 6. Alojamento (✅ Pronto — 85%)
- **Páginas admin**: locais, unidades, ocupação, **relatórios** (`/admin/alojamento/relatorios`)
- **Páginas PWA**: home, scan, buscar, ocupação, pessoa, incidentes
- **Tabelas**: `lodging_locations`, `lodging_units`, `lodging_occupancies`
- **Trigger**: `validate_lodging_capacity` impede alocação acima da capacidade
- **Perfis**: admin, secretaria, coordenacao_tecnica, alojamento
- **Implementado**: ✅ CRUD locais/unidades | ✅ Alocação com trigger de capacidade | ✅ PWA com incidentes | ✅ Relatório com gráfico de ocupação e exportação CSV
- **Gaps**: ❌ Sem controle temporal de permanência
- **Dados reais**: 0 ocupações

## 7. Competição (✅ Pronto — core funcional)
- **Tabelas**: 15 tabelas (phases, groups, matches, entries, results, scores, lineups, events, penalties, officials, attachments, attempts, player_stats, discipline, match_user_assignments)
- **Páginas admin**: fases, grupos, equipes, partidas, detalhe da partida, agenda, resultados, central, painel, pré-validação, regras, regras em lote, diagnóstico, sincronizar equipes
- **Features implementadas**:
  - ✅ Wizard de 8 passos (coletivas) / 7 passos (individuais time/mark) — inclui aba Auditoria
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
  - ✅ **Transição automática de fases**: quando todos os resultados de uma fase são publicados, a fase muda para `finished` e a próxima inicia automaticamente.
  - ✅ **Resultado inline por confronto**: `MatchResultInlineCard` permite lançar resultado, placar e vencedor diretamente no montador de disputas, com status: agendado, em andamento, encerrado, homologado, cancelado.
  - ✅ **Progressão manual de vencedores**: `WinnerProgressionPanel` exibe vencedores de fases anteriores como itens arrastáveis para slots da próxima fase (drag and drop via @dnd-kit). Trilha de origem visível.
  - ✅ **Aba Auditoria**: `CentralAuditTab` — linha do tempo de ações por modalidade com filtros por tipo (montagem, resultado, publicação, homologação, progressão, agenda) e período. Exibe autor, data/hora e resumo legível. Exportável em CSV.
- **Perfis**: admin, secretaria, coordenacao_tecnica, coordenador_modalidade, mesario
- **Dados reais**: 79 provas, 26 partidas, 17 resultados, 40 equipes

## 8. Motor de Regras por Prova (✅ Pronto)
- **Páginas**: `/admin/competicao/regras` (individual), `/admin/competicao/regras/lote` (massa)
- **Tabela**: `sport_event_rules` (sport_event_id, event_id, rules JSONB, is_active)
- **RPCs**: `rpc_get_sport_event_rules`, `rpc_upsert_sport_event_rules`, `rpc_seed_sport_event_rules_for_event`
- **Famílias**: score, sets, time, mark, combat, ranking
- **Catálogo**: 22 presets em 6 categorias (coletivas, combate, tempo/marca, sets, ranking, paralímpicas). Arquivo: `src/config/sportPresetCatalog.ts`
- **Presets JER**: FUTSAL, FUTEBOL, HANDEBOL, BASQUETEBOL, VOLEIBOL, VOLEI_DE_PRAIA_12_14, VOLEI_DE_PRAIA_15_17, JUDO, KARATE_KATA, KARATE_KUMITE, TAEKWONDO, WRESTLING, ATLETISMO_PISTA, ATLETISMO_CAMPO, ATLETISMO_COMBINADAS, NATACAO, CICLISMO, BADMINTON, TENIS_DE_MESA, TIRO_COM_ARCO, XADREZ, GINASTICA_RITMICA
- **Presets JERPA**: ATLETISMO_PARALIMPICO, NATACAO_PARALIMPICA, TENIS_DE_MESA_PARALIMPICO, PARABADMINTON, BOCHA_PARALIMPICA
- **Interface lote**: painel de cobertura com barra de progresso, filtros por modalidade/família/status/JER-JERPA/categoria, indicador visual de origem (seed vs manual), controle de permissão por perfil
- **Permissões**: admin (total), coordenacao_tecnica (editar + seed missing_only), secretaria (somente visualização)
- **Dados reais**: 79 regras cadastradas (100% das provas)

## 9. Resultados e Governança (🟡 Parcial)
- **Ciclo**: `resultado_lancado` → `resultado_validado` → `publicado`
- **RPCs**: `rpc_launch_match_result`, `rpc_validate_results_for_sport_event`, `rpc_publish_results_for_sport_event`
- **Frontend**: LaunchResultDialog (wizard), ResultGovernancePanel (validar/publicar em lote), CentralResultsTab, **MatchResultInlineCard** (inline no montador), **WinnerProgressionPanel** (drag-and-drop para próxima fase), **HomologarClassificadoCard** (classificação direta de único apto)
- **Publicação**: exige boletim oficial publicado
- **RLS anon**: `result_status = 'publicado'` permite SELECT para público
- **Strings canônicas**: `src/lib/resultStatus.ts` — fonte de verdade
- **Implementado**: ✅ Lançamento pelo wizard | ✅ Lançamento inline por confronto | ✅ Progressão manual de vencedores | ✅ Validação em lote | ✅ Publicação com boletim | ✅ Auto-finish da partida | ✅ Auditoria de resultados e movimentações | ✅ Homologação de classificado direto (único apto)
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

## 19. Relatórios (🟡 85%)
- **Página hub**: `/admin/relatorios` (cards dos relatórios oficiais)
- **Engine legada**: framework com filtros, colunas, presets em `/admin/relatorios/central`
- **Renderers**: PDF (@react-pdf/renderer) e Excel (exceljs)
- **Presets persistentes**: tabela `report_presets` + componente `ReportPresets` (salvar/aplicar/excluir filtros por usuário)

### Camada 0 — Fundação (✅)
- **Identidade Visual por evento** em `/admin/configuracoes/identidade-visual`
- Tabela `event_branding`, bucket `report-assets`
- Componentes `ReportHeader`, `ReportFooter`, `ReportShell` + hook `useEventBranding`

### Etapa 1 — Boletins por Modalidade (✅)
- Página `/admin/relatorios/boletins` com filtros em cascata (Modalidade → Categoria → Gênero → Fase)
- 5 layouts adaptativos por família: `BulletinScore`, `BulletinSets`, `BulletinCombat`, `BulletinTimeMark`, roteador `BulletinRouter`
- Exportação PDF e XLSX multi-aba

### Etapa 2 — Dashboard Operacional (✅)
- Página `/admin/relatorios/dashboard` com 6 KPIs, gráficos recharts, exportação PDF
- Hook `useDashboardData` com staleTime 30s, botão "Atualizar dados"

### Etapa 3 — Quadro de Medalhas e Classificação Geral (✅)
- Página `/admin/relatorios/quadro-medalhas` (admin/secretaria/coordenacao_tecnica)
- Critério olímpico (ouro → prata → bronze) e tabela Art. 108 (1º=10, 2º=8, 3º=6, 4º=5, 5º=4, 6º=3, 7º=2, 8º=1)
- Desempate Art. 111 (total → ouros → pratas → bronzes → coletivas)
- Filtros JER/JERPA/Tipo, banner de dados parciais, exportação PDF/XLSX com selo OFICIAL/PARCIAL

### Etapa 4 — Prestação de Contas OSC (🟡 Em breve)
- Relatório formal consolidado para Governo RR, IDJUV e Acolher
