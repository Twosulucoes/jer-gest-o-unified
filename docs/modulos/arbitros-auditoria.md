# Auditoria do Módulo de Árbitros — JER Gestão

> **Data da Auditoria:** 2026-04-28
> **Estado:** 🟡 PARCIALMENTE IMPLEMENTADO

Este relatório apresenta o diagnóstico detalhado do módulo de Árbitros do sistema JER Gestão, avaliando a aderência das funcionalidades atuais aos requisitos de cadastro, escala e designação técnica.

---

## 1. Plano de Auditoria

A auditoria seguiu os seguintes passos:
1.  **Inspeção de Schema**: Verificação das tabelas `match_user_assignments`, `match_officials` e `profiles`.
2.  **Mapeamento de Rotas**: Análise das rotas administrativas (`/admin/competicao/arbitragem`) e operacionais (`/aovivo`).
3.  **Análise de Código**: Inspecionamos componentes de designação individual, escala em lote e súmula digital.
4.  **Verificação de Integração**: Avaliamos o vínculo entre árbitros e os módulos de competição e logística.

---

## 2. Levantamento do Estado Atual

### 2.1 Componentes e Telas
-   **`/admin/competicao/arbitragem`**: Central administrativa para visualização de escalas, filtros por modalidade e exportação.
-   **`EscalaLoteDialog.tsx`**: Componente avançado para designação massiva de oficiais em múltiplas partidas, com detecção automática de conflitos de agenda.
-   **`MatchUserAssignmentsCard.tsx`**: Interface de designação nominal na ficha da partida vinculada a perfis do sistema.
-   **`MatchOfficialsCard.tsx`**: Interface para registro de oficiais "ad-hoc" (apenas nome textual), sem vínculo com usuários.
-   **`/aovivo/partida/:matchId`**: PWA operacional para registro de eventos e resultados, com controle de acesso baseado na designação.

### 2.2 Estrutura de Dados
-   **`match_user_assignments`**: Tabela que vincula um `user_id` (perfil) a uma partida com uma função (`role`). Suporta detecção de sobreposição de horários.
-   **`match_officials`**: Tabela legado ou auxiliar que armazena apenas o nome (texto) e função dos oficiais, sem integração com a base de pessoas.
-   **`profiles`**: Cadastro unificado de pessoas, onde árbitros são identificados pelo perfil (`role`) na tabela `user_roles`.

---

## 3. Relatório de Aderência por Frente

| Frente | Classificação | Evidência Objetiva |
| :--- | :--- | :--- |
| **Cadastro de Árbitros** | 🟡 Parcial | Árbitros existem como "Perfis" (`user_roles`), mas não há uma entidade dedicada para registrar restrições de interesse, nível/categoria ou documentos técnicos. |
| **Escala (Disponibilidade)** | ⚪ Ausente | Não existe mecanismo para registrar janelas de trabalho ou disponibilidade preventiva. A escala é feita diretamente como designação em partidas. |
| **Designação** | ✅ Pleno | Implementada designação nominal e em lote, com validação de status de partida e detecção de conflitos de horário (sobreposição). |
| **Súmula Digital** | 🟡 Parcial | O PWA "Ao Vivo" captura eventos e resultados em tempo real, mas não gera um documento de súmula formal com assinaturas digitais ou ocorrências disciplinares estruturadas. |
| **Conexão com Competição** | ✅ Pleno | Integrado nativamente às partidas, agenda e resultados. |
| **Logística do Árbitro** | ⚪ Ausente | Árbitros não estão integrados aos fluxos de consumo QR (Alimentação/Alojamento) como portadores operacionais de forma automática. |
| **Permissões** | ✅ Pleno | RLS aplicado: designação restrita a `admin`, `coordenacao_tecnica` e `coordenador_modalidade`. |
| **Auditoria** | 🟡 Parcial | `match_user_assignments` registra `created_by`, mas não há histórico completo de alterações (logs de deleção ou troca). |

---

## 4. Diagnóstico sobre Acesso Operacional (PWA)

Atualmente, o sistema possui o PWA **Ao Vivo**, que já é utilizado por árbitros/mesários para registrar o placar.
-   **Cenário Atual**: O árbitro usa o Ao Vivo para operar a partida.
-   **Lacuna**: O árbitro não tem uma visão de "Minha Agenda" ou local para confirmar presença ou reportar indisponibilidade.
-   **Recomendação**: Evoluir o PWA Ao Vivo para incluir um módulo de "Minha Escala", permitindo que o oficial veja suas partidas do dia e local de atuação, aproveitando que a designação nominal já existe no banco de dados.

---

## 5. Lacunas e Inconsistências (Priorizadas)

1.  **[ALTA] Cadastro Técnico de Árbitros**: Ausência de campos para "Modalidades Habilitadas" e "Conflitos de Interesse" (ex: escola onde trabalha). *Impacto: Risco de designação indevida por erro humano.*
2.  **[ALTA] Integração Logística**: Árbitros não aparecem nos PWAs de Alimentação/Transporte como "Equipe Operacional". *Impacto: Dificuldade de controle de custos e acesso em campo.*
3.  **[MÉDIA] Súmula Formal**: O sistema tem os dados, mas não gera o "espelho da súmula" para conferência final e fechamento oficial. *Impacto: Dependência de papel para assinatura física.*
4.  **[BAIXA] Escala Preventiva**: Não há como saber quem estará disponível amanhã antes de começar a designar. *Impacto: Lentidão no planejamento da coordenação técnica.*

---

## 6. Recomendações de Próximos Passos

1.  **Saneamento de Dados**: Migrar o uso de `match_officials` (textual) exclusivamente para `match_user_assignments` (nominal/perfis), garantindo rastreabilidade total.
2.  **Expansão de Perfil**: Adicionar colunas ou tabela vinculada a `profiles` para metadados técnicos da arbitragem (nível, modalidades, restrições).
3.  **Módulo Logístico**: Incluir perfis de arbitragem nas regras de elegibilidade de alimentação e alojamento.
4.  **UX do Árbitro**: Criar a tela "Minha Agenda" no PWA Ao Vivo/Operacional.
