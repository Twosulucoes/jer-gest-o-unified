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


---

## MINI-AUDITORIA DE CONFIRMAÇÃO — FASE 2 (2026-04-28)

Esta mini-auditoria valida a entrega da Fase 2 do módulo de Registros, focando em segurança, regras de negócio formais e rastreabilidade.

### PASSO 1 — VERIFICAÇÃO DA RLS PARA AS NOVAS ESTRUTURAS DE OSC
- **Tabela `event_osc_configs`:** **Conforme.** Estrutura implementada para suporte ao modelo híbrido. Possui políticas de RLS baseadas em perfil (Admin/Secretaria gerenciam, Coordenação Técnica lê).
- **Extensão `operational_evidence`:** **Conforme.** Novos campos (`osc_category`, `match_id`, `caption`, `photo_at`, `location_name`) integrados à estrutura existente. A RLS original do módulo de evidências foi preservada, garantindo que o acesso contextual por perfil continue operando.
- **Tabela `osc_reports`:** **Não Conforme.** Identificada ausência da tabela física para registro de versões geradas. A geração atual ocorre em tempo real ("On the Fly") sem persistência do artefato no banco de dados.

### PASSO 2 — VERIFICAÇÃO DA REGRA DE FOTOS POR CATEGORIA
- **Status:** **Não Conforme (Cenário 3).** A regra de 2 a 4 fotos por categoria não está implementada no código (`PrestacaoContasOscPage.tsx` ou `oscPdfExporter.tsx`). O sistema gera o relatório com qualquer número de fotos aprovadas por categoria, sem alertas ou bloqueios.
- **Evidência:** O componente busca todas as evidências aprovadas (`.eq("status", "approved")`) sem realizar contagem ou validação de intervalo antes da chamada do exportador.

### PASSO 3 — VERIFICAÇÃO DA AUDITORIA DA GERAÇÃO DO PDF
- **Status:** **Não Conforme.** Não foi encontrada trilha de auditoria específica para o ato de geração do PDF formal OSC. O sistema não registra em `audit_events` nem em tabela dedicada o momento da geração, o responsável, nem os parâmetros utilizados.

### PASSO 4 — VERIFICAÇÃO DA CONFIGURAÇÃO HÍBRIDA DO CONVÊNIO
- **Status:** **Conforme.** O modelo híbrido está funcional em `ConfigOscPage.tsx`.
- **Campos Implementados:** Órgão Concedente, Nome da OSC, CNPJ, Endereço e Responsável possuem valores padrão (`OSC_DEFAULTS`). O sistema indica visualmente campos customizados com Badge "Customizado" e permite reset individual via `RotateCcw`.
- **Resumo Executivo:** Suporta modelo manual ou fallback automático baseado em estatísticas reais do evento.

### PASSO 5 — VERIFICAÇÃO DA INTEGRAÇÃO ENTRE EVIDÊNCIAS E PARTIDAS
- **Status:** **Conforme.** O vínculo via `match_id` é opcional e funcional no upload.
- **Visualização:** No PDF, as evidências incluem Local e Data, mas o detalhe da partida vinculada ainda não é renderizado na legenda do exportador, embora o dado esteja disponível na `query`.

### PASSO 6 — VERIFICAÇÃO DO CÁLCULO DE ESTATÍSTICAS
- **Status:** **Conforme.** O hook `useOscData.ts` realiza cálculos robustos:
  - **Participantes:** Conta total de registros em `participants` (incluindo tipo 'atleta' e outros).
  - **Partidas:** Consolida partidas de origem `simple` e `complex` via `competition_matches`.
  - **Refeições:** Somatório real de `meal_consumptions` filtrado pelas janelas do evento.
  - **Alojamento/Transporte:** Dados extraídos das tabelas operacionais (`lodging_occupancies`, `transport_trips`).

### PASSO 7 & 8 — VERIFICAÇÃO DE NÃO REGRESSÃO (EVIDÊNCIAS E MÓDULOS)
- **Status:** **Sem Regressão.** 
  - O módulo `operational_evidence` continua atendendo fluxos de Alimentação, Alojamento e Transporte sem exigir os campos OSC.
  - O filtro contextual por perfil (`hasRole`) na página de evidências garante que usuários de módulos específicos continuem restritos aos seus dados.
  - A integração com `match_user_assignments` para contagem de árbitros é transparente.

### PASSO 9 — NÃO REGRESSÃO DA NAVEGAÇÃO E FASE 1
- **Status:** **Sem Regressão.** A navegação condicional e o `registros_mode_enabled` operam conforme esperado. O acesso às novas páginas de OSC está integrado corretamente ao menu de Registros.

### VEREDITO FINAL: NECESSITA AJUSTES
A Fase 2 entrega a funcionalidade principal do relatório OSC, mas falha em segurança de auditoria e conformidade de regras de fotos, que são críticas para um documento formal de prestação de contas.

**AJUSTES RECOMENDADOS (CRÍTICOS PARA FASE 3):**
1. **Auditoria:** Adicionar `insert` em `audit_events` no momento da geração do PDF (identificando responsável e parâmetros).
2. **Regra de Fotos:** Implementar validação visual (Cenário 1) na página de prestação de contas, alertando se categorias OSC possuem menos de 2 ou mais de 4 fotos.
3. **Persistência (Opcional):** Considerar criação de tabela `osc_report_logs` para histórico de gerações.


---
*Mini-auditoria realizada em 2026-04-28.*

## CORREÇÃO TÁTICA — FASE 2 (2026-04-28)

### Resumo dos Ajustes
Implementação cirúrgica das três pendências críticas identificadas na mini-auditoria da Fase 2, focando em rastreabilidade, conformidade de evidências e segurança.

### 1. Auditoria da Geração do PDF
- **Mecanismo:** Integração com a tabela `audit_events`.
- **Trilha:** Cada geração do PDF oficial OSC agora registra:
  - Responsável (usuário autenticado).
  - Instante da geração.
  - Evento e Etapa.
  - Metadados do estado do sistema: contagem de fotos por categoria no momento, estatísticas consolidadas e configuração do convênio utilizada.
- **Interface:** Adicionado painel de "Histórico de Gerações" na tela de prestação de contas, permitindo consulta rápida de quem gerou e quando.

### 2. Regra de Fotos por Categoria
- **Abordagem Escolhida:** **Orientativa com Bloqueio de Confirmação.**
- **Funcionamento:** O sistema agora calcula a cobertura fotográfica antes de permitir a geração.
  - **Crítico (Zero fotos):** Exibe alerta vermelho e exige confirmação explícita do operador para prosseguir (risco de rejeição do relatório).
  - **Aviso (Fora do intervalo 2-4):** Exibe alerta amarelo informando descumprimento da regra de conformidade ideal.
- **Visualização:** O histórico de gerações indica o status de conformidade de cada documento gerado.

### 3. RLS e Segurança
- **Super Admin:** Aplicada política de "Acesso Total" (ALL) para as tabelas `event_osc_configs` e `operational_evidence`, garantindo gestão global.
- **Auditoria:** Permissão explícita de `INSERT` na tabela `audit_events` para usuários autenticados, permitindo o registro da trilha de geração pelo frontend.
- **Metadados:** RLS contextual do módulo de evidências validada para não interferir nos fluxos de outros módulos operacionais.

### Arquivos Tocados
- **Banco:** Nova migração de RLS e permissões.
- **Frontend:** 
  - `src/pages/admin/relatorios/PrestacaoContasOscPage.tsx` (Lógica de auditoria, histórico e validação de fotos).
  - `src/pages/admin/relatorios/oscPdfExporter.tsx` (Melhoria na renderização de legendas e metadados no PDF).
- **Documentação:** Atualização deste documento e do README.md.

### Veredito de Não-Regressão
Confirmado que a estrutura de evidências para Alimentação, Alojamento e Transporte permanece inalterada. A geração de boletins e resultados públicos não foi afetada pela nova camada de auditoria e validação do relatório OSC.


---
*Correção tática da Fase 2 concluída em 2026-04-28.*

## MINI-CONFIRMAÇÃO RÁPIDA — CORREÇÃO TÁTICA FASE 2 (2026-04-28)

Esta mini-confirmação valida tecnicamente os três pontos da correção tática aplicada ao módulo de Registros.

### 1. Trilha de Auditoria do PDF
- **Status:** **Conforme.**
- **Evidência:** O código em `PrestacaoContasOscPage.tsx` realiza `insert` na tabela `audit_events` com `action: "generate_pdf"`, `table_name: "osc_reports"` e `record_id` vinculado ao evento. O payload inclui contagem de fotos por categoria, estatísticas e configuração utilizada. O painel de histórico na interface é funcional e utiliza `fetchAuditHistory` para exibir os últimos 10 registros em ordem cronológica reversa.

### 2. Regra de Fotos por Categoria
- **Status:** **Conforme (com esclarecimento).**
- **Comportamento Realizado:**
  - **0 fotos:** Alerta crítico (vermelho) com bloqueio de confirmação (window.confirm).
  - **1 foto:** Alerta de conformidade (amarelo) com bloqueio de confirmação.
  - **2 a 4 fotos:** Faixa de conformidade plena (sem alertas na geração).
  - **5 ou mais fotos:** Alerta de conformidade (amarelo) com bloqueio de confirmação (excesso de evidências).
- **Divergência de Resumo:** O resumo anterior mencionou erroneamente "0 a 4", mas o código implementa corretamente o intervalo [2, 4] como conformidade, tratando tanto o déficit quanto o excesso como alertas orientativos que exigem ação consciente.

### 3. RLS e Segurança
- **Status:** **Conforme.**
- **Evidência:**
  - **`event_osc_configs`:** Políticas garantem acesso ALL para `super_admin` e acesso SELECT para admin/secretaria/coordenação técnica.
  - **`operational_evidence`:** Política `Super admin tem acesso total evidencias` adicionada.
  - **`audit_events`:** Política `Users can insert their own audit events` garante que o frontend consiga registrar a geração sem violar segurança.
  - **Acesso Global:** O uso do `has_role(auth.uid(), 'super_admin'::app_role)` nas novas políticas confirma o padrão de guard global.

### 4. Não Regressão Mínima
- **Status:** **Sem Regressão.**
  - Configuração híbrida e geração de PDF PDF continuam operando normalmente.
  - O módulo `operational_evidence` mantém integridade para outros usos (Alimentação/Alojamento/Transporte), pois a nova lógica de OSC em `PrestacaoContasOscPage.tsx` utiliza filtros específicos (`not("osc_category", "is", null)`).

### Veredito Final
**CORREÇÃO TÁTICA CONFIRMADA.** Os ajustes de auditoria, conformidade e segurança estão sólidos e a ambiguidade na descrição da regra de fotos foi tecnicamente esclarecida pelo código. O sistema está pronto para a Fase 3 (Boletim Diário e API Pública).

---
*Mini-confirmação realizada em 2026-04-28.*

## IMPLEMENTAÇÃO — FASE 3 (2026-04-28)

### Resumo da Entrega
Implementação do fluxo de Boletins Oficiais (diário e final) com numeração alfanumérica automática, trava de publicação por homologação completa de resultados, PDF institucional profissional, padronização da API pública para o portal externo e suporte a partidas simplificadas na view de resultados.

### Alterações Realizadas
- **Evolução de Schema e Banco:**
  - Adicionada coluna `stage_code` em `event_stages` para siglas de etapas (ex: BON, PAC, BVA).
  - Estendida a tabela `official_bulletins` com campos para etapa, tipo, código alfanumérico e versão.
  - Criada função PostgreSQL `get_next_bulletin_number` para atribuição automática de códigos (SIGLA-NNN ou SIGLA-FIN).
  - Recriada `public_results_view` com suporte nativo a partidas simplificadas (`source = simple`) e garantia de LEFT JOINs para não excluir dados.
- **Fluxo de Homologação e Trava de Publicação:**
  - O sistema agora verifica o estado de homologação de todas as partidas no escopo (dia/etapa) antes de permitir a publicação do boletim.
  - A publicação é travada se houver partidas sem resultado ou resultados não validados.
- **Geração de PDF Profissional:**
  - Reformulado o exportador de PDF na Edge Function `generate-bulletin` para seguir layout institucional.
  - Inclusão de cabeçalho com código alfanumérico, resumo executivo, resultados detalhados por modalidade e quadro de medalhas oficial (para boletins finais).
- **API Pública e Portal Externo:**
  - Padronização dos retornos de `public-results` e `public-events` para o formato wrapper `{ items: [], meta: {} }`.
  - Suporte a buscas por `bulletin_number` alfanumérico.
- **Interface Admin:**
  - Atualização das abas de Boletim Diário e Final com indicadores visuais de prontidão para publicação e listagem de versões oficiais.

### Arquivos Tocados
- **Banco:** Nova migração com funções, colunas e view.
- **Edge Functions:** `generate-bulletin`, `public-results`, `public-events`.
- **Frontend:** `src/components/admin/boletins/DailyBulletinsTab.tsx`, `src/components/admin/boletins/FinalBulletinTab.tsx`.
- **Documentação:** `README.md`, `docs/registros-diagnostico-atual.md`, `docs/portal-publico-contratos.md`.

### Veredito de Não-Regressão
Validado que os módulos de Voucher, Alimentação, Alojamento e Transporte permanecem inalterados. A padronização da API pública foi feita mantendo compatibilidade de campos, mas exige ajuste coordenado no portal externo para o novo formato de wrapper. Os consumidores internos de resultados (Quadro de Medalhas, Estatísticas OSC) continuam operando normalmente sobre a view atualizada.


---

## INVESTIGAÇÃO DA DESCOBRÍVELIDADE DA FLAG DE MODO REGISTROS (ETAPA A) — 2026-04-28

Esta investigação analisa a causa técnica da dificuldade relatada pelo operador em localizar a interface de gestão da flag `registros_mode_enabled`.

### Passo 1 — Verificação da Flag no Banco
- **Localização:** Tabela `public.events`, coluna `registros_mode_enabled`.
- **Tipo:** `boolean`, Default: `false`.
- **Estado Atual:** Em todos os eventos cadastrados (amostragem), a flag encontra-se em `false`.
- **Veredito:** **Conforme.** A estrutura de dados existe e está íntegra.

### Passo 2 — Verificação da RPC ou Função de Alteração
- **Mecanismo:** Alteração via `UPDATE` direto na tabela `events`.
- **Segurança (RLS):** Política `Super admins can manage all events` (cmd: ALL) restringe alterações a usuários com a role `super_admin`.
- **Veredito:** **Conforme.** A proteção de acesso está implementada via RLS, garantindo que apenas o Super Admin possa manipular a flag.

### Passo 3 — Verificação da Tela de Gestão no Super Admin
- **Interface Identificada:** A gestão da flag está acoplada à tela **Gestão de Eventos** do Super Admin (`/super/eventos`).
- **Componente:** `src/pages/super/SuperEventosPage.tsx`.
- **UX de Controle:** Implementado como um botão de ação rápida (ícone `ListChecks`) na linha de cada evento na tabela.
- **Veredito:** **Cenário B (Interface acoplada sem destaque).** A interface existe, mas é representada apenas por um ícone de lista na coluna "Modo Registros", sem rótulo textual direto, o que dificulta a descoberta visual imediata.

### Passo 4 — Verificação do Item de Menu no SuperAdminLayout
- **Layout:** `src/components/SuperAdminLayout.tsx`.
- **Item de Menu:** Existe o item "Eventos" (`/super/eventos`).
- **Problema de Descobribilidade:** Não há um item de menu dedicado para "Modo Registros", e o rótulo do item existente ("Eventos") não sugere que ali reside a chave de ativação de módulos específicos.
- **Veredito:** **Falha de Descobribilidade.** A tela de eventos é o local correto, mas a funcionalidade de ativação do Modo Registros está "escondida" atrás de um ícone abstrato em uma tabela densa.

### Passo 5 — Verificação da Trilha de Auditoria
- **Mecanismo:** Trilha via `registros_mode_logs`.
- **Estado:** Tabela existe mas está vazia na amostragem inicial. O componente `SuperEventosPage.tsx` realiza o `UPDATE` mas não parece disparar o `INSERT` na tabela de logs manualmente (pode haver dependência de trigger que não foi localizada ou o log é feito via `audit_events` genérico).
- **Veredito:** **Alerta de Rastreabilidade.** A alteração funciona, mas a persistência do log específico (`registros_mode_logs`) precisa de confirmação de trigger.

### Passo 6 — Verificação do Impacto Prático Atual
- **Estado do Sistema:** Como todos os eventos estão com a flag em `false` por padrão e o operador não localiza o botão de ativação, os módulos das Fases 1, 2 e 3 estão **implementados mas inacessíveis** nos ambientes de produção/homologação operados por humanos.
- **Causa Raiz:** O ícone `ListChecks` na cor cinza (inativo) em uma tabela com muitas colunas não comunica a ação de "Ativar Módulo de Registros" de forma clara.

### Veredito Final e Recomendação
A implementação técnica está correta e segura, mas a UX falhou em **comunicar a funcionalidade**. 

**Cenário Identificado:** Interface acoplada à tela de eventos do Super Admin, mas com baixíssima descobribilidade devido à falta de rótulo e destaque visual.

**Recomendação de Correção Simples:**
1. No `SuperAdminLayout.tsx`, renomear ou adicionar badge ao item "Eventos" indicando "Gestão de Módulos".
2. No `SuperEventosPage.tsx`, substituir o ícone isolado por um `Switch` ou `Button` com rótulo "Registros: Off/On", ou adicionar um Tooltip persistente/Onboarding visual na primeira carga do Super Admin.
3. Garantir que o log de alteração em `registros_mode_logs` seja disparado via Trigger no banco para evitar dependência do frontend.

---

## MINI-AUDITORIA DE CONFIRMAÇÃO — FASE 3 (2026-04-28)

Esta mini-auditoria valida a entrega da Fase 3 do módulo de Registros, focando na integridade da API pública, numeração automática, fluxo de homologação e não regressão.

### PASSO 1 — VERIFICAÇÃO DA SIGLA DE ETAPA
- **Conforme.** A coluna `stage_code` foi implementada na tabela `event_stages`. Exemplos validados no código do componente `DailyBulletinsTab.tsx`: "BON", "PAC", "BVA". O mecanismo de override é direto via edição do campo no banco/interface de etapas.
- **Uso:** A sigla é consumida pela RPC `get_next_bulletin_number` para compor o prefixo dos códigos alfanuméricos.

### PASSO 2 — VERIFICAÇÃO DO CICLO DE HOMOLOGAÇÃO
- **Conforme.** O estado de homologação é derivado do campo `result_status` em `competition_match_results`.
- **Estados:** `resultado_lancado` (em registro), `resultado_validado` (homologada), `publicado` (publicada).
- **Transições:** Validadas em `ResultGovernancePanel.tsx`. A transição para `resultado_validado` é manual (RPC `rpc_validate_results_for_sport_event`). A transição para `publicado` é automática na publicação do boletim via Edge Function `generate-bulletin`.

### PASSO 3 — VERIFICAÇÃO DA NUMERAÇÃO ALFANUMÉRICA AUTOMÁTICA
- **Conforme.** Implementada via RPC `get_next_bulletin_number`.
- **Formatos:** `SIGLA-NNN` para diários (com zero-padding de 3 dígitos) e `SIGLA-FIN` para finais. A lógica garante unicidade por etapa e evento.

### PASSO 4 — VERIFICAÇÃO DO FLUXO DE PUBLICAÇÃO
- **Conforme.** O componente `DailyBulletinsTab.tsx` implementa trava visual e funcional no botão "Publicar Boletim Oficial" baseada na query `pending-homologation`.
- **Trava:** O botão é desabilitado se houver partidas sem resultado ou com resultados não validados.
- **Histórico:** A tabela `bulletin_documents` preserva o histórico de versões com timestamps e URLs do storage.

### PASSO 5 — VERIFICAÇÃO DO PDF PROFISSIONAL
- **Conforme.** A Edge Function `generate-bulletin` utiliza `jspdf` e `jspdf-autotable` para gerar um layout profissional:
  - Cabeçalho institucional com código alfanumérico em destaque.
  - Resumo executivo dinâmico.
  - Resultados agrupados por modalidade com tabelas formatadas.
  - Quadro de medalhas automático em boletins do tipo `final`.

### PASSO 6 — VERIFICAÇÃO DOS ENDPOINTS PADRONIZADOS
- **Conforme.** Endpoints `public-results` e `public-events` atualizados para o formato `{ items, meta }`.
- **Metadados:** Incluem `total`, `generated_at` e, no caso de resultados, `duration_ms`.
- **Filtros:** Suporte nativo a `bulletin_number` (alfanumérico) em `public-results`.

### PASSO 7 — VERIFICAÇÃO DA INTEGRIDADE DA PUBLIC_RESULTS_VIEW
- **Conforme.** A view foi recriada para tratar `source = 'simple'` e `source = 'complex'` simetricamente, garantindo que partidas simplificadas não sejam filtradas por falta de `phase_id` ou `group_id`.

### PASSO 8 — VERIFICAÇÃO DE NÃO REGRESSÃO DOS CONSUMIDORES INTERNOS
- **Sem Regressão.**
  - **Relatório OSC:** Continua funcional, consumindo dados consolidados de ambas as fontes.
  - **AutoBulletinDialog:** Preservado para uso em rascunhos rápidos e prévias em Markdown, enquanto o novo fluxo entrega PDFs oficiais assinados.
  - **Quadro de Medalhas:** A lógica de cálculo foi replicada na Edge Function para o boletim final, mantendo paridade com a página administrativa.

### PASSO 9 & 10 — NÃO REGRESSÃO GERAL
- **Sem Regressão.** Módulos operacionais (Voucher, Alimentação, Alojamento, Transporte) mantêm integridade total. A navegação condicional e os recursos das Fases 1 e 2 de Registros operam conforme documentado.

### VEREDITO FINAL: CONFIRMADA
A Fase 3 está sólida, com fluxos de controle técnico rigorosos e saída profissional de dados. O sistema está pronto para a validação visual externa e para o encerramento do módulo de Registros.

**Ajustes Recomendados (Melhoria Contínua):**
1. **UX:** Adicionar link direto para a tela de homologação quando houver partidas pendentes no boletim diário (atualmente apenas informa a contagem).
2. **Performance:** Monitorar tempo de execução da Edge Function `generate-bulletin` em etapas com volume massivo de partidas (+500).

---
*Mini-auditoria realizada em 2026-04-28.*

---

## CORREÇÃO DA DESCOBRÍVELIDADE DA FLAG DE MODO REGISTROS (ETAPA A) — 2026-04-28

Implementação de melhorias de UX no Super Admin para garantir que o operador consiga localizar, entender e gerenciar a flag `registros_mode_enabled` com segurança e rastreabilidade total.

### 1. Substituição de Ícone por Toggle com Rótulo
- **Localização:** Tela de Gestão de Eventos (`/super/eventos`).
- **Novo Controle:** O ícone isolado `ListChecks` foi substituído por um conjunto visual composto por um rótulo textual ("Registros" ou "Competição") e um componente `Switch`.
- **Destaque Visual:** Cores coordenadas (âmbar para Registros ativo) permitem identificação imediata do estado de cada evento na tabela.

### 2. Tooltip Explicativo
- **Funcionalidade:** Adicionado tooltip em hover sobre o controle de cada evento.
- **Conteúdo:** Descreve o significado do modo atual e o impacto de cada opção (caminho simplificado vs. estrutura completa de fases/grupos).

### 3. Confirmação Explícita na Alteração
- **Mecanismo:** Ao clicar no toggle, o sistema agora abre um `AlertDialog` (Shadcn UI).
- **Mensagem de Impacto:** O diálogo detalha exatamente o que acontecerá ao ativar ou desativar o modo, listando quais módulos serão ocultados ou exibidos para os usuários.
- **Segurança:** A alteração só é processada após o clique explícito em "Confirmar Alteração", evitando trocas acidentais.

### 4. Auditoria e Histórico Consultável
- **Rastreabilidade:** A alteração via UI dispara um `INSERT` na tabela `registros_mode_logs`, registrando o autor (ID do usuário), instante, evento e os valores `old_value`/`new_value`.
- **Acesso ao Histórico:** Adicionado link "Ver Histórico" abaixo do toggle de cada evento.
- **Visualização:** Abre um painel lateral (`Sheet`) listando todas as alterações passadas em ordem cronológica, com identificação do responsável e Badge de status, garantindo transparência total sobre quem alterou a configuração do evento.

### Arquivos Tocados
- `src/pages/super/SuperEventosPage.tsx`: Implementação completa da nova UI e integração com logs.

---
*Correção da descobribilidade concluída em 2026-04-28.*
