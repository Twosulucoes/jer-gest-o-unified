# Diagnóstico Atual: Módulo de Registros (JER Gestão)

Este documento descreve o estado atual dos componentes, tabelas, APIs e fluxos relacionados a registros de atividades esportivas, boletins, evidências OSC e consumo externo de dados no JER Gestão.

## PASSO 1 — INVENTÁRIO DA TELA DE BOLETINS

### Localização e Acesso
- **Rota:** `/admin/relatorios/boletins` (e `/admin/boletins` via redirecionamento).
- **Componentes Principais:** `BulletinRouter.tsx`, `useBulletinData.ts`, `bulletinPdfExporter.tsx`.
- **Perfis de Acesso:** Admin e Perfis de Coordenação/Relatórios.

### Funcionalidade Atual
- **Fluxo do Usuário:** O usuário seleciona um Evento, Prova (Modalidade/Categoria/Gênero) e opcionalmente uma Fase. O sistema busca os resultados publicados e renderiza uma prévia formatada baseada na "família" da modalidade (Score, Sets, Combat, Time, Mark).
- **Granularidade:** A geração é feita por **Prova/Etapa**, mas a API suporta filtro por `bulletin_number` (Boletim Diário).
- **Formatos de Exportação:** 
  - **PDF:** Via `bulletinPdfExporter.tsx` (Biblioteca React-PDF).
  - **XLSX:** Via `bulletinXlsxExporter.ts`.
- **Estado Funcional:** **Operacional**. Possui validações integradas para partidas sem horário, sem participantes ou finalizadas sem resultados.

## PASSO 2 — INVENTÁRIO DA API PÚBLICA PARA O PORTAL EXTERNO

### Endpoints Identificados (Edge Functions)
1. **`public-results`**
   - **Caminho:** `/functions/v1/public-results`
   - **Método:** GET
   - **Autenticação:** Opcional (via header `x-site-token`).
   - **Dados:** Retorna lista de resultados publicados (`public_results_view`).
   - **Estado:** Operacional, com cache (max-age 60s a 300s).

2. **`public-events`**
   - **Caminho:** `/functions/v1/public-events`
   - **Método:** GET
   - **Dados:** Lista eventos que possuem resultados publicados.
   - **Estado:** Operacional.

3. **`generate-bulletin`**
   - **Caminho:** `/functions/v1/generate-bulletin`
   - **Método:** POST
   - **Função:** Gera e armazena o arquivo PDF do boletim no storage `bulletins` e retorna a URL pública.

### Estrutura de Dados (API Pública)
Os dados são extraídos da view `public_results_view`, garantindo que apenas registros com `result_status = 'publicado'` sejam expostos.

## PASSO 3 — INVENTÁRIO DO CADASTRO DE PARTIDAS E REGISTROS DE JOGO

### Estrutura de Dados
- **Tabelas Principais:** 
  - `competition_matches`: Cabeçalho da partida (data, hora, local, fase, grupo, status).
  - `competition_match_entries`: Vinculação de participantes (lado A/B, equipe ou atleta).
  - `competition_match_results`: Registro do desfecho (placar, posição, tempo, distância, detalhe de combate).
- **Fluxo de Registro:** Atualmente centralizado no "Módulo de Competição" (Central da Competição). Não há, no momento, uma tela de "Registro Rápido" ou "Partida Avulsa" que ignore a estrutura de Fases/Grupos.

## PASSO 4 — INVENTÁRIO DO MÓDULO EVIDÊNCIAS OSC

### Localização e Funcionalidade
- **Rota:** `/admin/evidencias-osc`
- **Componente:** `EvidenciasOSCPage.tsx`
- **Funcionalidade:** Upload de arquivos (fotos/documentos) com metadados:
  - Módulo (Alimentação, Alojamento, Transporte, Competição, Geral).
  - Tipo de evidência e descrição.
  - Status (Pendente, Aprovada, Rejeitada).
- **Filtragem Contextual:** Implementada. Usuários comuns só veem evidências de seus respectivos módulos, enquanto Admin/Secretaria veem tudo.
- **Estado Funcional:** **Operacional**, integrado ao Storage `operational-evidence`.

## PASSO 5 — INVENTÁRIO DAS DELEGAÇÕES E EQUIPES

### Estrutura e Relacionamento
- **Delegações (`delegations`):** Cadastro funcional vinculado a Instituições. Campos: Nome da Escola, Cidade, Slugs, Contatos.
- **Equipes (`teams`):** Entidade separada. Uma Delegação pode ter múltiplas Equipes (ex: Vôlei Masc, Vôlei Fem).
- **Relacionamento:** `teams` possui `delegation_id`. No futuro módulo de Registros, a consulta por Delegação deve considerar as Equipes vinculadas para modalidades coletivas.

## PASSO 6 — INVENTÁRIO DE RELATÓRIOS E EXPORTAÇÕES

- **Central de Relatórios:** `/reports` (Infratestrutura robusta com filtros e presets).
- **Relatórios de Etapa:** `StageReportsPage.tsx`.
- **Relatórios Específicos:** Medalhas (`medalTablePdfExporter`), OSC (`oscPdfExporter`), Escala de Árbitros (`escalaExport`).
- **Estado:** Operacional. O `oscPdfExporter` é o candidato natural para a base do relatório formal de prestação de contas OSC.

## PASSO 7 — INVENTÁRIO DO MÓDULO DE ÁRBITROS

- **Tabela:** `match_user_assignments`.
- **Campos:** `match_id`, `user_id`, `role` (Função), `acceptance_status`.
- **Integração:** O futuro módulo de registros pode consumir esta tabela via `match_id` para identificar quem atuou na partida sem necessidade de novos cadastros.

## PASSO 8 — FEATURE FLAGS POR EVENTO

- **Mecanismo:** Atualmente baseado no `competitionFeatureCatalog.ts`.
- **Configuração:** Existe a `SuperConfigPage.tsx` e `IndividualConfigEditor.tsx` que permitem gerenciar configurações por evento/prova.
- **Estado:** Funcional para ativar/desativar lógicas de competição, mas pode precisar de uma flag específica na tabela de `events` ou `event_settings` para o novo módulo de Registros.

## PASSO 9 — TELAS DE COORDENAÇÃO TÉCNICA E MESÁRIO

- **Coordenação Técnica (PWA):** `/pwa/coordenacao-tecnica`. Possui visualização de agenda, partidas e resultados.
- **Mesário (PWA Ao Vivo):** Espaço para lançamento de pontos em tempo real (scoreboard).
- **Fluxo de Lançamento:** Hoje o lançamento de "resultado final" acontece no PWA de Coordenação ou na Central de Resultados Admin. O módulo de Registros poderia ser uma simplificação ou extensão desses PWAs.

## PASSO 10 — CONSOLIDAÇÃO DE ACHADOS

| Categoria | Artefatos |
| :--- | :--- |
| **Aproveitáveis** | Estrutura de `competition_matches/entries/results`, API Pública (`public-results`), Cadastro de Delegações, Sistema de Evidências OSC. |
| **Retrabalho** | UI de Boletins (tornar mais amigável/diária), Fluxo de Lançamento de Partida (criar versão simplificada/avulsa), Exportação OSC (especificar para Registros). |
| **Criar do Zero** | Dashboard de "Resumo do Dia" para Coordenação Técnica, Fluxo de Assinatura Digital/Formalização de Súmula de Registro. |

---
*Auditoria realizada em 2026-04-28 como parte do planejamento do novo módulo de Registros.*

## IMPLEMENTAÇÃO — FASE 1 (2026-04-28)

### Resumo da Entrega
A Fase 1 do módulo de Registros foi implementada, introduzindo o caminho de registro simplificado de partidas para eventos que optarem por não utilizar a estrutura completa de competição.

### Alterações Realizadas
- **Schema Evolutivo:** 
  - Adicionada coluna `source` ('simple' vs 'complex') em `competition_matches`.
  - Adicionada flag `registros_mode_enabled` em `events`.
  - Flexibilização de integridade (phase_id opcional para partidas 'simple').
- **Super Admin:** Nova interface de controle da flag Modo Registros na tela de gestão de eventos, com trilha de auditoria (`registros_mode_logs`).
- **Web Admin:** Novo módulo em `/admin/registros` para Coordenação Técnica e Secretaria, permitindo cadastro rápido de partidas e resultados em 3 etapas (Informação, Equipes, Resultado).
- **PWA Mesário:** Novo módulo em `/pwa/registros` para operação em campo, integrado ao layout mobile-first com UX de lista cronológica e busca rápida.
- **Navegação Condicional:** 
  - Em eventos com Modo Registros ATIVO: Oculta itens de Competição complexa (Painel, Central) e exibe item Registros.
  - Em eventos com Modo Registros DESATIVADO: Comportamento original preservado.

### Arquivos Tocados
- **Banco:** Schema e RLS via migração.
- **Hooks:** `src/hooks/useRegistros.ts` (Core logic de criação simplificada).
- **Super Admin:** `src/pages/super/SuperEventosPage.tsx`.
- **Web Admin:** `src/pages/admin/registros/RegistrosPage.tsx`, `src/pages/admin/registros/RegistroFormDialog.tsx`.
- **PWA:** `src/pages/pwa/registros/PwaRegistrosPage.tsx`.
- **Infra/Layout:** `src/App.tsx`, `src/components/AdminLayout.tsx`, `src/components/pwa/PwaLayout.tsx`.

### Veredito de Não-Regressão
Testado e validado que eventos existentes mantêm o fluxo complexo operacional. A nova estrutura alimenta as views existentes (`public_results_view`), garantindo transparência para boletins e APIs públicas.

---
*Implementação da Fase 1 concluída em 2026-04-28.*

## MINI-AUDITORIA DE CONFIRMAÇÃO — FASE 1 (2026-04-28)

### 1. Evolução de Schema
- **Conforme.** Coluna `source` em `competition_matches` com default `'complex'`. Constraint `complex_matches_require_phase` validada: permite `phase_id` nulo apenas se `source = 'simple'`, preservando integridade para o módulo complexo.

### 2. Flag Modo Registros
- **Conforme.** Flag `registros_mode_enabled` (boolean, default false) na tabela `events`. Controle de escrita restrito a **Super Admin** via interface no painel `/super/eventos`. Trilha de auditoria em `registros_mode_logs` funcional.

### 3. Integração com Consumidores
- **Boletim:** **Conforme.** A lógica de consulta em `useLancamentoResultados.ts` busca partidas por `event_id` e `sport_event_id`, sem filtrar por phase/group, garantindo que partidas `simple` apareçam.
- **API Pública:** **Conforme.** A `public_results_view` baseia-se em `competition_match_results`, sem JOINs obrigatórios com tabelas estruturais de competição que excluiriam partidas simplificadas.
- **Generate Bulletin:** **Conforme.** Endpoint suporta a criação de boletins baseados em resultados publicados, independentemente da origem da partida.

### 4. RLS e Fluxos
- **Conforme.** Políticas para `Admin`, `Secretaria` e `Coordenação Técnica` permitem gestão total de partidas. `Mesário` possui acesso de leitura às partidas designadas. A flag de evento é protegida por política exclusiva de `super_admin`.

### 5. Navegação Condicional
- **Conforme.** `AdminLayout` e `PwaLayout` atualizados com lógica de visibilidade baseada em `registros_mode_enabled`. O switcher de evento reage corretamente à flag, alternando entre o menu de "Competição" (complexo) e "Registros" (simples).

### 6. PWA de Registros
- **Conforme.** Integrado ao `PwaLayout` com footer e indicadores de status. Suporte a fila offline garantido pelo padrão de sincronização global e paridade com demais módulos operacionais.

### 7. Não Regressão
- **Módulos Fechados:** Sem regressão. Vouchers, Árbitros, Alojamento, Alimentação e Transporte operam normalmente. O consumo de `match_user_assignments` por Registros é não-destrutivo.
- **Reformulação da Navegação:** Sem regressão. Fases 1 a 4 preservadas, com o novo módulo Registros seguindo rigorosamente os padrões de layout e UX estabelecidos.

### Veredito Final
**FASE 1 CONFIRMADA.** A base técnica para o módulo de Registros está sólida, segura e transparente para os consumidores de dados existentes. Pronta para iniciar a Fase 2 (Relatórios OSC).

---
*Mini-auditoria realizada em 2026-04-28.*

## IMPLEMENTAÇÃO — FASE 2 (2026-04-28)

### Resumo da Entrega
Implementação do Relatório de Prestação de Contas OSC consolidado por etapa, com configuração híbrida institucional e extensão do módulo de evidências fotográficas.

### Alterações Realizadas
- **Configuração Híbrida:** 
  - Nova tabela `event_osc_configs` para dados do convênio por evento.
  - Tela `/admin/registros/configuracao-osc` para gestão de dados institucionais (Órgão, OSC, CNPJ, Responsável).
- **Extensão de Evidências:** 
  - Tabela `operational_evidence` estendida com metadados OSC (`osc_category`, `caption`, `match_id`, `photo_at`, `location_name`).
  - UI de upload e gestão em `/admin/evidencias-osc` atualizada para suportar metadados formais e vínculo com partidas.
- **Relatório OSC (PDF):**
  - Gerador `oscPdfExporter` reformulado para incluir cabeçalho institucional dinâmico, resumo executivo e galeria de evidências aprovadas.
  - Página `/admin/relatorios/osc` integrada com a nova configuração e fluxo de evidências.
- **Navegação:** Inclusão de atalho rápido para configuração OSC na tela de relatórios.

### Veredito de Não-Regressão
Validado que fluxos de Alimentação, Alojamento e Transporte que usam evidências operacionais mantêm o funcionamento original, ignorando os campos opcionais de OSC. Estatísticas do relatório consolidam partidas de ambas as fontes (`simple` e `complex`).

---
*Implementação da Fase 2 concluída em 2026-04-28.*

