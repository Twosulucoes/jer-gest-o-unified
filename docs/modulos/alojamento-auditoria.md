# Auditoria do Módulo de Alojamento - JER Gestão
**Data:** 28 de Abril de 2026
**Status Global:** 🟢 Unificado (Fase 1 Concluída - 2026-04-28)

## 1. Introdução e Objetivo
Esta auditoria analisa o estado do módulo de Alojamento, focando na integração entre a gestão administrativa (alocação) e a operação de campo (PWA). O diagnóstico identifica uma divergência estrutural grave entre os esquemas de dados que compromete a utilidade do módulo em operação real.

---

## 2. Análise do Estado Atual

### 2.1 Estrutura de Dados e Conflitos de Esquema
O sistema possui hoje dois conjuntos de tabelas concorrentes e desconectados:
- **Esquema `public` (Admin):** Utiliza `lodging_locations`, `lodging_units` e `lodging_occupancies`. É aqui que a Secretaria faz a alocação em lote (`AlocacaoLotePage.tsx`).
- **Esquema `alojamento` (PWA/Operacional):** Utiliza `facilities`, `rooms`, `beds` e `stays`. É aqui que as RPCs operacionais (`pwa_checkin`, `pwa_checkout`) registram a atividade.
- **Inconsistência:** Não existe sincronização entre a alocação planejada no `public` e a execução registrada no `alojamento`.

### 2.2 Interfaces Administrativas (Web Admin)
- **`AlojamentoHubPage`**: Dashboard básico de capacidade.
- **`AlojamentoLocaisPage` / `AlojamentoUnidadesPage`**: Gestão de hotéis e quartos (esquema `public`).
- **`AlocacaoLotePage`**: Wizard funcional que distribui delegações em quartos respeitando gênero e capacidade (esquema `public`).
- **`AlojamentoOcupacaoPage`**: Visão de check-in manual e lista de ocupantes (esquema `public`).

### 2.3 Interface Operacional (PWA)
- **`AlojamentoScanPage`**: Executa Check-in e Check-out via QR Code.
- **Validações:** Realiza check de idade (+12 anos) e se o participante possui credencial ativa na etapa.
- **Offline:** Fila de sincronização funcional via `useAlojamentoOffline`.
- **Vouchers:** Integração com resgate de vouchers de alojamento presente.

---

## 3. Relatório de Auditoria por Frente

| Frente | Status | Evidência Objetiva |
|:---|:---:|:---|
| **Cadastro de Unidades** | ✅ Pleno | Tabelas e telas de gestão de locais e quartos funcionais. |
| **Alocação de Pessoas** | 🟡 Parcial | Funciona no Admin (Wizard), mas o dado não é lido pelo PWA. |
| **Check-in por QR** | 🟡 Parcial | Funciona no PWA, mas não valida se a pessoa foi alocada naquela unidade/local. |
| **Identificação da Unidade** | ❌ Ausente | O PWA opera por "Facility" (Local), perdendo a granularidade de "Quarto" alocada no Admin. |
| **Controle de Presença** | ❌ Ausente | Não há registro de retorno (presença noturna), apenas o Check-in inicial e Check-out final. |
| **Check-out por QR** | ✅ Pleno | Fluxo de saída implementado e funcional no PWA. |
| **Proteção contra Duplicidade** | ✅ Pleno | RPC `pwa_checkin` impede check-in duplo se já estiver `hospedado`. |
| **Comportamento Offline** | ✅ Pleno | Sistema de fila e sync persistente no `localStorage`. |
| **Vínculo com Voucher** | ✅ Pleno | Resgate de voucher integrado ao scanner operacional. |
| **Visão Real-time (Admin)** | 🟡 Parcial | Mostra ocupação baseada no `public`, ignorando os dados do `alojamento` vindos do PWA. |
| **Perfil/Permissões** | ✅ Pleno | Role `alojamento` configurada e protegida. |
| **Trilha de Auditoria** | ✅ Pleno | Tabela `alojamento.scan_events` registra cada tentativa com sucesso/erro. |

---

## 4. Diagnóstico e Lacunas (Inconsistências)

### 4.1 Prioridade Crítica (Bloqueante de Produto)
- **Desconexão entre Alocação e Check-in**: Atualmente, um coordenador aloca um atleta no "Quarto 10" do "Hotel X". No entanto, o PWA registra apenas que o atleta entrou no "Hotel X". O dado de "Quarto 10" nunca é atualizado ou validado no momento do check-in.
- **Divergência de Tabelas**: O uso de dois esquemas (`public` vs `alojamento`) para a mesma finalidade gerou um "módulo esquizofrênico" onde a mão administrativa não vê o que a mão operacional faz.

### 4.2 Prioridade Alta (Impacto Operacional)
- **Falta de Controle de Presença**: No alojamento, o check-in é feito uma vez (chegada). A operação precisa de um controle de "Presença Diária" para saber quem realmente dormiu na unidade em cada noite da etapa.
- **Validação de Gênero no Check-in**: Embora o Admin valide gênero na alocação, o PWA não impede que um atleta masculino faça check-in em uma unidade feminina se o operador errar a seleção.

### 4.3 Prioridade Média (UX/Processo)
- **Visibilidade de Ocupação no PWA**: O operador de campo não consegue ver facilmente a lista de quem *deveria* estar no alojamento e ainda não chegou (faltosos).

---

## 5. Recomendações de Próximos Passos

1. **Unificação do Esquema de Dados**: Migrar toda a lógica operacional do PWA para as tabelas do `public` (ou vice-versa), garantindo que `lodging_occupancies` seja a fonte única de verdade tanto para Alocação (Admin) quanto para Check-in (PWA).
2. **Vínculo Granular no Check-in**: Alterar o PWA para que o operador selecione a **Unidade (Quarto)** e não apenas o Local (Facility), permitindo a atualização real da ocupação planejada.
3. **Módulo de Presença Noturna**: Criar um modo "Presença" no scanner PWA que registre apenas o retorno da pessoa à unidade, sem alterar o status de `checked_in`.
4. **Relatório de Divergência de Alocação**: Criar painel administrativo que aponte pessoas que fizeram check-in em locais diferentes do alocado pela coordenação.

---
## Histórico de Auditorias
- **2026-04-28:** Auditoria inicial completa. Identificada desconexão crítica entre os esquemas de dados Admin e PWA. Módulo requer refatoração de schema para operação real.