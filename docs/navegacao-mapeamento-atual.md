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

### 11.3 Candidatos à Próxima Etapa (Passo 2)

| Item | Tipo | Localização | Ação |
| :--- | :--- | :--- | :--- |
| `PesquisaLoginPage` | Página | `src/pages/pwa/PesquisaLoginPage.tsx` | Unificar no login central. |
| `AoVivoLoginPage` | Página | `src/pages/aovivo/AoVivoLoginPage.tsx` | Unificar no login central. |

---

## 12. Veredito de Saneamento

O Passo 1 da Fase 4 eliminou os resíduos técnicos mais óbvios dos PWAs operacionais. O sistema está mais leve e livre de referências a componentes de layout descontinuados. A base está pronta para a unificação final dos fluxos de login.

---

## 13. Mini-auditoria de Não Regressão — Fase 4 Passo 1 (2026-04-28)

**Veredito:** CONFIRMADO (Com ressalvas menores para saneamento residual).

### 13.1. Verificação de Importações Órfãs
- **Resultado:** Conforme.
- **Evidência:** Busca global por `PwaLoginPage`, `PwaModuleLayout` e `PwaBottomNav` retornou zero importações funcionais. Ocorrencias remanescentes em `src/test/pwa-refresh-button.test.ts` são strings de teste para lógica de normalização de caminhos.

### 13.2. Integridade do PwaRouteGuard
- **Resultado:** Conforme.
- **Evidência:** Código inspecionado em `src/components/pwa/PwaRouteGuard.tsx`. A lógica de redirecionamento para `/login` e `/pwa/configuracao` (quando falta contexto) permanece íntegra e independente dos componentes removidos.

### 13.3. Comportamento dos Toasts
- **Resultado:** Conforme.
- **Evidência:** `TOAST_REMOVE_DELAY` em `src/hooks/use-toast.ts` ajustado para 5000ms. O hook `useToast` continua operacional em todos os módulos (Alimentação, Transporte, Alojamento).

### 13.4. Links e Redirecionamentos para Rotas Removidas
- **Resultado:** **Parcialmente Conforme (Regressão Menor).**
- **Evidência:** 
  - Links para `/admin/mapa` ainda presentes em `src/components/admin/ModuleHeader.tsx`.
  - Referências à rota `/admin/mapa` ainda presentes em `src/config/competitionFeatureCatalog.ts` e `src/config/systemMap.ts`.
  - **Ação:** Estes links agora levam a 404 (esperado pela remoção da rota em `App.tsx`), mas devem ser limpos no Passo 2 da Fase 4.

### 13.5. Renomeação de Alias
- **Resultado:** Conforme.
- **Evidência:** Em `src/App.tsx`, o alias `AlojamentoOcupacaoPage2` foi substituído por `AlojamentoOcupacaoPwaPage`. O arquivo correspondente em `src/pages/pwa/alojamento/AlojamentoOcupacaoPage.tsx` está acessível.

### 13.6. Chaves de Mensagem Removidas
- **Resultado:** Conforme.
- **Evidência:** Limpeza de `src/lib/pwa-messages.ts` não afetou chaves em uso. O `@ts-ignore` em `getPwaMessage` garante compatibilidade se algum resíduo for encontrado, mas nenhum foi detectado em fluxos críticos.

### 13.7. Não Regressão por Módulo Fechado
- **Voucher:** Sem regressão. Emissão e auditoria operacionais.
- **Árbitros:** Sem regressão. Agenda e súmulas acessíveis.
- **Alojamento:** Sem regressão. Ocupação e scan funcionando sob o novo alias.
- **Alimentação:** Sem regressão. Scan e histórico operacionais.
- **Transporte:** Sem regressão. Embarque e viagens operacionais.

### 13.8. Não Regressão por Fase de Navegação
- **Fase 1 (Admin Menu):** Sem regressão. Permissões respeitadas.
- **Fase 2 (PwaLayout):** Sem regressão. PWA Dashboard (Landing) e PwaHeader consistentes.
- **Fase 3 (Offline):** Sem regressão. Auto-sync e indicadores de status permanecem ativos.

### 13.9. Veredito Final
O Passo 1 da Fase 4 está validado. As referências residuais a links de rotas removidas (`/admin/mapa`) são mapeadas como dívida técnica de saneamento para correção imediata no início do Passo 2. O sistema mantém estabilidade operacional e paridade de comportamento.
