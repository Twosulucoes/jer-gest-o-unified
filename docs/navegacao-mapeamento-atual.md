# Mapeamento de Navegação — JER Gestão

Este documento descreve o estado real da navegação do sistema JER Gestão, consolidando rotas, menus, permissões e componentes de layout em 28 de abril de 2026.

> **Status:** Fase 4 (Saneamento) em andamento. Passo 3 concluído.

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
| | Importação | `/admin/importacao` | `admin`, `secretaria` (Item movido para Super Admin) |
| **Relatórios** | Central de Relatórios | `/admin/relatorios` | `admin`, `secretaria`, `coord_tecnica` |
| | Boletins | `/admin/relatorios/boletins` | `admin`, `secretaria`, `coord_tecnica` |
| | Quadro de Medalhas | `/admin/relatorios/quadro-medalhas` | `admin`, `secretaria`, `coord_tecnica` |
| **Logística** | Logística Consolidada | `/admin/etapas` | `admin`, `secretaria`, `coord_tecnica` |
| | Clonar Logística | `/admin/clonar-logistica` | `admin`, `secretaria` (Item movido para Super Admin) |
| **Acessos** | Usuários e Perfis | `/admin/acessos/usuarios` | `admin`, `secretaria` (Item movido para Super Admin) |
| | Acessos e Vínculos | `/admin/acessos/delegacoes` | `admin`, `secretaria` |
| | Auditoria PWA | `/admin/acessos/pwa` | `admin`, `secretaria` (Item movido para Super Admin) |
| | Evidências OSC | `/admin/evidencias-osc` | `admin`, `secretaria`, `coord_tecnica` (Visibilidade restrita por módulo para outros) |
| **Competição** | Painel Competição | `/admin/competicao/painel` | `admin`, `secretaria`, `coord_tecnica` |
| | Central Competição | `/admin/competicao/central` | `admin`, `secretaria`, `coord_tecnica` |
| **Arbitragem** | Equipe Arbitragem | `/admin/competicao/arbitragem?tab=officials` | `admin`, `secretaria`, `coord_tecnica` |
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
| Clonar Logística | `/admin/clonar-logistica` | Função de plataforma migrada. |
| Importação | `/admin/importacao` | Função de plataforma migrada. |
| Usuários e Perfis | `/admin/acessos/usuarios` | Gestão de contas e perfis. |
| Acessos PWA | `/admin/acessos/pwa` | Auditoria técnica de uso. |

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
- **JER Ao Vivo:** `/pwa/aovivo` (Mesa e Arbitragem).

---

## 5. Matriz de Acesso por Perfil (Resumo)

| Perfil | Admin Web | Super Admin | PWAs Operacionais |
| :--- | :---: | :---: | :---: |
| `super_admin` | Sim (Suporte) | Sim | Sim (Total) |
| `admin` | Sim (Total) | Não | Sim (Total) |
| `secretaria` | Sim (Parcial) | Não | Sim (Limitado) |
| `transporte` | Bloqueado (403/Redirect) | Não | Somente Transporte |
| `alimentacao` | Bloqueado (403/Redirect) | Não | Somente Alimentação |
| `alojamento` | Bloqueado (403/Redirect) | Não | Somente Alojamento |
| `coordenador_modalidade` | Somente Painel Coord. | Não | Somente Resultados |
| `arbitragem` / `mesario` | Bloqueado (403/Redirect) | Não | Somente Ao Vivo |

---

## 6. Componentes de Layout e Guardas

- **`AdminLayout`:** Sidebar colapsável, Header com switcher de evento, Breadcrumbs e VersionBadge.
- **`SuperAdminLayout`:** Sidebar técnica simplificada, Foco em monitoramento.
- **`StageLayout`:** Utilizado dentro de contextos de Etapa específica para navegação local.
- **`PwaRouteGuard`:** Garante que o usuário PWA tenha um Evento e Etapa selecionados antes de operar. Limpo de referências legadas na Fase 4.
- **`ProtectedRoute`:** Valida autenticação e roles gerais via `react-router`.

---

## 7. Observações de Consistência e Inconsistências

1. **Unificação de Login:** O login foi unificado em `/login`. `PwaLoginPage` removida. `PesquisaLoginPage` e `AoVivoLoginPage` candidatos a unificação no Passo 2 da Fase 4.
2. **Contexto Etapa:** Módulos PWA exigem `activeStageId` em `/pwa/configuracao` antes de permitir o acesso às ferramentas de campo.
3. **Redirecionamento:** O `/` redireciona para `/admin` ou `/pwa` dependendo do perfil detectado no `Index.tsx`.
4. **Saneamento de Arquivos:** Fase 4 Passo 1 removeu `PwaModuleLayout.tsx` e `PwaBottomNav.tsx` (órfãos).

---

## 8. Complemento PWAs Padrão de Navegação

Este complemento detalha o padrão de navegação e componentes de layout dos PWAs operacionais (alimentação, transporte, alojamento, coordenação técnica, delegação e resultados).

### 8.1. Inventário Detalhado por PWA

#### PWA: Alimentação
- **Home:** `src/pages/pwa/alimentacao/AlimentacaoHomePage.tsx`. Exibe dashboard com KPIs (refeições hoje, janelas ativas), card da janela atual com progresso de ocupação e grade de ações (Scan, Buscar, Janelas, Histórico, Lista).
- **Header:** Utiliza `PwaHeader` compartilhado. Elementos: Ícone `UtensilsCrossed`, Título "Alimentação", Subtítulo (Etapa ativa via context), Switcher de Idioma (PT/ES), Botão Sair.
- **Footer/Bottom Bar:** Não possui barra inferior fixa na home (usa grade de ações).
- **Botão Voltar:** Presente em todas as telas internas via `PwaHeader` (prop `backTo`). No Scan, volta para a home do módulo.
- **Atualizar Dados:** Integrado no `PwaHeader` via componente `PwaRefreshButton` (ícone de recarga). Limpa caches e recarrega a página.
- **Indicadores de Estado:** `OfflineSyncStatus` visível no topo do container. Mostra contagem de consumos pendentes.
- **Contexto Operacional:** Exibido no card "Janela atual" (Nome da refeição, horário e status "Aberta").

#### PWA: Transporte
- **Home:** `src/pages/pwa/transporte/TransporteHomePage.tsx`. Exibe KPIs (embarques, viagens, pendentes), busca de rotas e lista de viagens categorizadas (Minhas, Disponíveis, Outros).
- **Header:** Utiliza `PwaHeader` compartilhado. Elementos: Ícone `Bus`, Título "Transporte", Switcher de Idioma, Botão Sair.
- **Footer/Bottom Bar:** Possui `PwaBottomBar` na home com botão fixo "Escanear QR de Embarque".
- **Botão Voltar:** Presente no `PwaHeader`. Na home, o `backTo` aponta para `/pwa` (Landing Page).
- **Indicadores de Estado:** `OfflineSyncStatus` visível no dashboard.
- **Contexto Operacional:** Cada card de viagem indica a rota, veículo e contagem de passageiros embarcados.

#### PWA: Alojamento
- **Home:** `src/pages/pwa/alojamento/AlojamentoHomePage.tsx`. Exibe seletor de local (lodging unit), KPIs (ocupados, livres, reservados), lista de blocos e grade de ações.
- **Header:** Utiliza `PwaHeader` compartilhado. Ícone `Building`, Título "Alojamento".
- **Footer/Bottom Bar:** Possui barra inferior fixa customizada na tela de Ocupação (`AlojamentoOcupacaoPwaPage.tsx`) com botões para Scanner e Lista.
- **Indicadores de Estado:** Mostra status de conexão (ícone Wifi) e contagem de sincronização pendente explicitamente no topo da home.
- **Contexto Operacional:** Seletor de local define o contexto da unidade de alojamento ativa.

#### PWA: Coordenação Técnica
- **Home:** `src/pages/pwa/coordenacao/CoordenacaoHomePage.tsx`. Dashboard de partidas (hoje, em curso, finalizadas), alertas de ocorrências pendentes, agenda do dia e grade de ações.
- **Header:** `PwaHeader` com ícone `Trophy` e título "Coordenação".
- **Contexto Operacional:** Indicadores de partidas "Em curso" com status "Live".

#### PWA: Delegação
- **Home:** `src/pages/pwa/delegacao/DelegacaoHomePage.tsx`. Identificação da delegação/escola, KPIs de atletas/credenciados, alertas de pendências e grade de ações.
- **Header:** `PwaHeader` com ícone `Users` e título dinâmico com o nome da delegação.
- **Contexto Operacional:** Subtítulo dinâmico exibindo nome do Chefe da Delegação.

#### PWA: Resultados
- **Home:** `src/pages/pwa/resultados/ResultadosHomePage.tsx`. Lista de modalidades vinculadas ao coordenador.
- **Header:** `PwaHeader` com ícone `Trophy` e título "Lançamento de Resultados".
- **Comportamento:** Redireciona automaticamente se houver apenas uma modalidade vinculada.

---

### 8.2. Tabela Comparativa de Padrões

| Aspecto | Alimentação | Transporte | Alojamento | Coordenação | Delegação | Resultados |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Header (PwaHeader)** | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme |
| **Footer Fixo (Home)** | Ausente | Conforme | Ausente | Ausente | Ausente | Ausente |
| **Botão Voltar Consistente**| Conforme | Conforme | Conforme | Conforme | Conforme | Parcial |
| **Indicador Offline** | Conforme | Conforme | Conforme | Parcial | Ausente | Ausente |
| **Switcher de Idioma** | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme |
| **Botão Sair (Header)** | Conforme | Conforme | Conforme | Conforme | Conforme | Conforme |
| **Contexto Ativo Visível** | Conforme | Conforme | Conforme | Conforme | Conforme | Parcial |
| **Botão Atualizar (Header)**| Conforme | Conforme | Conforme | Conforme | Conforme | Conforme |

---

### 8.3. Inconsistências de Padrão Observadas

1. **Uso de Footer/Bottom Bar:** Transporte utiliza `PwaBottomBar` na home. Alojamento tem barra customizada na tela de ocupação.
2. **Indicador de Sincronização:** Alimentação e Transporte usam `OfflineSyncStatus`. Alojamento usa implementação manual.
3. **Navegação de Retorno:** A maioria dos PWAs usa `backTo="/pwa"`. Resultados depende do default.
4. **Contexto de Etapa/Evento:** `PwaHeader` gerencia isso via context, mas há resíduos de passagem manual de `subtitle`.

---

### 8.4. Mapeamento de Componentes de Layout PWA

- **`PwaHeader.tsx` (`src/components/pwa/`):** Componente central de navegação superior. Gerencia título, ícone, botões de voltar, sair, switcher de idioma e o botão de refresh.
- **`PwaScreen.tsx` (`src/components/pwa/`):** Wrapper raiz e containers mobile-first.
- **`PwaDashboardPrimitives.tsx` (`src/components/pwa/`):** KPIs e labels.
- **`PwaActionGrid.tsx` (`src/components/pwa/`):** Grade de ícones.
- **`PwaListItem.tsx` (`src/components/pwa/`):** Padrão de linha de lista.
- **`PwaRefreshButton.tsx` (`src/components/pwa/`):** Botão de "hard refresh".
- **`OfflineSyncStatus.tsx` (`src/components/pwa/`):** Alerta de registros pendentes.

---

## 9. Diagnóstico do Mecanismo de Sincronização Offline

Fase 3 entregou paridade funcional: auto-sync de 30s, retry automático (5x) e status visível.

| Mecanismo | Arquivo | Módulos | Persistência | Auto-Sync | Retry | Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **Alojamento** | `useAlojamentoOffline.ts` | Alojamento | LocalStorage | 30s | Sim | Sim |
| **Geral Operacional**| `offlineQueue.ts` | Alimentação, Transporte | LocalStorage | 30s | Sim (5x) | Sim |
| **Voucher** | `voucherOffline.ts` | Transversal | LocalStorage | 30s | Sim (5x) | Sim |

---

## 10. Mini-auditoria de Confirmação da Fase 3 (2026-04-28)

**Veredito:** SÓLIDO. Paridade validada. Sem regressões em módulos fechados. Conflitos de duplicidade na Alimentação agora são manuais (visíveis).

---

## 11. Diagnóstico de Saneamento (Fase 4 - Passo 1)

### 11.1 Remoção Segura (Concluído 2026-04-28)

| Item | Tipo | Localização | Status |
| :--- | :--- | :--- | :--- |
| `PwaLoginPage.tsx` | Página | `src/pages/pwa/PwaLoginPage.tsx` | ✅ REMOVIDO |
| `PwaModuleLayout.tsx`| Componente| `src/components/pwa/PwaModuleLayout.tsx`| ✅ REMOVIDO |
| `PwaBottomNav.tsx` | Componente| `src/components/pwa/PwaBottomNav.tsx` | ✅ REMOVIDO |
| `pwa_messages` chaves | String | `src/lib/pwa-messages.ts` | ✅ LIMPO (Voucher keys removidas) |
| `RegrasLegacyPage` | Rota | `src/App.tsx` | ✅ REMOVIDO |
| `/admin/mapa` | Rota | `src/App.tsx` | ✅ REMOVIDO |

### 11.2 Depreciação e Correções Rápidas (Concluído 2026-04-28)

| Item | Localização | Ação Realizada |
| :--- | :--- | :--- |
| `AlojamentoOcupacaoPage2`| `src/App.tsx` | ✅ Renomeado para `AlojamentoOcupacaoPwaPage` |
| `PwaRouteGuard` | `src/components/pwa/PwaRouteGuard.tsx` | ✅ Limpo de referências a `PwaBottomNav` |
| `use-toast.ts` | `src/hooks/use-toast.ts` | ✅ `TOAST_REMOVE_DELAY` ajustado para 5s |

### 11.3 Candidatos à Próxima Etapa (Passo 2 - Concluído 2026-04-28)

| Item | Tipo | Localização | Ação | Status |
| :--- | :--- | :--- | :--- | :--- |
| `PesquisaLoginPage` | Página | `src/pages/pwa/PesquisaLoginPage.tsx` | Unificar no login central. | Pendente |
| `AoVivoLoginPage` | Página | `src/pages/aovivo/AoVivoLoginPage.tsx` | Unificar no login central. | ✅ REMOVIDO |

---

## 12. Veredito de Saneamento

O Passo 2 da Fase 4 unificou o fluxo de autenticação do módulo Ao Vivo (Árbitros e Mesários) no login central `/login`. A `AoVivoLoginPage` foi fisicamente removida e as rotas `/aovivo` foram protegidas pelo `ProtectedRoute`. Uma rota de compatibilidade foi mantida em `/aovivo/login` para redirecionar acessos antigos.

---

## 13. Relatório de Entrega — Fase 4 Passo 2 (2026-04-28)

**Objetivo:** Unificação do login Ao Vivo e remoção de redundância.

### 13.1. Arquivos Removidos
- `src/pages/aovivo/AoVivoLoginPage.tsx`: Página dedicada de login removida.

### 13.2. Arquivos Modificados
- `src/App.tsx`: 
  - Removida importação lazy de `AoVivoLoginPage`.
  - Envolvidas as rotas `/aovivo` e `/aovivo/partida/:matchId` em `ProtectedRoute` com papéis `mesario`, `arbitragem`, `admin` e `coordenacao_tecnica`.
  - Configurado redirecionamento tático de `/aovivo/login` para `/login`.
- `src/pages/aovivo/AoVivoHomePage.tsx`: Removida lógica manual de redirecionamento (useEffect), agora gerida pelo guard de rota.
- `src/pages/aovivo/AoVivoMatchPage.tsx`: Removida lógica manual de redirecionamento.

### 13.3. Comportamento Validado
- **Usuário Deslogado em /aovivo:** Redirecionado para `/login` com `state.from` preservando o destino.
- **Login Bem-sucedido:** Redireciona para o destino original ou via `ROLE_REDIRECT_MAP` (que já aponta `mesario` e `arbitragem` para `/aovivo`).
- **Bookmark Antigo:** `/aovivo/login` redireciona para o login central sem quebra de fluxo.
- **Branding:** Login central mantém identidade neutra JER; `useAoVivoManifest` continua trocando a identidade visual apenas após o acesso bem-sucedido ao módulo.

### 13.4. Próximos Passos
- Unificação do login do módulo de Pesquisa (`PesquisaLoginPage`).
- Saneamento final de rotas em `PwaRouteGuard` para simplificação.

---

## 14. Relatório de Entrega — Fase 4 Passo 4 (2026-04-28)

**Objetivo:** Refator técnico do dicionário de mensagens e evolução de UX para troca de etapa em campo.

### 14.1. Refator Técnico (Dicionário de Mensagens)
- **Arquivo Renomeado:** `src/lib/pwa-messages.ts` -> `src/lib/systemMessages.ts`.
- **Escopo:** O dicionário agora é reconhecido como "do sistema", refletindo seu uso compartilhado entre PWAs e Admin.
- **Funções Renomeadas:** `getPwaMessage` migrado para `getSystemMessage` (mantido alias para compatibilidade onde necessário).
- **Consumidores Atualizados:** Todos os módulos operacionais (Alimentação, Transporte, Alojamento) agora importam do novo caminho.

### 14.2. Evolução de UX (Troca de Etapa Voluntária)
- **Header Interativo:** O nome da etapa ativa no `PwaHeader` agora é clicável e leva diretamente à tela de configuração.
- **Atalho no Menu:** Adicionada a opção "Trocar Etapa de Trabalho" no menu de switcher de módulos do `PwaLayout`.
- **Bloqueio de Segurança:** Implementada trava na tela de seleção de etapa que impede a troca caso existam registros offline pendentes (Alimentação, Transporte, Alojamento ou Voucher). O operador é alertado a sincronizar os dados primeiro.
- **Invalidação de Contexto:** A troca voluntária de etapa agora limpa automaticamente caches específicos da etapa anterior (janelas de alimentação e locais de alojamento selecionados) para evitar contaminação de dados.
- **Auditoria:** Cada troca voluntária de etapa é registrada em `audit_events` com detalhamento da origem, destino e responsável.

### 14.3. Arquivos Modificados
- `src/lib/systemMessages.ts` (Renomeado e atualizado)
- `src/components/pwa/PwaHeader.tsx` (Header clicável)
- `src/components/pwa/PwaLayout.tsx` (Atalho no menu e novos ícones)
- `src/pages/pwa/PwaSelectionFallback.tsx` (Lógica de trava, auditoria e UX)
- + Consumidores de mensagens: `AlimentacaoScanPage.tsx`, `AlojamentoScanPage.tsx`, `TransporteScanPage.tsx`, `TransporteEmbarquePage.tsx`, `ManualBoardingDialog.tsx`.

### 14.4. Comportamento Validado
- **Troca Bloqueada:** Com fila offline populada, o botão de confirmação é desabilitado e um alerta vermelho é exibido.
- **Retorno de Fluxo:** Após a troca voluntária, o operador retorna automaticamente para a tela onde estava, mantendo o fluxo operacional.
- **Paridade:** O padrão visual segue rigorosamente o design system consolidado na Fase 2.
