# Mapeamento de Navegação — JER Gestão

Este documento descreve o estado real da navegação do sistema JER Gestão, consolidando rotas, menus, permissões e componentes de layout em 28 de abril de 2026.

## 1. Visão Geral da Arquitetura de Navegação

O sistema utiliza `react-router-dom` (v6) para gestão de rotas, estruturado em três grandes áreas:
- **Web Administrativo:** Gestão centralizada para `admin`, `secretaria` e `coordenacao_tecnica`.
- **Super Admin:** Painel técnico para manutenção e suporte.
- **PWAs Operacionais:** Interfaces mobile-first otimizadas para campo (transporte, alimentação, alojamento, etc.).

---

## 2. Web Administrativo (Admin)

A navegação principal ocorre no componente `AdminLayout`, que utiliza uma barra lateral (Sidebar) organizada por grupos funcionais.

### Grupos e Itens de Menu

| Grupo | Item | Rota | Permissões (Roles) |
| :--- | :--- | :--- | :--- |
| **Painel** | Painel de Gestão | `/admin` | Todas (`all`) |
| **Painel** | Painel Coordenador | `/admin/coordenador-modalidade` | `coordenador_modalidade` |
| **Preparação** | Eventos | `/admin/eventos` | `admin`, `secretaria`, `coord_tecnica` |
| | Participantes | `/admin/participantes` | `admin`, `secretaria`, `coord_tecnica` |
| | Pessoas Eventuais | `/admin/pessoas/eventuais` | `admin`, `secretaria`, `coord_tecnica` |
| | Delegações (Escolas) | `/admin/delegacoes` | `admin`, `secretaria`, `coord_tecnica` |
| | Importação | `/admin/importacao` | `super_admin`, `admin`, `secretaria` |
| **Relatórios** | Central de Relatórios | `/admin/relatorios` | `admin`, `secretaria`, `coord_tecnica` |
| | Boletins | `/admin/relatorios/boletins` | `admin`, `secretaria`, `coord_tecnica` |
| | Quadro de Medalhas | `/admin/relatorios/quadro-medalhas` | `admin`, `secretaria`, `coord_tecnica` |
| **Logística** | Logística Consolidada | `/admin/etapas` | `admin`, `secretaria`, `coord_tecnica` |
| | Clonar Logística | `/admin/clonar-logistica` | `super_admin`, `admin`, `secretaria` |
| **Acessos** | Usuários e Perfis | `/admin/acessos/usuarios` | `super_admin`, `admin`, `secretaria` |
| | Acessos e Vínculos | `/admin/acessos/delegacoes` | `super_admin`, `admin`, `secretaria` |
| | Auditoria PWA | `/admin/acessos/pwa` | `super_admin`, `admin`, `secretaria` |
| | Evidências OSC | `/admin/evidencias-osc` | Múltiplas roles operacionais |
| **Competição** | Painel Competição | `/admin/competicao/painel` | `admin`, `secretaria`, `coord_tecnica` |
| | Central Competição | `/admin/competicao/central` | `admin`, `secretaria`, `coord_tecnica` |
| **Arbitragem** | Equipe Arbitragem | `/admin/competicao/arbitragem?tab=officials` | Operacional + Arbitragem |
| | Protestos (CDE) | `/admin/protestos` | `admin`, `secretaria`, `cde` |
| **Config** | Regras do Evento | `/admin/regras` | `admin`, `secretaria`, `coord_tecnica` |
| | Modalidades | `/admin/modalidades` | `admin`, `secretaria`, `coord_tecnica` |
| **Ajuda** | Manual | `/admin/ajuda/manual` | Todas (`all`) |
| | Chat com IA | `/admin/ajuda/chat` | Admin + Coord. Modalidade |

---

## 3. Super Admin

Acessível via `/super`, utiliza o `SuperAdminLayout`.

| Item | Rota | Descrição |
| :--- | :--- | :--- |
| Dashboard | `/super` | Visão geral técnica. |
| Eventos | `/super/eventos` | Gestão de eventos root. |
| Monitor (PWA) | `/super/monitor` | Telemetria em tempo real dos PWAs. |
| Chamados | `/super/chamados` | Gestão de tickets de suporte. |
| Inspetor de Dados | `/super/inspector` | Query runner e exploração de DB. |
| Logs | `/super/logs` | Auditoria de sistema. |
| Permissões | `/super/permissoes` | Gestão fina de RLS e claims. |
| Diagnóstico | `/super/diagnostico` | Verificação de integridade do sistema. |

---

## 4. PWAs Operacionais (Mobile)

A navegação PWA começa em `/pwa` (`PwaLandingPage`), onde o usuário seleciona o módulo permitido.

### Módulo: Alojamento
- **Home:** `/pwa/alojamento`
- **Ações:**
  - `/pwa/alojamento/scan`: Check-in/out via QR.
  - `/pwa/alojamento/buscar`: Busca manual de hóspedes.
  - `/pwa/alojamento/ocupacao`: Gestão de leitos e unidades.
  - `/pwa/alojamento/lista-completa`: Relação nominal.
  - `/pwa/alojamento/incidentes`: Registro de ocorrências.

### Módulo: Alimentação
- **Home:** `/pwa/alimentacao`
- **Ações:**
  - `/pwa/alimentacao/scan`: Registro de consumo via QR.
  - `/pwa/alimentacao/buscar`: Busca manual.
  - `/pwa/alimentacao/janelas`: Status das janelas de refeição.
  - `/pwa/alimentacao/historico`: KPIs de consumo.
  - `/pwa/alimentacao/lista-consumos`: Log detalhado.

### Módulo: Transporte
- **Home:** `/pwa/transporte`
- **Ações:**
  - `/pwa/transporte/scan`: Embarque via QR.
  - `/pwa/transporte/viagens`: Lista de viagens do motorista.
  - `/pwa/transporte/embarque/:id`: Tela de controle de embarque.

### Outros Módulos PWA
- **Coordenação Técnica:** `/pwa/coordenacao-tecnica` (Agenda, Partidas, Resultados).
- **Delegação:** `/pwa/delegacao` (Agenda, Participantes, Logística).
- **Resultados:** `/pwa/resultados` (Lançamento manual por coordenador de modalidade).
- **JER Ao Vivo:** `/aovivo` (Mesa e Arbitragem).

---

## 5. Matriz de Acesso por Perfil (Resumo)

| Perfil | Admin Web | Super Admin | PWAs Operacionais |
| :--- | :---: | :---: | :---: |
| `super_admin` | Sim (Total) | Sim | Sim (Total) |
| `admin` | Sim (Total) | Não | Sim (Total) |
| `secretaria` | Sim (Parcial) | Não | Sim (Limitado) |
| `transporte` | Não | Não | Somente Transporte |
| `alimentacao` | Não | Não | Somente Alimentação |
| `alojamento` | Não | Não | Somente Alojamento |
| `coordenador_modalidade` | Somente Painel Coord. | Não | Somente Resultados |
| `arbitragem` / `mesario` | Não | Não | Somente Ao Vivo |

---

## 6. Componentes de Layout e Guardas

- **`AdminLayout`:** Sidebar colapsável, Header com switcher de evento, Breadcrumbs e VersionBadge.
- **`SuperAdminLayout`:** Sidebar técnica simplificada, Foco em monitoramento.
- **`StageLayout`:** Utilizado dentro de contextos de Etapa específica para navegação local.
- **`PwaRouteGuard`:** Garante que o usuário PWA tenha um Evento e Etapa selecionados antes de operar.
- **`ProtectedRoute`:** Valida autenticação e roles gerais via `react-router`.

---

## 7. Observações de Consistência e Inconsistências

1. **Unificação de Login:** O login foi unificado em `/login`, mas ainda existem referências a `PwaLoginPage` e `PesquisaLoginPage` no código (algumas descontinuadas).
2. **Contexto Etapa:** Módulos PWA exigem `activeStageId` em `/pwa/configuracao` antes de permitir o acesso às ferramentas de campo.
3. **Redirecionamento:** O `/` redireciona para `/admin` ou `/pwa` dependendo do perfil detectado no `Index.tsx`.
4. **Duplicidade de Telas:** Existem telas com nomes similares como `AlojamentoOcupacaoPage` (Admin) e `AlojamentoOcupacaoPage2` (PWA).
