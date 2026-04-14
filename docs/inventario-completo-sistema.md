# Inventário Completo — JER Gestão

**Data:** 2026-04-14  
**Objetivo:** Inventário atualizado após refatoração de navegação em 3 níveis.

> **Atualização pós-refatoração**: Páginas mescladas, órfãs ativadas, Super Admin adicionado, PWA isolado.

---

## SEÇÃO 0 — ROTAS SUPER ADMIN (prefixo /super)

| Rota | Componente | Descrição | Perfis | Status |
|------|-----------|-----------|--------|--------|
| `/super` | `SuperDashboardPage.tsx` | Dashboard global — KPIs de todos os eventos | super_admin | Completo |
| `/super/eventos` | `SuperEventosPage.tsx` | Lista todos os eventos de todos os clientes | super_admin | Completo |
| `/super/logs` | `SuperLogsPage.tsx` | Audit_events global com filtros | super_admin | Completo |
| `/super/config` | `SuperConfigPage.tsx` | Feature flags e parâmetros globais | super_admin | Completo |

**Total de rotas super admin: 4**

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
| `/admin/delegacoes/:delegationId` | `DelegacaoDetalhePage.tsx` | Detalhes de uma delegação com tabs | admin, secretaria, coord_tecnica | Completo | delegations, participants, people |
| `/admin/participantes` | `ParticipantesPage.tsx` | Lista todos os participantes com filtros | admin, secretaria, coord_tecnica | Completo | participants, people, delegations |
| `/admin/participantes/:participantId` | `ParticipanteDetalhePage.tsx` | Detalhes do participante com tabs | admin, secretaria, coord_tecnica | Completo | participants, people |
| `/admin/participantes/:participantId/esportivo` | `ParticipanteHistoricoPage.tsx` | Histórico esportivo completo | admin, secretaria, coord_tecnica | Completo | participant_sport_events |

### 1.3 Importação e Dados
| Rota | Componente | Descrição | Perfis | Status | Dependências |
|------|-----------|-----------|--------|--------|-------------|
| `/admin/importacao` | `ImportacaoPage.tsx` | Upload de planilha XLSX (SIGECOM) | admin, secretaria | Completo | import_logs, import_row_errors |
| `/admin/dados` | `CentralDadosPage.tsx` | Central de dados — contadores e integridade | admin, secretaria, coord_tecnica | Completo | múltiplas tabelas |
| `/admin/normalizacao-provas` | `NormalizacaoProvasPage.tsx` | Mapeia nomes importados para provas canônicas | admin, secretaria, coord_tecnica | Completo | sport_events |
| `/admin/irregularidades` | `IrregularidadesPage.tsx` | Irregularidades detectadas | admin, secretaria, coord_tecnica | Completo | participation_irregularities |

### 1.4 Credenciamento
| Rota | Componente | Descrição | Perfis | Status | Dependências |
|------|-----------|-----------|--------|--------|-------------|
| `/admin/credenciamento` | `CredenciamentoPage.tsx` | Busca participante e ativa credencial | admin, secretaria, coord_tecnica | Completo | participant_credentials |
| `/admin/validacao-qr` | `ValidacaoQRPage.tsx` | Leitura de QR para validação | admin, secretaria, coord_tecnica, transporte, alimentacao | Completo | credential_scans |
| `/admin/credenciais/modelos` | `CredencialModelosPage.tsx` | CRUD de templates visuais | admin, secretaria, coord_tecnica | Parcial | credential_templates |

### 1.5 Competição — ⚡ ATUALIZADO
| Rota | Componente | Descrição | Perfis | Status | Notas |
|------|-----------|-----------|--------|--------|-------|
| `/admin/competicao/painel` | `CompeticaoPainelPage.tsx` | Visão consolidada do progresso | admin, secretaria, coord_tecnica | Completo | — |
| `/admin/competicao/pre-validacao` | `PreValidacaoPage.tsx` | Valida quórum antes de liberar | admin, secretaria, coord_tecnica | Completo | — |
| `/admin/competicao/central` | `CompeticaoCentralPage.tsx` | Hub operacional — wizard completo | admin, secretaria, coord_tecnica | Completo | — |
| `/admin/competicao/partidas-agenda` | `CompeticaoPartidasAgendaPage.tsx` | **MESCLADO**: Lista + Calendário com toggle | admin, secretaria, coord_tecnica | Completo | 🔀 Mesclou Partidas + Agenda |
| `/admin/competicao/regras` | `RegrasProvaPage.tsx` | Regras por prova | admin, secretaria, coord_tecnica | Completo | — |
| `/admin/competicao/regras/lote` | `RegrasLotePage.tsx` | Aplicação de regras em lote | admin, secretaria, coord_tecnica | Completo | — |
| `/admin/competicao/resultados` | `CompeticaoResultadosPage.tsx` | Lançamento e publicação | admin, secretaria, coord_tecnica | Parcial | — |
| `/admin/boletins` | `BoletinsPage.tsx` | Boletins oficiais PDF | admin, secretaria, coord_tecnica | Completo | — |
| `/admin/competicao/partida/:matchId` | `CompeticaoPartidaDetalhePage.tsx` | Detalhes de partida | admin, secretaria, coord_tecnica, mesario | Completo | — |

### 1.6 Logística
| Rota | Componente | Descrição | Perfis | Status | Notas |
|------|-----------|-----------|--------|--------|-------|
| `/admin/transporte/veiculos` | `TransporteVeiculosPage.tsx` | Cadastro de veículos | admin, secretaria, coord_tecnica, transporte | Parcial | — |
| `/admin/transporte/rotas` | `TransporteRotasPage.tsx` | Rotas de transporte | admin, secretaria, coord_tecnica, transporte | Parcial | — |
| `/admin/transporte/viagens` | `TransporteViagensPage.tsx` | Agenda viagens | admin, secretaria, coord_tecnica, transporte | Parcial | — |
| `/admin/transporte/relatorios` | `TransporteRelatoriosPage.tsx` | Relatórios de transporte | admin, secretaria, coord_tecnica, transporte | Parcial | ✅ Ativado no menu |
| `/admin/alimentacao/tipos` | `AlimentacaoTiposPage.tsx` | Tipos de refeição | admin, secretaria, coord_tecnica, alimentacao | Completo | — |
| `/admin/alimentacao/janelas` | `AlimentacaoJanelasPage.tsx` | Janelas de serviço | admin, secretaria, coord_tecnica, alimentacao | Completo | — |
| `/admin/alimentacao/consumo` | `AlimentacaoConsumoPage.tsx` | Registro de consumo | admin, secretaria, coord_tecnica, alimentacao | Parcial | — |
| `/admin/alimentacao/dashboard` | `AlimentacaoDashboardPage.tsx` | Dashboard alimentação | admin, secretaria, coord_tecnica, alimentacao | Parcial | ✅ Ativado no menu |
| `/admin/alimentacao/relatorios` | `AlimentacaoRelatoriosPage.tsx` | Relatórios alimentação | admin, secretaria, coord_tecnica, alimentacao | Parcial | ✅ Ativado no menu |
| `/admin/alojamento/locais` | `AlojamentoLocaisPage.tsx` | Locais de alojamento | admin, secretaria, coord_tecnica | Completo | — |
| `/admin/alojamento/unidades` | `AlojamentoUnidadesPage.tsx` | Unidades por local | admin, secretaria, coord_tecnica | Completo | — |
| `/admin/alojamento/ocupacao` | `AlojamentoOcupacaoPage.tsx` | Check-in/check-out | admin, secretaria, coord_tecnica | Parcial | — |
| `/admin/alojamento/relatorios` | `AlojamentoRelatoriosPage.tsx` | Relatórios alojamento | admin, secretaria, coord_tecnica | Parcial | ✅ Ativado no menu |

### 1.7 Sistema — ⚡ ATUALIZADO
| Rota | Componente | Descrição | Perfis | Status | Notas |
|------|-----------|-----------|--------|--------|-------|
| `/admin/sistema/diagnostico` | `SistemaDiagnosticoPage.tsx` | **MESCLADO**: Mapa + Diagnóstico com tabs | admin, secretaria, coord_tecnica | Completo | 🔀 Mesclou Mapa + Diagnóstico |
| `/admin/demo` | `DemoSeedsPage.tsx` | Seeds de demonstração | admin, coord_tecnica | Completo | — |
| `/admin/relatorios` | `ReportCenterPage.tsx` | Central de relatórios (PDF/Excel) | admin, secretaria, coord_tecnica | Completo | — |

### 1.8 Acessos, Pesquisa, Configurações
| Rota | Componente | Descrição | Perfis | Status |
|------|-----------|-----------|--------|--------|
| `/admin/acessos/usuarios` | `AcessosUsuariosPage.tsx` | Gestão de usuários operacionais | admin, secretaria | Completo |
| `/admin/acessos/delegacoes` | `AcessosDelegacoesPage.tsx` | Vínculos usuário-delegação | admin, secretaria | Parcial |
| `/admin/links` | `LinksPage.tsx` | Links externos com wizard e QR | admin, secretaria | Completo |
| `/admin/pesquisa` | `PesquisaDashboardPage.tsx` | Dashboard de pesquisas | admin, secretaria | Completo |
| `/admin/pesquisa/eventos` | `PesquisaEventosPage.tsx` | Eventos de pesquisa | admin, secretaria | Completo |
| `/admin/pesquisa/pesquisadores` | `PesquisaPesquisadoresPage.tsx` | Cadastro de pesquisadores | admin, secretaria | Completo |
| `/admin/parametros-evento` | `ParametrosEventoPage.tsx` | Limites de participação | admin, secretaria, coord_tecnica | Completo |
| `/admin/locais` | `LocaisPage.tsx` | Locais de competição | admin, secretaria, coord_tecnica | Completo |
| `/admin/modalidades` | `ModalidadesPage.tsx` | CRUD de modalidades | admin, secretaria, coord_tecnica | Completo |
| `/admin/categorias` | `CategoriasPage.tsx` | CRUD de categorias | admin, secretaria, coord_tecnica | Completo |

### Rotas acessíveis via URL (sem link no menu)
| Rota | Componente | Status |
|------|-----------|--------|
| `/admin/competicao/fases` | `CompeticaoFasesPage.tsx` | Acessível via URL — gerenciado pela Central |
| `/admin/competicao/grupos` | `CompeticaoGruposPage.tsx` | Acessível via URL — gerenciado pela Central |
| `/admin/competicao/equipes` | `CompeticaoEquipesPage.tsx` | Acessível via URL — gerenciado pela Central |
| `/admin/competicao/sincronizar-equipes` | `SincronizarEquipesPage.tsx` | Acessível via URL |
| `/admin/schema/validador` | `SchemaValidadorPage.tsx` | Acessível via URL — ferramenta avançada |
| `/admin/auth/email-templates` | `EmailTemplatesPage.tsx` | Acessível via URL — configuração avançada |
| `/admin/atletas/qrcode` | `AtletaQrCodePage.tsx` | Acessível via URL — acesso via participante |
| `/admin/dados` | `CentralDadosPage.tsx` | Acessível via URL — acesso via importação |

---

## SEÇÃO 2 — ROTAS PWA (prefixo /pwa) — ⚡ ATUALIZADO

### Isolamento de Módulos
Cada módulo PWA é protegido por `PwaModuleLayout` que:
- Valida perfil do usuário
- Bloqueia acesso não autorizado → `/pwa/acesso-negado`
- Remove menu lateral — apenas header com título + logout
- Redireciona automaticamente pós-login por perfil

### 2.1 Autenticação e Navegação
| Rota | Componente | Descrição | Status |
|------|-----------|-----------|--------|
| `/pwa/login` | `PwaLoginPage.tsx` | Login PWA — redireciona por perfil | Completo |
| `/pwa/recover` | `PwaRecoverPage.tsx` | Recuperação de senha | Completo |
| `/pwa/set-password` | `PwaSetPasswordPage.tsx` | Definir nova senha | Completo |
| `/pwa` | `PwaLandingPage.tsx` | Landing — redireciona por perfil | Completo |
| `/pwa/acesso-negado` | `PwaAcessoNegadoPage.tsx` | Tela de acesso negado | Completo |

### 2.2–2.8 Módulos Operacionais (sem alteração de rotas)
Transporte (5 rotas), Alimentação (5 rotas), Alojamento (7 rotas), Coordenação (6 rotas), Delegação (5 rotas), Pesquisa (4 rotas), Diagnóstico (1 rota).

### 2.9 Ao Vivo (prefixo /aovivo)
| Rota | Componente | Descrição | Status |
|------|-----------|-----------|--------|
| `/aovivo/login` | `AoVivoLoginPage.tsx` | Login do módulo ao vivo | Completo |
| `/aovivo` | `AoVivoHomePage.tsx` | Home — partidas atribuídas | Completo |
| `/aovivo/partida/:matchId` | `AoVivoMatchPage.tsx` | Lançamento ao vivo | Completo |

---

## SEÇÃO 3 — CHANGELOG DE REFATORAÇÃO

### Páginas Mescladas
| Antes | Depois | Status |
|-------|--------|--------|
| `CompeticaoPartidasPage` + `CompeticaoAgendaPage` | `CompeticaoPartidasAgendaPage` (toggle lista/calendário) | ✅ Mesclado |
| `MapaSistemaPage` + `DiagnosticoCompeticaoPage` | `SistemaDiagnosticoPage` (tabs Mapa/Diagnóstico) | ✅ Mesclado |

### Páginas Órfãs Ativadas no Menu
| Rota | Seção no menu | Status |
|------|--------------|--------|
| `/admin/transporte/relatorios` | Relatórios → Transporte | ✅ Ativado |
| `/admin/alimentacao/relatorios` | Relatórios → Alimentação | ✅ Ativado |
| `/admin/alojamento/relatorios` | Relatórios → Alojamento | ✅ Ativado |
| `/admin/alimentacao/dashboard` | Logística → Alimentação → Dashboard | ✅ Ativado |

### Rotas Removidas do Menu (acessíveis via URL)
| Rota | Motivo |
|------|--------|
| `/admin/competicao/fases` | Gerenciado via Central (wizard) |
| `/admin/competicao/grupos` | Gerenciado via Central (wizard) |

### Novas Estruturas
| Estrutura | Descrição |
|-----------|-----------|
| Super Admin (`/super`) | 4 páginas globais, layout próprio |
| `PwaModuleLayout` | Isolamento de módulos PWA por perfil |
| `PwaAcessoNegadoPage` | Tela de acesso negado para PWA |
| Redirecionamento automático | Login PWA redireciona por perfil |

---

## RESUMO EXECUTIVO

| Métrica | Valor |
|---------|-------|
| **Total de rotas super admin** | 4 |
| **Total de rotas admin** | ~50 (2 economizadas com mesclagem) |
| **Total de rotas PWA** | 40 (incl. /aovivo e públicas) |
| **Rotas públicas** | 4 (/public/results, /go/:slug, /p/:slug, /a/:token) |
| **Perfis de acesso** | 12 |
| **Páginas mescladas** | 2 conjuntos (4→2) |
| **Páginas órfãs ativadas** | 4 |
| **Módulos PWA isolados** | 6 |
| **Documentos criados** | 5 |
| **Documentos atualizados** | 5 |
