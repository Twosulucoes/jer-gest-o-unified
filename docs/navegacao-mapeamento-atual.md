# Mapeamento de Navegação — JER Gestão

Este documento descreve o estado real da navegação do sistema JER Gestão, consolidando rotas, menus, permissões e componentes de layout em 28 de abril de 2026.

> **Status:** Fase 3 da Reformulação da Navegação concluída (Paridade de Robustez Offline entre mecanismos).

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
- **JER Ao Vivo:** `/aovivo` (Mesa e Arbitragem).

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
- **`PwaRouteGuard`:** Garante que o usuário PWA tenha um Evento e Etapa selecionados antes de operar.
- **`ProtectedRoute`:** Valida autenticação e roles gerais via `react-router`.

---

## 7. Observações de Consistência e Inconsistências

1. **Unificação de Login:** O login foi unificado em `/login`, mas ainda existem referências a `PwaLoginPage` e `PesquisaLoginPage` no código (algumas descontinuadas).
2. **Contexto Etapa:** Módulos PWA exigem `activeStageId` em `/pwa/configuracao` antes de permitir o acesso às ferramentas de campo.
3. **Redirecionamento:** O `/` redireciona para `/admin` ou `/pwa` dependendo do perfil detectado no `Index.tsx`.
4. **Duplicidade de Telas:** Existem telas com nomes similares como `AlojamentoOcupacaoPage` (Admin) e `AlojamentoOcupacaoPage2` (PWA).

---

## 8. Complemento PWAs Padrão de Navegação

Este complemento detalha o padrão de navegação e componentes de layout dos PWAs operacionais (alimentação, transporte, alojamento, coordenação técnica, delegação e resultados).

### 8.1. Inventário Detalhado por PWA

#### PWA: Alimentação
- **Home:** `src/pages/pwa/alimentacao/AlimentacaoHomePage.tsx`. Exibe dashboard com KPIs (refeições hoje, janelas ativas), card da janela atual com progresso de ocupação e grade de ações (Scan, Buscar, Janelas, Histórico, Lista).
- **Header:** Utiliza `PwaHeader` compartilhado. Elementos: Ícone `UtensilsCrossed`, Título "Alimentação", Subtítulo (Etapa ativa via context), Switcher de Idioma (PT/ES), Botão Sair.
- **Footer/Bottom Bar:** Não possui barra inferior fixa na home (usa grade de ações); Telas internas como Scan também não possuem footer fixo (botão de scan é central).
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
- **Footer/Bottom Bar:** Possui barra inferior fixa customizada (não usa `PwaBottomBar`) na tela de Ocupação (`AlojamentoOcupacaoPage.tsx`) com botões para Scanner e Lista.
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

1. **Uso de Footer/Bottom Bar:** Apenas o PWA de Transporte utiliza o componente `PwaBottomBar` de forma consistente na home. O PWA de Alojamento implementa uma barra fixa customizada na tela de ocupação, enquanto os outros módulos usam apenas `PwaActionGrid` no corpo do scroll.
2. **Indicador de Sincronização:** Alimentação e Transporte usam o componente `OfflineSyncStatus`, enquanto o Alojamento usa uma implementação manual de ícones de Wifi e contadores no topo da tela.
3. **Navegação de Retorno:** A maioria dos PWAs usa `backTo="/pwa"` para retornar à Landing Page, mas o PWA de Resultados no `PwaHeader` não define `backTo` explicitamente na Home, dependendo do comportamento default do navegador ou do botão Sair.
4. **Contexto de Etapa/Evento:** No `PwaHeader`, o nome da etapa é exibido automaticamente via context, mas alguns PWAs (como Alimentação) tentam passar `subtitle` manualmente, gerando duplicidade ou inconsistência visual na segunda linha do header.
5. **Acesso ao Scanner:** Transporte coloca o Scanner em um botão fixo no rodapé. Alimentação e Alojamento colocam na grade de ações (`ActionGrid`) e também dentro de contextos específicos (card de janela ou barra customizada).

---

### 8.4. Mapeamento de Componentes de Layout PWA

- **`PwaHeader.tsx` (`src/components/pwa/`):** Componente central de navegação superior. Gerencia título, ícone, botões de voltar, sair, switcher de idioma e o botão de refresh. É o componente mais unificado do sistema operacional.
- **`PwaScreen.tsx` (`src/components/pwa/`):**
  - `PwaScreen`: Wrapper raiz que aplica estilos de fundo e áreas seguras.
  - `PwaContainer`: Gerencia largura máxima mobile-first (sm, md, lg) e paddings laterais.
  - `PwaBottomBar`: Barra fixa no rodapé (usada principalmente no Transporte).
- **`PwaDashboardPrimitives.tsx` (`src/components/pwa/`):** Contém `PwaStatTriplet` (os 3 cards de KPI do topo) e `PwaSectionLabel`.
- **`PwaActionGrid.tsx` (`src/components/pwa/`):** Grade de ícones para navegação secundária dentro do módulo.
- **`PwaListItem.tsx` (`src/components/pwa/`):** Padrão de linha de lista com avatar, título e badge de status.
- **`PwaRefreshButton.tsx` (`src/components/pwa/`):** Botão de "hard refresh" integrado ao header para limpar caches.
- **`OfflineSyncStatus.tsx` (`src/components/pwa/`):** Alerta de registros pendentes de sincronização.

**Observação:** Todas as rotas operacionais agora são envoltas pelo `PwaLayout` unificado. Os mecanismos de sincronização offline (`offlineQueue.ts`, `voucherOffline.ts` e `useAlojamentoOffline.ts`) operam com paridade funcional: auto-sync de 30s, retry automático (5 tentativas) e status visível ao operador via indicadores de rodapé e centrais de conflito locais.

---

## 9. Diagnóstico do Mecanismo de Sincronização Offline (Concluído)

Este inventário descreve a robustez alcançada na Fase 3.

### 9.1 Inventário de Mecanismos

| Mecanismo | Arquivo | Módulos | Persistência | Auto-Sync | Retry | Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **Alojamento** | `useAlojamentoOffline.ts` | Alojamento | LocalStorage | 30s | Sim | Sim |
| **Geral Operacional**| `offlineQueue.ts` | Alimentação, Transporte | LocalStorage | 30s | Sim (5x) | Sim |
| **Voucher** | `voucherOffline.ts` | Transversal | LocalStorage | 30s | Sim (5x) | Sim |

### 9.2 Comportamento de Falha e Conflito
- **Retry Esgotado:** O item é marcado como `conflict` (ou `failed_retry`) e permanece na fila para intervenção manual. O indicador de "Erro" no footer do `PwaLayout` é ativado.
- **Conflito de Regra (Alimentação):** Duplicidades (erro 23505) agora são marcadas como conflito visível ao operador em vez de serem limpas automaticamente, permitindo auditoria no local.
- **Voucher:** Conflitos retornados pela RPC (já usado, revogado) param o retry e exigem resolução manual.

---

## 10. Mini-auditoria de Confirmação da Fase 3 (2026-04-28)

**Veredito:** SÓLIDO. A paridade de comportamento entre os três mecanismos de sincronização offline (Alojamento, Geral Operacional e Voucher) foi validada e está conforme o planejado. Não foram detectadas regressões críticas nos módulos fechados.

### 10.1 Paridade dos Mecanismos
| Critério | Alojamento | Geral (Alim/Transp) | Voucher | Status Final |
| :--- | :---: | :---: | :---: | :---: |
| **Auto-sync (30s)** | Conforme | Conforme (via Hook) | Conforme (via Hook) | **Conforme** |
| **Retry (5 tentativas)** | Conforme | Conforme (Contador) | Conforme (Contador) | **Conforme** |
| **Status Explícito** | Conforme | Conforme | Conforme | **Conforme** |

*Evidência:* `useAlojamentoOffline.ts` implementa auto-sync interno; `offlineQueue.ts` e `voucherOffline.ts` são servidos pelo `OfflineSyncStatus.tsx` que orquestra o loop de 30s. Todos utilizam contador de `attempts` e transições de `status` (pending -> syncing -> failed/conflict).

### 10.2 Decisão de Duplicidade na Alimentação
A regra de **Manual (Visível)** foi aplicada corretamente em `src/lib/offlineQueue.ts`.
- Erros de duplicidade (PostgreSQL code `23505`) agora marcam o item como `conflict` com mensagem clara.
- O registro permanece na fila para intervenção, sem limpeza automática (diferente da Fase 2).
- Verificado que isso não afetou `voucherOffline.ts`, que já tratava duplicidade via RPC `redeem_voucher`.

### 10.3 Não Regressão por Módulo
- **Voucher:** Fila offline mantida; paridade de retry adicionada via `voucherOffline.ts`.
- **Árbitros:** Funcionalidades do Ao Vivo (/pwa/aovivo) preservadas; navegação via prefixo /pwa validada.
- **Alojamento:** `useAlojamentoOffline.ts` mantido como referência; integração com `PwaLayout` confirmada.
- **Alimentação:** Novo comportamento de conflito manual validado; KPIs da home consistentes.
- **Transporte:** Embarque via QR continua operando com a nova fila robustecida.

### 10.4 Coerência do Footer Unificado
O `OfflineFooterIndicator` em `PwaLayout.tsx` reflete corretamente a soma das pendências de `offlineQueue` e `voucherQueue`.
- **Sync (Amber):** Mostra itens `pending` ou `failed` (aguardando retry).
- **Erro (Red):** Mostra itens em `conflict` (exige ação manual).
- **Divergência Menor:** O contador de Alojamento ainda é independente na home do módulo, mas o footer unificado garante visibilidade básica de rede/pendência.

---

## 11. Conclusão da Fase 3
A base técnica está pronta para a **Fase 4 (Saneamento)**, onde buscaremos eliminar as divergências de implementação de UI nos indicadores e centrais de conflito, movendo para uma experiência 100% idêntica em todos os módulos.

---

## 12. Diagnóstico de Saneamento (Fase 4 - Preparação)

Este diagnóstico lista os candidatos a remoção, depreciação ou unificação identificados em 28 de abril de 2026.

### 12.1 Candidatos à Remoção Segura
Itens sem referências ativas no código ou cujo uso foi explicitamente descontinuado.

| Item | Tipo | Localização | Motivo |
| :--- | :--- | :--- | :--- |
| `PwaLoginPage.tsx` | Página | `src/pages/pwa/PwaLoginPage.tsx` | Login unificado em `/login`. Mapeado como "removed" em `App.tsx`. |
| `PwaModuleLayout.tsx`| Componente| `src/components/pwa/PwaModuleLayout.tsx`| Órfão. Substituído pelo `PwaLayout.tsx` unificado na Fase 2. |
| `PwaBottomNav.tsx` | Componente| `src/components/pwa/PwaBottomNav.tsx` | Só usado pelo `PwaModuleLayout` (órfão) e `PwaRouteGuard` (legado). |
| `pwa_messages` chaves | String | `src/lib/pwa-messages.ts` | Diversas chaves de erro PWA duplicadas por `voucherMessages.ts`. |
| `RegrasLegacyPage` | Rota | `src/App.tsx` | Redirecionamento de `/admin/regras-legacy` para `/admin/regras`. |
| `/admin/mapa` | Rota | `src/App.tsx` | Redirecionamento para `/admin/sistema/diagnostico`. |

### 12.2 Candidatos à Depreciação com Aviso
Itens em uso residual que devem ser substituídos pelos novos padrões.

| Item | Tipo | Localização | Ação Recomendada |
| :--- | :--- | :--- | :--- |
| `PesquisaLoginPage` | Página | `src/pages/pwa/PesquisaLoginPage.tsx` | Migrar para o login unificado `/login` com parâmetro de contexto. |
| `AoVivoLoginPage` | Página | `src/pages/aovivo/AoVivoLoginPage.tsx` | Migrar para o login unificado `/login`. |
| `AlojamentoOcupacaoPage2`| Alias | `src/App.tsx` | Renomear alias na importação para remover o sufixo "2". |
| `PwaRouteGuard` | Componente| `src/components/pwa/PwaRouteGuard.tsx` | Limpar referências ao `PwaBottomNav` e componentes de layout antigos. |

### 12.3 Itens para Investigação Adicional
Necessário validar se o uso é intencional ou se é resíduo de módulos não migrados.

| Item | Tipo | Localização | Dúvida de Saneamento |
| :--- | :--- | :--- | :--- |
| `AlojamentoOcupacaoPage` | Página | `src/pages/admin/AlojamentoOcupacaoPage.tsx` | É a versão Admin. Validar se deve ser unificada com a versão PWA. |
| `pwa-messages.ts` | Arquivo | `src/lib/pwa-messages.ts` | Validar se deve ser completamente absorvido pelo `voucherMessages.ts`. |
| `/pwa/configuracao` | Rota | `src/App.tsx` | Usada como fallback de seleção de etapa. Validar se ainda é o fluxo desejado. |
| Migrações 20260402* | Banco | `supabase/migrations/` | Verificar se os scripts de "bootstrap" contêm tabelas nunca utilizadas. |

### 12.4 Comentários de Dívida Técnica (TODO/FIXME)
| Arquivo | Linha | Descrição |
| :--- | :--- | :--- |
| `computeProvaData.ts` | ~6 | TODO: Implement weighing status in query |
| `use-toast.ts` | ~1 | TOAST_REMOVE_DELAY de 1000000ms (HACK temporal). |

---

## 13. Veredito de Saneamento
O inventário revela que o sistema está em estado avançado de limpeza após as fases de navegação, mas a remoção física dos arquivos `PwaLoginPage`, `PwaModuleLayout` e `PwaBottomNav` é o passo imediato mais seguro. A unificação dos logins de Pesquisa e Ao Vivo é a tarefa de maior impacto para o saneamento da Fase 4.


