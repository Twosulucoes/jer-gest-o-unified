# Auditoria do Módulo de Transporte - JER Gestão
**Data:** 28 de Abril de 2026
**Status Global:** 🟡 Parcialmente Implementado / Requer Refinamento Operacional

## 1. Introdução e Objetivo
Esta auditoria analisa a aderência do módulo de Transporte aos requisitos operacionais dos Jogos Escolares de Roraima. O foco é garantir que o fluxo de embarque/desembarque seja seguro, auditável e resiliente a falhas de conectividade, mantendo a consistência com os demais módulos logísticos.

---

## 2. Análise do Estado Atual

### 2.1 Estrutura de Dados (Database)
- **`transport_vehicles`**: Cadastro de veículos com placa, capacidade e tipo.
- **`transport_routes`**: Definição de linhas com origem, destino e vínculo com etapa.
- **`transport_trips`**: Instâncias de viagens com horários, motoristas e status.
- **`transport_passengers`**: Manifesto de embarque. Suporta registros nominais (vínculo com `participants`) e manuais (`manual_name`, `manual_cpf`).

### 2.2 Interfaces Administrativas (Web Admin)
- **`TransporteHubPage`**: Central de gestão organizada por abas (Saídas, Veículos, Linhas). Suporta escopo por etapa.
- **`TransporteEmbarquePage (Admin)`**: Visão administrativa do manifesto em tempo real. Permite registrar desembarque manual.
- **`TransporteRelatoriosPage`**: Exportação consolidada de viagens e passageiros em CSV.

### 2.3 Interface Operacional (PWA)
- **`TransporteHomePage`**: Dashboard do motorista. Permite assumir viagens disponíveis ("Check-in do Motorista") e visualizar viagens em andamento.
- **`TransporteEmbarquePage (PWA)`**: Tela de operação de embarque. Exibe lista de passageiros previstos, permite scan QR e embarque manual.
- **`TransportePassageirosPage (PWA)`**: Lista detalhada com busca, filtros por delegação e acesso a contatos de emergência (responsáveis/professores).
- **`TransporteScanPage`**: Scanner dedicado com suporte a preferências de leitura contínua.

---

## 3. Relatório de Auditoria por Frente

| Frente | Status | Evidência Objetiva |
|:---|:---:|:---|
| **Cadastro de Veículos** | ✅ Pleno | Tabela `transport_vehicles` com placa, capacidade e status. |
| **Cadastro de Motoristas** | 🟡 Parcial | Usa `driver_name` (texto) em viagens, mas integra com `profiles` via `assigned_driver_id` no PWA. |
| **Rotas (Linhas)** | ✅ Pleno | Modelagem de origem/destino presente em `transport_routes`. |
| **Viagens** | ✅ Pleno | Entidade `transport_trips` gerencia ciclo de vida (scheduled -> in_progress -> completed). |
| **Designação de Pessoas** | 🟡 Parcial | Passageiros são associados a viagens via `transport_passengers`, mas falta interface administrativa de "Alocação em Lote" (similar ao Alojamento). |
| **Embarque por QR** | ✅ Pleno | Implementado no PWA com leitura de crachá e registro atômico. |
| **Desembarque por QR** | ❌ Ausente | PWA foca apenas no Embarque. Desembarque é tratado apenas como ação manual no Admin ou finalização de viagem. |
| **Proteção contra Duplicidade** | ✅ Pleno | `applyBoarding` no PWA verifica se o passageiro já está com status `boarded`. |
| **Identificação da Viagem** | ✅ Pleno | Motorista assume viagem no `TransporteHomePage` e o `tripId` é persistido na rota. |
| **Comportamento Offline** | ✅ Pleno | Integrado ao `offlineQueue.ts` com sincronização automática. |
| **Vínculo com Voucher** | ✅ Pleno | Resgate de voucher de transporte integrado ao scanner (`tryRedeemVoucher`). |
| **Visão Real-time (Admin)** | ✅ Pleno | `TransporteRelatoriosPage` e `TransporteEmbarquePage` refletem a operação de campo. |
| **Perfil/Permissões** | ✅ Pleno | Role `transporte` protegida no `App.tsx` e `accessControl.ts`. |
| **Trilha de Auditoria** | ✅ Pleno | Registros em `transport_passengers` possuem `boarded_by` e `boarded_at`. |

---

## 4. Diagnóstico e Lacunas (Inconsistências)

### 4.1 Prioridade Alta (Impacto Operacional)
- **Ausência de Desembarque no PWA**: O contexto de negócio exige registro de desembarque no destino. Atualmente, o PWA permite apenas registrar quem entrou no veículo. Sem o desembarque, não é possível garantir que todos os passageiros chegaram ao destino (ex: atletas deixados em local errado).
- **Alocação Manual de Passageiros (Admin)**: Não há uma tela eficiente para alocar 40 atletas em uma viagem. É necessário uma interface de "Alocação por Delegação" ou "Alocação por Modalidade" no Admin.

### 4.2 Prioridade Médio (Segurança/UX)
- **Vínculo Motorista-Pessoa**: O campo `driver_name` em viagens é texto livre, enquanto o PWA usa o ID do usuário logado. Recomenda-se unificar para usar sempre o vínculo com a tabela `people/profiles` para evitar nomes grafados errados.
- **Feedback de Desembarque Pendente**: A interface de finalização de viagem não alerta se há passageiros que embarcaram mas ainda não desembarcaram.

---

## 5. Recomendações de Próximos Passos

1. **Implementação de Fluxo de Desembarque no PWA**: Adicionar aba "Desembarque" na `TransporteEmbarquePage.tsx` ou permitir que o scanner registre o gesto de saída, alterando status para `alighted`.
2. **Criação de Alocador em Lote (Admin)**: Desenvolver interface para selecionar delegações inteiras e associá-las a uma viagem, respeitando a capacidade do veículo.
3. **Mecanismo de "No-Show" no PWA**: Já existe no banco, mas falta facilitar o acesso ao motorista para marcar quem não compareceu sem precisar entrar na lista detalhada.
4. **Resumo de Divergência na Finalização**: No diálogo de finalizar viagem, exibir contagem de passageiros "Em trânsito" (embarcados sem desembarque).

---
## Histórico de Auditorias
- **2026-04-28:** Auditoria inicial completa. Módulo considerado robusto para embarque, mas incompleto no ciclo total (falta desembarque operacional e alocação administrativa em massa).