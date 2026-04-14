# Inventário Completo — JER Gestão

**Data:** 2026-04-14  
**Objetivo:** Auditoria completa antes de refatoração de navegação.

---

## SEÇÃO 1 — ROTAS E PÁGINAS ADMIN (prefixo /admin)

### 1.1 Dashboard
| Rota | Componente | Descrição | Perfis | Status | Dependências |
|------|-----------|-----------|--------|--------|-------------|
| `/admin` | `DashboardPage.tsx` | Dashboard principal com KPIs do evento ativo | Todos autenticados | Completo | events, participants, competition_matches |

### 1.2 Preparação
| Rota | Componente | Descrição | Perfis | Status | Dependências |
|------|-----------|-----------|--------|--------|-------------|
| `/admin/eventos` | `EventosPage.tsx` | CRUD de edições do JER (ano, datas, status) | admin, secretaria, coord_tecnica | Completo | events |
| `/admin/instituicoes` | `InstituicoesPage.tsx` | Cadastro de escolas/instituições | admin, secretaria, coord_tecnica | Completo | institutions |
| `/admin/delegacoes` | `DelegacoesPage.tsx` | Gerencia delegações do evento ativo | admin, secretaria, coord_tecnica | Completo | delegations, institutions, participants |
| `/admin/delegacoes/:delegationId` | `DelegacaoDetalhePage.tsx` | Detalhes de uma delegação com tabs (resumo, participantes, esportivo, logística, credenciamento) | admin, secretaria, coord_tecnica | Completo | delegations, participants, people |
| `/admin/participantes` | `ParticipantesPage.tsx` | Lista todos os participantes com filtros | admin, secretaria, coord_tecnica | Completo | participants, people, delegations |
| `/admin/participantes/:participantId` | `ParticipanteDetalhePage.tsx` | Detalhes do participante com tabs (resumo, logística, credencial, histórico) | admin, secretaria, coord_tecnica | Completo | participants, people |
| `/admin/participantes/:participantId/esportivo` | `ParticipanteHistoricoPage.tsx` | Histórico esportivo completo do participante | admin, secretaria, coord_tecnica | Completo | participant_sport_events |

### 1.3 Importação e Dados
| Rota | Componente | Descrição | Perfis | Status | Dependências |
|------|-----------|-----------|--------|--------|-------------|
| `/admin/importacao` | `ImportacaoPage.tsx` | Upload de planilha XLSX (SIGECOM) | admin, secretaria | Completo | import_logs, import_row_errors |
| `/admin/dados` | `CentralDadosPage.tsx` | Central de dados — contadores e integridade | admin, secretaria, coord_tecnica | Completo | múltiplas tabelas |
| `/admin/normalizacao-provas` | `NormalizacaoProvasPage.tsx` | Mapeia nomes importados para provas canônicas | admin, secretaria, coord_tecnica | Completo | sport_events |
| `/admin/irregularidades` | `IrregularidadesPage.tsx` | Irregularidades detectadas (excesso de inscrições, idade) | admin, secretaria, coord_tecnica | Completo | participation_irregularities |

### 1.4 Credenciamento
| Rota | Componente | Descrição | Perfis | Status | Dependências |
|------|-----------|-----------|--------|--------|-------------|
| `/admin/credenciamento` | `CredenciamentoPage.tsx` | Busca participante e ativa credencial | admin, secretaria, coord_tecnica | Completo | participant_credentials |
| `/admin/validacao-qr` | `ValidacaoQRPage.tsx` | Leitura de QR para validação em pontos de controle | admin, secretaria, coord_tecnica, transporte, alimentacao | Completo | credential_scans |
| `/admin/credenciais/modelos` | `CredencialModelosPage.tsx` | CRUD de templates visuais para credenciais | admin, secretaria, coord_tecnica | Parcial | credential_templates |
| `/admin/atletas/qrcode` | `AtletaQrCodePage.tsx` | Geração de QR code para atletas | admin, secretaria | Completo | participants, credentials |

### 1.5 Transporte (admin)
| Rota | Componente | Descrição | Perfis | Status | Dependências |
|------|-----------|-----------|--------|--------|-------------|
| `/admin/transporte/veiculos` | `TransporteVeiculosPage.tsx` | Cadastro de veículos | admin, secretaria, coord_tecnica, transporte | Parcial | transport_vehicles |
| `/admin/transporte/rotas` | `TransporteRotasPage.tsx` | Define rotas de transporte | admin, secretaria, coord_tecnica, transporte | Parcial | transport_routes |
| `/admin/transporte/viagens` | `TransporteViagensPage.tsx` | Agenda viagens | admin, secretaria, coord_tecnica, transporte | Parcial | transport_trips, transport_passengers |
| `/admin/transporte/embarque/:tripId` | `TransporteEmbarquePage.tsx` | Embarque por viagem específica | admin, secretaria, coord_tecnica, transporte | Parcial | transport_passengers |
| `/admin/transporte/relatorios` | `TransporteRelatoriosPage.tsx` | Relatórios de transporte | admin, secretaria, coord_tecnica, transporte | Parcial | transport_* |

### 1.6 Alimentação (admin)
| Rota | Componente | Descrição | Perfis | Status | Dependências |
|------|-----------|-----------|--------|--------|-------------|
| `/admin/alimentacao/tipos` | `AlimentacaoTiposPage.tsx` | Cadastro de tipos de refeição | admin, secretaria, coord_tecnica, alimentacao | Completo | meal_types |
| `/admin/alimentacao/janelas` | `AlimentacaoJanelasPage.tsx` | Janelas de serviço por refeição/dia | admin, secretaria, coord_tecnica, alimentacao | Completo | meal_windows |
| `/admin/alimentacao/consumo` | `AlimentacaoConsumoPage.tsx` | Registro de consumo de refeições | admin, secretaria, coord_tecnica, alimentacao | Parcial | meal_consumptions |
| `/admin/alimentacao/dashboard` | `AlimentacaoDashboardPage.tsx` | Dashboard de alimentação | admin, secretaria, coord_tecnica, alimentacao | Parcial | meal_consumptions, meal_windows |
| `/admin/alimentacao/relatorios` | `AlimentacaoRelatoriosPage.tsx` | Relatórios de alimentação | admin, secretaria, coord_tecnica, alimentacao | Parcial | meal_consumptions |

### 1.7 Alojamento (admin)
| Rota | Componente | Descrição | Perfis | Status | Dependências |
|------|-----------|-----------|--------|--------|-------------|
| `/admin/alojamento/locais` | `AlojamentoLocaisPage.tsx` | Cadastro de locais de alojamento | admin, secretaria, coord_tecnica | Completo | lodging_locations |
| `/admin/alojamento/unidades` | `AlojamentoUnidadesPage.tsx` | Unidades (quartos/salas) por local | admin, secretaria, coord_tecnica | Completo | lodging_units |
| `/admin/alojamento/ocupacao` | `AlojamentoOcupacaoPage.tsx` | Alocação e check-in/check-out | admin, secretaria, coord_tecnica | Parcial | lodging_occupancies |
| `/admin/alojamento/relatorios` | `AlojamentoRelatoriosPage.tsx` | Relatórios de alojamento | admin, secretaria, coord_tecnica | Parcial | lodging_* |

### 1.8 Competição (admin)
| Rota | Componente | Descrição | Perfis | Status | Dependências |
|------|-----------|-----------|--------|--------|-------------|
| `/admin/competicao/painel` | `CompeticaoPainelPage.tsx` | Visão consolidada do progresso de provas | admin, secretaria, coord_tecnica | Completo | sport_events, competition_* |
| `/admin/competicao/pre-validacao` | `PreValidacaoPage.tsx` | Valida quórum antes de liberar provas | admin, secretaria, coord_tecnica | Completo | sport_events, participant_sport_events |
| `/admin/competicao/central` | `CompeticaoCentralPage.tsx` | Hub operacional — wizard de prova completo | admin, secretaria, coord_tecnica | Completo | competition_* |
| `/admin/competicao/regras` | `RegrasProvaPage.tsx` | Regras por prova (pontuação, critérios) | admin, secretaria, coord_tecnica | Completo | sport_event_rules |
| `/admin/competicao/regras/lote` | `RegrasLotePage.tsx` | Aplicação de regras em lote | admin, secretaria, coord_tecnica | Completo | sport_event_rules |
| `/admin/modalidades` | `ModalidadesPage.tsx` | CRUD de modalidades esportivas | admin, secretaria, coord_tecnica | Completo | sports, sport_events |
| `/admin/categorias` | `CategoriasPage.tsx` | CRUD de categorias (faixa etária/gênero) | admin, secretaria, coord_tecnica | Completo | categories |
| `/admin/competicao/equipes` | `CompeticaoEquipesPage.tsx` | Equipes por modalidade coletiva | admin, secretaria, coord_tecnica | Parcial | teams, team_members |
| `/admin/competicao/fases` | `CompeticaoFasesPage.tsx` | Fases de competição | admin, secretaria, coord_tecnica | Parcial | competition_phases |
| `/admin/competicao/grupos` | `CompeticaoGruposPage.tsx` | Grupos dentro de fases | admin, secretaria, coord_tecnica | Parcial | competition_groups |
| `/admin/competicao/partidas` | `CompeticaoPartidasPage.tsx` | Lista de partidas/confrontos | admin, secretaria, coord_tecnica | Parcial | competition_matches |
| `/admin/competicao/agenda` | `CompeticaoAgendaPage.tsx` | Calendário/timeline de partidas | admin, secretaria, coord_tecnica | Parcial | competition_matches, venues |
| `/admin/competicao/partida/:matchId` | `CompeticaoPartidaDetalhePage.tsx` | Detalhes de partida (escalação, eventos, resultados) | admin, secretaria, coord_tecnica, mesario | Completo | competition_matches, match_lineups, match_events |
| `/admin/competicao/resultados` | `CompeticaoResultadosPage.tsx` | Lançamento e publicação de resultados | admin, secretaria, coord_tecnica | Parcial | competition_match_results |
| `/admin/competicao/sincronizar-equipes` | `SincronizarEquipesPage.tsx` | Sincroniza equipes entre provas | admin, secretaria, coord_tecnica | Parcial | teams |
| `/admin/boletins` | `BoletinsPage.tsx` | Geração de boletins oficiais PDF | admin, secretaria, coord_tecnica | Completo | official_bulletins |

### 1.9 Pesquisa de Satisfação (admin)
| Rota | Componente | Descrição | Perfis | Status | Dependências |
|------|-----------|-----------|--------|--------|-------------|
| `/admin/pesquisa` | `PesquisaDashboardPage.tsx` | Dashboard de pesquisas | admin, secretaria | Completo | pesquisa_* |
| `/admin/pesquisa/eventos` | `PesquisaEventosPage.tsx` | Eventos de pesquisa | admin, secretaria | Completo | pesquisa_events |
| `/admin/pesquisa/pesquisadores` | `PesquisaPesquisadoresPage.tsx` | Cadastro de pesquisadores | admin, secretaria | Completo | pesquisa_researchers |

### 1.10 Configurações e Sistema
| Rota | Componente | Descrição | Perfis | Status | Dependências |
|------|-----------|-----------|--------|--------|-------------|
| `/admin/parametros-evento` | `ParametrosEventoPage.tsx` | Limites de participação do evento | admin, secretaria, coord_tecnica | Completo | event_participation_rules |
| `/admin/locais` | `LocaisPage.tsx` | Locais de competição (ginásios, quadras) | admin, secretaria, coord_tecnica | Completo | venues |
| `/admin/acessos/usuarios` | `AcessosUsuariosPage.tsx` | Gestão de usuários operacionais | admin, secretaria | Completo | profiles, user_roles |
| `/admin/acessos/delegacoes` | `AcessosDelegacoesPage.tsx` | Vínculos usuário-delegação | admin, secretaria | Parcial | user_roles, delegations |
| `/admin/schema/validador` | `SchemaValidadorPage.tsx` | Compara planilha vs schema Supabase | admin, secretaria | Completo | — |
| `/admin/mapa` | `MapaSistemaPage.tsx` | Visão geral de módulos com status | admin, secretaria, coord_tecnica | Completo | systemMap config |
| `/admin/diagnostico-competicao` | `DiagnosticoCompeticaoPage.tsx` | Auditoria técnica da competição | admin, coord_tecnica | Completo | múltiplas tabelas |
| `/admin/demo` | `DemoSeedsPage.tsx` | Seeds de demonstração | admin, coord_tecnica | Completo | — |
| `/admin/auth/email-templates` | `EmailTemplatesPage.tsx` | Templates de e-mail | admin, secretaria, coord_tecnica | Parcial | — |
| `/admin/links` | `LinksPage.tsx` | Lista links compartilháveis | admin, secretaria | Completo | links |
| `/admin/links/novo` | `LinkFormPage.tsx` | Criar novo link | admin, secretaria | Completo | links |
| `/admin/links/:id` | `LinkFormPage.tsx` | Editar link existente | admin, secretaria | Completo | links |
| `/admin/links/preview/:id` | `LinkPreviewPage.tsx` | Preview de link público | admin, secretaria | Completo | links |
| `/admin/relatorios` | `ReportCenterPage.tsx` | Central de relatórios (PDF/Excel) | admin, secretaria, coord_tecnica | Completo | report definitions |

**Total de rotas admin: 52**

---

## SEÇÃO 2 — ROTAS E PÁGINAS PWA (prefixo /pwa)

### 2.1 Autenticação e Navegação
| Rota | Componente | Descrição | Perfil | Status |
|------|-----------|-----------|--------|--------|
| `/pwa/login` | `PwaLoginPage.tsx` | Login PWA (email + senha) | Público | Completo |
| `/pwa/recover` | `PwaRecoverPage.tsx` | Recuperação de senha | Público | Completo |
| `/pwa/set-password` | `PwaSetPasswordPage.tsx` | Definir nova senha | Público | Completo |
| `/pwa` | `PwaLandingPage.tsx` | Landing — redireciona por perfil | Autenticado | Completo |
| `/pwa/:module` | `PwaModulePage.tsx` | Router dinâmico de módulos | Autenticado | Completo |
| `/pwa/acesso-negado` | `PwaAcessoNegadoPage.tsx` | Tela de acesso negado | Autenticado | Completo |

### 2.2 Alojamento (perfil: alojamento)
| Rota | Componente | Descrição | Status |
|------|-----------|-----------|--------|
| `/pwa/alojamento` | `AlojamentoHomePage.tsx` | Home do módulo alojamento | Completo |
| `/pwa/alojamento/scan` | `AlojamentoScanPage.tsx` | Scanner QR para check-in/out | Completo |
| `/pwa/alojamento/buscar` | `AlojamentoBuscarPage.tsx` | Busca de participante por nome | Completo |
| `/pwa/alojamento/ocupacao` | `AlojamentoOcupacaoPage.tsx` | Visualização de ocupação | Completo |
| `/pwa/alojamento/pessoa/:id` | `AlojamentoPessoaPage.tsx` | Detalhes de pessoa alocada | Completo |
| `/pwa/alojamento/incidentes` | `AlojamentoIncidentesPage.tsx` | Lista de incidentes | Completo |
| `/pwa/alojamento/incidentes/nova` | `AlojamentoNovoIncidentePage.tsx` | Registrar novo incidente | Completo |

### 2.3 Transporte (perfil: transporte)
| Rota | Componente | Descrição | Status |
|------|-----------|-----------|--------|
| `/pwa/transporte` | `TransporteHomePage.tsx` | Home do módulo transporte | Completo |
| `/pwa/transporte/viagens` | `TransporteViagensPage.tsx` | Lista de viagens | Completo |
| `/pwa/transporte/scan` | `TransporteScanPage.tsx` | Scanner QR para embarque | Completo |
| `/pwa/transporte/embarque` | `TransporteEmbarquePage.tsx` | Registro de embarque | Completo |
| `/pwa/transporte/rotas` | `TransporteRotasPage.tsx` | Consulta de rotas | Completo |

### 2.4 Alimentação (perfil: alimentacao)
| Rota | Componente | Descrição | Status |
|------|-----------|-----------|--------|
| `/pwa/alimentacao` | `AlimentacaoHomePage.tsx` | Home do módulo alimentação | Completo |
| `/pwa/alimentacao/scan` | `AlimentacaoScanPage.tsx` | Scanner QR para consumo | Completo |
| `/pwa/alimentacao/buscar` | `AlimentacaoBuscarPage.tsx` | Busca de participante | Completo |
| `/pwa/alimentacao/janelas` | `AlimentacaoJanelasPage.tsx` | Consulta janelas ativas | Completo |
| `/pwa/alimentacao/historico` | `AlimentacaoHistoricoPage.tsx` | Histórico de consumos | Completo |

### 2.5 Coordenação Técnica (perfil: coordenacao_tecnica)
| Rota | Componente | Descrição | Status |
|------|-----------|-----------|--------|
| `/pwa/coordenacao-tecnica` | `CoordenacaoHomePage.tsx` | Home da coordenação | Completo |
| `/pwa/coordenacao-tecnica/agenda` | `CoordenacaoAgendaPage.tsx` | Agenda de partidas | Completo |
| `/pwa/coordenacao-tecnica/partidas` | `CoordenacaoPartidasPage.tsx` | Lista de partidas | Completo |
| `/pwa/coordenacao-tecnica/partida/:matchId` | `CoordenacaoPartidaDetalhePage.tsx` | Detalhe de partida | Completo |
| `/pwa/coordenacao-tecnica/resultados` | `CoordenacaoResultadosPage.tsx` | Resultados | Completo |
| `/pwa/coordenacao-tecnica/estatisticas` | `CoordenacaoEstatisticasPage.tsx` | Estatísticas | Completo |

### 2.6 Delegação (perfil: delegacao)
| Rota | Componente | Descrição | Status |
|------|-----------|-----------|--------|
| `/pwa/delegacao` | `DelegacaoHomePage.tsx` | Home da delegação | Completo |
| `/pwa/delegacao/participantes` | `DelegacaoParticipantesPage.tsx` | Participantes da delegação | Completo |
| `/pwa/delegacao/agenda` | `DelegacaoAgendaPage.tsx` | Agenda da delegação | Completo |
| `/pwa/delegacao/logistica` | `DelegacaoLogisticaPage.tsx` | Logística (transporte, alimentação, alojamento) | Completo |
| `/pwa/delegacao/locais` | `DelegacaoLocaisPage.tsx` | Locais de competição | Completo |

### 2.7 Pesquisa (autenticação por PIN)
| Rota | Componente | Descrição | Status |
|------|-----------|-----------|--------|
| `/pwa/pesquisa/login` | `PesquisaLoginPage.tsx` | Login por PIN do pesquisador | Completo |
| `/pwa/pesquisa/home` | `PesquisaHomePage.tsx` | Home com fila e status de sync | Completo |
| `/pwa/pesquisa/nova` | `PesquisaNovaPage.tsx` | Formulário de nova pesquisa | Completo |
| `/pwa/pesquisa/confirmacao` | `PesquisaConfirmacaoPage.tsx` | Confirmação pós-envio | Completo |

### 2.8 Diagnóstico
| Rota | Componente | Descrição | Status |
|------|-----------|-----------|--------|
| `/pwa/diagnostico/qr` | `QrDiagnosticoPage.tsx` | Diagnóstico de scanner QR | Completo |

### 2.9 Ao Vivo (prefixo /aovivo)
| Rota | Componente | Descrição | Status |
|------|-----------|-----------|--------|
| `/aovivo/login` | `AoVivoLoginPage.tsx` | Login do módulo ao vivo | Completo |
| `/aovivo` | `AoVivoHomePage.tsx` | Home — partidas atribuídas | Completo |
| `/aovivo/partida/:matchId` | `AoVivoMatchPage.tsx` | Lançamento ao vivo de eventos na partida | Completo |

**Total de rotas PWA: 40** (incluindo /aovivo)

---

## SEÇÃO 3 — FUNCIONALIDADES ESPECIAIS

| Funcionalidade | Localização | Status | Notas |
|---------------|-------------|--------|-------|
| **Importação SIGECOM** | `/admin/importacao` + Edge Function `import-inscricoes` | Completo | Upload XLSX, mapeamento de colunas, criação automática de entidades |
| **Scanner QR** | `src/components/pwa/QrCodeScanner.tsx` | Completo | Usado em: alojamento/scan, transporte/scan, alimentacao/scan, diagnostico/qr. Lib: html5-qrcode |
| **Scanner QR (antigo)** | `src/components/QrScanner.tsx` | Obsoleto | Componente legado ainda no código, substituído pelo QrCodeScanner |
| **Boletins PDF** | `/admin/boletins` + `BulletinPdfGenerator.tsx` | Completo | Geração de boletins oficiais com @react-pdf/renderer |
| **Portal Público — Resultados** | `/public/results` | Completo | Edge Function `public-results` |
| **Portal Público — Eventos** | Via Edge Function `public-events` | Completo | API pública |
| **Portal Público — Perfil Atleta** | `/a/:token` | Completo | Perfil público do atleta |
| **Links Compartilháveis** | `/admin/links` + `/go/:slug` + `/p/:slug` | Completo | Sistema de redirecionamento e páginas públicas |
| **Pesquisa de Satisfação (offline)** | `/pwa/pesquisa/*` | Completo | Queue offline via localStorage, sync automático |
| **Central de Relatórios** | `/admin/relatorios` | Completo | Framework extensível PDF/Excel |
| **Regras por Prova (presets)** | `/admin/competicao/regras` + catálogo de presets | Completo | Presets para diferentes modalidades |
| **Match Live Mode** | `MatchLiveMode.tsx` em detalhe de partida | Completo | Lançamento em tempo real de eventos |
| **Credencial Label Print** | `CredentialLabelPrint.tsx` | Completo | Impressão de etiquetas com QR |
| **Email Templates** | `/admin/auth/email-templates` | Parcial | Preview de templates de email |
| **Demo Seeds** | `/admin/demo` | Completo | Geração de dados de demonstração |

---

## SEÇÃO 4 — DUPLICATAS E CANDIDATOS A REMOÇÃO

### 4.1 Duplicatas Funcionais
| Item A | Item B | Análise | Recomendação |
|--------|--------|---------|-------------|
| `/admin/competicao/partidas` | `/admin/competicao/agenda` | Partidas = lista tabular; Agenda = visão calendário. **Mesmo dado, visualizações diferentes.** | MESCLAR em uma única página com toggle lista/calendário |
| `/admin/competicao/central` | `/admin/competicao/fases` + `/admin/competicao/grupos` + `/admin/competicao/partidas` | Central é wizard completo que já engloba fases, grupos e partidas por prova | CONSIDERAR remover fases/grupos/partidas avulsos, manter apenas Central |
| `QrScanner.tsx` (antigo) | `QrCodeScanner.tsx` (novo) | Componente antigo substituído | REMOVER `src/components/QrScanner.tsx` |
| `/admin/alimentacao/consumo` | `/admin/alimentacao/dashboard` | Consumo = registro; Dashboard = visualização. Podem ser tabs da mesma página | MESCLAR |

### 4.2 Páginas que podem estar obsoletas
| Rota/Componente | Motivo | Recomendação |
|----------------|--------|-------------|
| `/admin/competicao/sincronizar-equipes` | Funcionalidade específica que poderia estar dentro da Central | MESCLAR na Central |
| `/admin/schema/validador` | Ferramenta técnica de desenvolvimento, não operacional | MANTER (útil para admin) |
| `/admin/demo` | Apenas para demonstração/testes | MANTER (útil para homologação) |

### 4.3 Componentes Órfãos
| Componente | Análise |
|-----------|---------|
| `src/components/QrScanner.tsx` | Substituído por `QrCodeScanner.tsx` — REMOVER |

---

## SEÇÃO 5 — PÁGINAS INCOMPLETAS

| Rota | Problema | Prioridade |
|------|---------|-----------|
| `/admin/credenciais/modelos` | Preview visual precisa melhorias, falta upload de fundo | Média |
| `/admin/competicao/fases` | Falta transição automática de status entre fases | Baixa (Central cobre) |
| `/admin/competicao/grupos` | Falta sorteio automático de equipes | Baixa (Central cobre) |
| `/admin/competicao/equipes` | Validação de elegibilidade na composição | Média |
| `/admin/competicao/partidas` | Geração automática de tabela de jogos | Baixa (Central cobre) |
| `/admin/competicao/agenda` | Falta detecção de conflitos de horário/local | Média |
| `/admin/competicao/resultados` | Publicação em lote, ranking geral | Média |
| `/admin/transporte/veiculos` | Falta controle de manutenção/disponibilidade | Baixa |
| `/admin/transporte/rotas` | Falta mapa visual | Baixa |
| `/admin/transporte/viagens` | Lotação em tempo real | Média |
| `/admin/alimentacao/consumo` | Falta dashboard em tempo real | Média |
| `/admin/alojamento/ocupacao` | Falta mapa visual de ocupação | Média |
| `/admin/acessos/delegacoes` | Falta convite por email e log de alterações | Média |
| `/admin/auth/email-templates` | Parcialmente funcional | Baixa |

---

## SEÇÃO 6 — ESTRUTURA DE MENUS ATUAL

### 6.1 Menu Lateral Admin (AdminLayout.tsx)

```
📊 Dashboard (/admin)

── PREPARAÇÃO ──
  📅 Eventos
  🏢 Instituições
  👥 Delegações
  👤 Participantes

── IMPORTAÇÃO ──
  📤 Importação
  💾 Central de Dados
  🔍 Normalização
  ⚠️ Irregularidades

── CREDENCIAMENTO ──
  ✅ Credenciamento
  📱 Validação QR
  🪪 Modelos

── LOGÍSTICA ──
  Transporte:
    🚌 Veículos
    🛤️ Rotas
    🧭 Viagens
  Alimentação:
    🍴 Refeições
    ⏰ Janelas
    📋 Consumo
  Alojamento:
    🏢 Locais
    🚪 Unidades
    🔑 Ocupação

── COMPETIÇÃO ──
  📊 Painel
  ✅ Pré-validação
  🏆 Central
  ⚙️ Regras por Prova
  ⚡ Regras em Lote
  💪 Modalidades
  📋 Categorias
  👥 Equipes
  🏆 Fases
  📦 Grupos
  ⚔️ Partidas
  📅 Agenda
  📋 Resultados
  🔍 Boletins

── PESQUISA ──
  📋 Dashboard
  📅 Eventos
  👥 Pesquisadores

── CONFIGURAÇÕES ──
  ⚙️ Parâmetros
  📍 Locais
  🔑 Acessos
  🛡️ Delegações
  💾 Validador
  🗺️ Mapa
  ℹ️ Diagnóstico
  ⚡ Demo
  📧 E-mail
  🔗 Links
  📊 Relatórios
```

### 6.2 Navegação PWA

- **Sem menu lateral** — navegação via header + cards na home de cada módulo
- Cada módulo tem **PwaHeader** com botão voltar e título
- Home de cada módulo tem cards/botões para sub-páginas
- Landing page `/pwa` redireciona automaticamente por perfil

---

## SEÇÃO 7 — CONFIGURAÇÕES E SISTEMA

| Página | Essencial? | Notas |
|--------|-----------|-------|
| Parâmetros do Evento | ✅ Essencial | Regras de participação |
| Locais | ✅ Essencial | Cadastro base de venues |
| Acessos/Usuários | ✅ Essencial | Gestão de operadores |
| Acessos/Delegações | ✅ Essencial | Vínculos delegação-usuário |
| Validador de Estrutura | 🟡 Útil | Ferramenta técnica |
| Mapa do Sistema | 🟡 Útil | Diagnóstico visual |
| Diagnóstico Competição | 🟡 Útil | Auditoria técnica |
| Demo/Seeds | 🟡 Útil | Apenas para testes |
| Email Templates | 🟡 Útil | Preview, não operacional |
| Links | ✅ Essencial | Compartilhamento público |
| Relatórios | ✅ Essencial | Central de relatórios |

**Candidatos a mesclar:** Mapa + Diagnóstico poderiam ser tabs da mesma página.

---

## SEÇÃO 8 — ACESSOS E PERFIS

| Página | Função | Duplicação? |
|--------|--------|------------|
| `/admin/acessos/usuarios` | Criar, editar, desativar usuários operacionais | Não |
| `/admin/acessos/delegacoes` | Vincular usuários a delegações | Não |
| Edge Function `admin-users` | Backend para convites e alteração de roles | Não |

**Não há duplicação** neste módulo. As duas páginas servem propósitos distintos.

---

## SEÇÃO 9 — ANÁLISE DE USO

### Admin
| Rota | Menu? | Via fluxo? | Órfã? |
|------|-------|-----------|-------|
| `/admin` (Dashboard) | ✅ | — | — |
| `/admin/eventos` | ✅ | — | — |
| `/admin/instituicoes` | ✅ | — | — |
| `/admin/delegacoes` | ✅ | — | — |
| `/admin/delegacoes/:id` | ❌ | ✅ (clique na lista) | — |
| `/admin/participantes` | ✅ | — | — |
| `/admin/participantes/:id` | ❌ | ✅ (clique na lista) | — |
| `/admin/participantes/:id/esportivo` | ❌ | ✅ (tab no detalhe) | — |
| `/admin/importacao` | ✅ | — | — |
| `/admin/dados` | ✅ | — | — |
| `/admin/normalizacao-provas` | ✅ | — | — |
| `/admin/irregularidades` | ✅ | — | — |
| `/admin/credenciamento` | ✅ | — | — |
| `/admin/validacao-qr` | ✅ | — | — |
| `/admin/credenciais/modelos` | ✅ | — | — |
| `/admin/atletas/qrcode` | ❌ | ❌ | ⚠️ **ÓRFÃ** — sem link no menu |
| `/admin/transporte/veiculos` | ✅ | — | — |
| `/admin/transporte/rotas` | ✅ | — | — |
| `/admin/transporte/viagens` | ✅ | — | — |
| `/admin/transporte/embarque/:tripId` | ❌ | ✅ (via viagens) | — |
| `/admin/transporte/relatorios` | ❌ | ❌ | ⚠️ **ÓRFÃ** — sem link no menu |
| `/admin/alimentacao/tipos` | ✅ | — | — |
| `/admin/alimentacao/janelas` | ✅ | — | — |
| `/admin/alimentacao/consumo` | ✅ | — | — |
| `/admin/alimentacao/dashboard` | ❌ | ❌ | ⚠️ **ÓRFÃ** — sem link no menu |
| `/admin/alimentacao/relatorios` | ❌ | ❌ | ⚠️ **ÓRFÃ** — sem link no menu |
| `/admin/alojamento/locais` | ✅ | — | — |
| `/admin/alojamento/unidades` | ✅ | — | — |
| `/admin/alojamento/ocupacao` | ✅ | — | — |
| `/admin/alojamento/relatorios` | ❌ | ❌ | ⚠️ **ÓRFÃ** — sem link no menu |
| `/admin/competicao/painel` | ✅ | — | — |
| `/admin/competicao/pre-validacao` | ✅ | — | — |
| `/admin/competicao/central` | ✅ | — | — |
| `/admin/competicao/regras` | ✅ | — | — |
| `/admin/competicao/regras/lote` | ✅ | — | — |
| `/admin/modalidades` | ✅ | — | — |
| `/admin/categorias` | ✅ | — | — |
| `/admin/competicao/equipes` | ✅ | — | — |
| `/admin/competicao/fases` | ✅ | — | — |
| `/admin/competicao/grupos` | ✅ | — | — |
| `/admin/competicao/partidas` | ✅ | — | — |
| `/admin/competicao/agenda` | ✅ | — | — |
| `/admin/competicao/partida/:matchId` | ❌ | ✅ (clique na lista) | — |
| `/admin/competicao/resultados` | ✅ | — | — |
| `/admin/competicao/sincronizar-equipes` | ❌ | ❌ | ⚠️ **ÓRFÃ** — sem link no menu |
| `/admin/boletins` | ✅ | — | — |
| `/admin/pesquisa` | ✅ | — | — |
| `/admin/pesquisa/eventos` | ✅ | — | — |
| `/admin/pesquisa/pesquisadores` | ✅ | — | — |
| `/admin/parametros-evento` | ✅ | — | — |
| `/admin/locais` | ✅ | — | — |
| `/admin/acessos/usuarios` | ✅ | — | — |
| `/admin/acessos/delegacoes` | ✅ | — | — |
| `/admin/schema/validador` | ✅ | — | — |
| `/admin/mapa` | ✅ | — | — |
| `/admin/diagnostico-competicao` | ✅ | — | — |
| `/admin/demo` | ✅ | — | — |
| `/admin/auth/email-templates` | ✅ | — | — |
| `/admin/links` | ✅ | — | — |
| `/admin/links/novo` | ❌ | ✅ (botão na lista) | — |
| `/admin/links/:id` | ❌ | ✅ (clique na lista) | — |
| `/admin/links/preview/:id` | ❌ | ✅ (botão de preview) | — |
| `/admin/relatorios` | ✅ | — | — |

**Páginas órfãs (sem acesso via menu):** 6
- `/admin/atletas/qrcode`
- `/admin/transporte/relatorios`
- `/admin/alimentacao/dashboard`
- `/admin/alimentacao/relatorios`
- `/admin/alojamento/relatorios`
- `/admin/competicao/sincronizar-equipes`

---

## SEÇÃO 10 — RECOMENDAÇÕES

### ✅ MANTER (essenciais, completas)
- Dashboard, Eventos, Instituições, Delegações (+ detalhe), Participantes (+ detalhe + histórico)
- Importação, Central de Dados, Normalização, Irregularidades
- Credenciamento, Validação QR
- Painel Competição, Pré-validação, Central da Competição, Regras por Prova, Regras em Lote
- Modalidades, Categorias, Detalhe de Partida, Boletins
- Alimentação (tipos, janelas), Alojamento (locais, unidades)
- Parâmetros, Locais, Acessos (usuários + delegações)
- Pesquisa (dashboard, eventos, pesquisadores)
- Links, Relatórios, Mapa, Demo
- **Todos os módulos PWA** (completos e funcionais)

### 🔀 MESCLAR
| De | Para | Justificativa |
|----|------|--------------|
| `/admin/competicao/partidas` + `/admin/competicao/agenda` | Uma página com toggle lista/calendário | Mesmo dado, visualizações diferentes |
| `/admin/competicao/fases` + `/admin/competicao/grupos` | Incorporar na Central (já existe lá) | Central já cobre esses fluxos |
| `/admin/alimentacao/consumo` + `/admin/alimentacao/dashboard` | Uma página com tabs consumo/dashboard | Complementares |
| `/admin/transporte/relatorios` + `/admin/alimentacao/relatorios` + `/admin/alojamento/relatorios` | Incorporar na Central de Relatórios | Unificar relatórios |
| `/admin/mapa` + `/admin/diagnostico-competicao` | Uma página com tabs | Ambas são diagnóstico |

### 🔧 FINALIZAR
| Página | O que falta |
|--------|------------|
| `/admin/credenciais/modelos` | Upload de fundo, editor visual |
| `/admin/competicao/equipes` | Validação de elegibilidade |
| `/admin/competicao/resultados` | Publicação em lote |
| `/admin/acessos/delegacoes` | Convite por email |
| `/admin/alojamento/ocupacao` | Mapa visual de ocupação |

### 🗑️ REMOVER
| Item | Motivo |
|------|--------|
| `src/components/QrScanner.tsx` | Substituído por `QrCodeScanner.tsx` |
| `/admin/competicao/sincronizar-equipes` | Funcionalidade pode ser incorporada na Central |
| `/admin/atletas/qrcode` | Funcionalidade já coberta pelo Credenciamento |

---

## RESUMO EXECUTIVO

| Métrica | Valor |
|---------|-------|
| **Total de rotas admin** | 52 |
| **Total de rotas PWA** | 40 (incl. /aovivo e públicas) |
| **Rotas públicas** | 4 (/public/results, /go/:slug, /p/:slug, /a/:token) |
| **Funcionalidades especiais** | 15 |
| **Duplicatas funcionais** | 5 conjuntos |
| **Páginas incompletas (parcial)** | 14 |
| **Páginas órfãs (sem menu)** | 6 |
| **Candidatas a remoção** | 3 |
| **Candidatas a merge** | 5 conjuntos (10→5 páginas) |
| **Componentes obsoletos** | 1 (QrScanner antigo) |
