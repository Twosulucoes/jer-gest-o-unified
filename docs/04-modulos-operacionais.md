# 04 — Módulos Operacionais

> Auditoria atualizada em 2026-04-26 (Interfaces Administrativas, Lote e OSC)

## 1. Importação / Espelhamento SIGECOM (✅ Pronto)
- **Página**: `/admin/importacao`
- **Backend**: Edge function `import-inscricoes` + RPC `import_inscricoes_batch`
- **Auditoria**: `import_logs` + `import_row_errors`
- **Comportamento**: idempotente, tolerante a falhas por linha, cria/reutiliza entidades, suporta múltiplas provas por linha
- **Perfis**: admin, secretaria (importar) | coordenacao_tecnica (visualizar logs)

## 2. Credenciamento (✅ Pronto)
- **Página**: `/admin/credenciamento` e `/admin/credenciamento/seguro`
- **Ações**: check-in (registrar presença), emitir credencial, reemitir (2ª via), batch com confirmação
- **Segurança**: Assinatura HMAC-SHA256 do QR Code via Edge Function `generate-credential-qr` (v2).
- **Validação**: Edge function `validate-qr` valida assinatura HMAC; aceita legado com flag `legacy_format` em `credential_scans`.

## 3. Credencial + QR Code (✅ Pronto)
- **Templates**: `/admin/credenciais/modelos` — CRUD com config de campos e filtro por tipo de participante (Atleta, Técnico, Staff, etc).
- **Geração**: Chamada à Edge Function `generate-credential-qr` para QR assinado.
- **Utilitário**: `credentialUtils.ts` — suporte a `generateSignedQrCodeValue` (async).
- **Auditoria**: `credential_scans` agora rastreia se a credencial é do formato legado.

## 4. Transporte (✅ Pronto — 90%)
- **Páginas admin**: veículos, rotas, viagens, embarque por viagem, **relatórios** (`/admin/transporte/relatorios`)
- **Evidências**: Suporte a upload de diários de bordo e fotos de embarque no bucket `operational-evidence`.

## 5. Alimentação (✅ Pronto — 100%)
- **Controle de Acesso**: Tabela `meal_window_eligibility` permite restringir janelas por Delegação, Instituição ou Perfil de Participante.
- **Interface Admin**: Gestor de regras integrado na edição de janelas (`/admin/alimentacao/janelas`).
- **Validação**: Trigger `trg_validate_meal_consumption_eligibility` bloqueia consumos não autorizados.
- **Evidências**: Registro de listas de presença e fotos de buffet vinculadas às janelas.

## 6. Alojamento (✅ Pronto — 100%)
- **Alocação em Lote**: Rota `/admin/alojamento/alocacao-lote` com wizard para alocar delegações inteiras respeitando gênero e capacidade.
- **Segurança de Gênero**: Trigger `trg_validate_lodging_gender` impede alocação de participantes em unidades com restrição de gênero incompatível.
- **Evidências**: Checklists de entrada/saída e fotos de vistorias centralizadas.

## 7. Competição (✅ Pronto — Refatoração Etapa 3: Painel Combat)
- **Tabelas**: 15 tabelas (phases, groups, matches, entries, results, scores, lineups, events, penalties, officials, attachments, attempts, player_stats, discipline, match_user_assignments)
- **Páginas admin**: painel (entry point), painel-score, painel-sets, painel-combat, painel-time-mark (novo), fases, grupos, equipes, partidas, detalhe da partida, agenda, resultados, central, pré-validação, regras, regras em lote, diagnóstico, sincronizar equipes
- **Painel Score, Sets, Combat, Time/Mark & Ranking (Pronto)**:
  - ✅ Lista modalidades das famílias "score", "sets", "combat", "time", "mark" e "ranking"
  - ✅ Cards operacionais com contagem adaptada (Categorias, Atletas, Lutas, Séries, Provas)
  - ✅ Painel Combat dedicado com seletor de categoria de peso e pesagem oficial
  - ✅ Painel Time/Mark dedicado com gestão de séries, raias e distribuição automática
  - ✅ Painel Ranking dedicado para Kata, Ginástica Rítmica e Xadrez com grade Spreadsheet
  - ✅ **Lançamento Ranking (Etapa 10 concluída)**: Rota dedicada, grade de lançamento de pontuação final por participante, cálculo automático de classificação (1-1-3), suporte a status DNS/DSQ e homologação integrada.
  - ✅ **Lançamento Time/Mark (Correções Críticas Etapa 9)**: Rota dedicada, 3 modos de lançamento (Pista/Piscina, Campo/Tentativas, Prova Única/Ranking), cálculo automático de posição por melhor marca com tratamento de empate (1, 1, 3), persistência real de múltiplas tentativas em `match_attempts`, validação de payload por modo e prevenção de duplicidades manuais no Modo C.
  - ✅ **Propagação Time/Mark (Correções Críticas Etapa 9)**: Tela de classificação consolidada da fase com sugestão automática; propagação manual via RPC `rpc_propagate_classification_time_mark` com distribuição em "serpentina" nas séries da fase seguinte e registro de histórico de classificação.
  - ✅ **Lançamento Combat (Etapa 7 concluída)**: Rota dedicada, placar dinâmico, prorrogação, métodos de vitória, propagação automática no bracket.
  - ✅ **Lançamento Sets (Etapa 6 concluída)**: Rota dedicada, placar dinâmico por sets, cômputo automático de W.O. e Desistência.
- **Features legadas (reaproveitadas)**:
  - ✅ Wizard de 8 passos (coletivas) / 7 passos (individuais time/mark)
  - ✅ Estrutura automática de grupos com sugestão
  - ✅ Baterias/séries para individuais (distribuição automática)
  - ✅ Geração de partidas round-robin por grupo
  - ✅ Agendamento individual e em lote com detecção de conflitos
  - ✅ Lineup de jogadores, eventos de jogo, placar por período
  - ✅ Auditoria de ações por modalidade (`CentralAuditTab`)
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

## 9. Resultados e Governança (✅ Pronto)
- **Ciclo**: `resultado_lancado` → `resultado_validado` → `publicado`
- **RPCs**: `rpc_launch_match_result`, `rpc_homologate_match_result` (sem senha), `rpc_publish_match_result`, `rpc_revert_match_result_status`
- **Frontend**: 
  - ✅ **Central de Publicação** (`/admin/competicao/publicacao`): Tela operacional para secretaria com publicação individual/lote e auditoria.
  - ✅ **Homologação Real com Senha**: Botão chama Edge Function `verify-current-user-password` para autenticação real do coordenador antes de acionar a RPC de homologação.
  - ✅ **Indicadores de Ciclo**: Badges padronizados (Agendado → Em Andamento → Lançado → Validado → Publicado).
  - ✅ **Reversão Admin**: Fluxo de exceção para administradores corrigirem status com diálogos Shadcn UI e justificativa obrigatória.
- **RLS**: funcional para anon (SELECT WHERE `result_status = 'publicado'`)
- **Implementado**: ✅ Lançamento pelo wizard | ✅ Lançamento dedicado Score/Sets/Combat/Time-Mark Pages | ✅ Homologação com senha real | ✅ Publicação Centralizada | ✅ Reversão de status | ✅ Auditoria completa (tabela history + audit_events)

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

## 14. Evidências / OSC (✅ Pronto)
- **Interface Admin**: Rota `/admin/evidencias-osc` para gestão centralizada de provas operacionais.
- **Ações**: Upload por módulo, filtragem avançada, fluxo de aprovação/rejeição com auditoria (reviewed_by).
- **Tabela**: `operational_evidence` — Modelo unificado para todos os módulos.
- **Bucket**: `operational-evidence` — Privado com RLS segmentado.

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
- Hook `useDashboardData` with staleTime 30s, botão "Atualizar dados"

### Etapa 3 — Quadro de Medalhas e Classificação Geral (✅)
- Página `/admin/relatorios/quadro-medalhas` (admin/secretaria/coordenacao_tecnica)
- Critério olímpico (ouro → prata → bronze) e tabela Art. 108 (1º=10, 2º=8, 3º=6, 4º=5, 5º=4, 6º=3, 7º=2, 8º=1)
- Desempate Art. 111 (total → ouros → pratas → bronzes → coletivas)
- Filtros JER/JERPA/Tipo, banner de dados parciais, exportação PDF/XLSX com selo OFICIAL/PARCIAL

### Etapa 4 — Prestação de Contas OSC (🟡 Em breve)
- Relatório formal consolidado para Governo RR, IDJUV e Acolher
