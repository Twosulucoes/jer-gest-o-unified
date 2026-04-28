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
