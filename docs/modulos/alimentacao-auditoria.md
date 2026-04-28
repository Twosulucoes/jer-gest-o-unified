# Auditoria do Módulo de Alimentação - JER Gestão
**Data:** 28 de Abril de 2026
**Status Global:** 🟡 Parcialmente Implementado / Em Operação

## 1. Introdução e Objetivo
Esta auditoria consolidada visa diagnosticar o estado real do módulo de Alimentação, identificando o que já está funcional e as lacunas que impedem a operação plena e segura em campo. O foco é a integridade do ciclo: Planejamento (Janelas) -> Elegibilidade -> Execução (PWA) -> Auditoria.

---

## 2. Análise do Estado Atual

### 2.1 Estrutura de Dados (Database)
- **`meal_types`**: Cadastro de tipos (Café, Almoço, Jantar).
- **`meal_windows`**: Janelas temporais vinculadas a eventos e etapas. Possuem campos de horário, data e local (`meal_window_location_id`).
- **`meal_locations`**: Cadastro formal de refeitórios/locais de consumo.
- **`meal_window_eligibility`**: Tabela de regras de restrição (por perfil, delegação ou instituição).
- **`meal_consumptions`**: Registro atômico de cada refeição (participante, janela, método, operador, instante).

### 2.2 Interfaces Administrativas (Web Admin)
- **`AlimentacaoHubPage`**: Dashboard e acesso aos submódulos.
- **`AlimentacaoJanelasPage`**: Gestão de janelas com suporte a **regras de elegibilidade** (visto em `MealWindowFormDialog.tsx`).
- **`AlimentacaoConsumoPage`**: Visão de controle em tempo real, permitindo filtrar por janela e ver o histórico de consumos.
- **`AlimentacaoLocaisPage`**: Cadastro de locais/refeitórios.

### 2.3 Interface Operacional (PWA)
- **`AlimentacaoHomePage`**: Dashboard do operador com KPI de janelas ativas.
- **`AlimentacaoScanPage`**: O "coração" da operação. Suporta Scan QR, Busca Manual e **Vouchers**.
- **Offline**: Implementado via `offlineQueue.ts` e `voucherOffline.ts`, com sincronização posterior.

---

## 3. Relatório de Auditoria por Frente

| Frente | Status | Evidência Objetiva |
|:---|:---:|:---|
| **Cadastro de Janelas** | ✅ Pleno | `meal_windows` estruturada com data, hora, tipo e local. |
| **Cadastro de Locais** | ✅ Pleno | Tabela `meal_locations` e página de gestão presente. |
| **Elegibilidade** | ✅ Pleno | Implementado via `meal_window_eligibility` com filtros por perfil, delegação e instituição. |
| **Fluxo de Consumo PWA** | ✅ Pleno | `AlimentacaoScanPage.tsx` executa leitura única e atômica. |
| **Identificação da Janela** | ✅ Pleno | PWA sugere janela automática por horário; operador confirma no seletor. |
| **Proteção Contra Duplo Consumo** | ✅ Pleno | Validação `isOnline()` verifica duplicidade antes de inserir; `unique` constraint no DB garante integridade. |
| **Comportamento Offline** | ✅ Pleno | `addToOfflineQueue` salva localmente; sync trata duplicidades (erro 23505). |
| **Vínculo com Voucher** | ✅ Pleno | Integrado em `AlimentacaoScanPage` via `tryRedeemVoucher`. |
| **Visão Real-time (Admin)** | ✅ Pleno | `AlimentacaoConsumoPage` mostra lista de consumos em tempo real. |
| **Previsão de Demandas** | ❌ Ausente | Não foi encontrada lógica de cálculo de ocupação vs previsão (capacidade) baseada na elegibilidade. |
| **Permissões por Perfil** | ✅ Pleno | Proteção de rotas em `App.tsx` e `accessControl.ts` (role `alimentacao`). |
| **Trilha de Auditoria** | 🟡 Parcial | Consumos registrados com `registered_by`; falta log detalhado de tentativas negadas em tabela de auditoria dedicada. |
| **Estados de Interface** | ✅ Pleno | Loader de busca, feedback de sucesso/erro e alerta de restrição nutricional visíveis. |

---

## 4. Diagnóstico e Lacunas (Inconsistências)

### 4.1 Prioridade Alta (Bloqueantes Operacionais)
- **Cálculo de Previsão**: O sistema permite criar janelas, mas não informa à cozinha quantos participantes são esperados (soma de elegíveis por delegação/perfil). Sem isso, o planejamento de compras/preparo é manual e propenso a erros.
- **Sincronização de Janelas Offline**: O PWA carrega janelas online. Se o operador abrir o app totalmente offline, ele pode não ver a janela correta se ela não foi cacheada previamente.

### 4.2 Prioridade Média (Evolução de Fluxo)
- **Capacidade da Janela**: Existe o campo de elegibilidade, mas falta o campo `capacity` (capacidade física do local) para travar consumos se houver lotação (raro em JER, mas importante para segurança).
- **Relatório de Divergências**: Falta um relatório que cruze: "Quem deveria comer e não comeu" vs "Quem não deveria e tentou comer".

### 4.3 Prioridade Baixa (Melhoria de UX)
- **Som sonoro de confirmação**: O PWA vibra, mas em ambientes ruidosos (refeitórios), um som de "beep" de sucesso/erro ajudaria o fluxo rápido.
- **Dashboard de Ocupação**: O dashboard atual é tabular; uma visão gráfica de "barra de progresso" de consumos esperados ajudaria a coordenação.

---

## 5. Recomendações de Próximos Passos

1. **Construção do Motor de Previsão**: Criar função no banco (ou service no admin) que calcule o total de elegíveis por janela para gerar o relatório de "Previsão de Cozinha".
2. **Refinamento do Sync Offline**: Garantir que as `meal_windows` da etapa sejam baixadas para uso 100% offline.
3. **Implementação de Auditoria de Tentativas**: Registrar em tabela separada (ex: `meal_incidents`) toda vez que um QR é recusado por "Janela Errada" ou "Já Consumido".
4. **Relatório de Exportação**: Criar exportação em Excel formatada para a empresa de buffet/alimentação com os totais por tipo de refeição/dia.

---
## Histórico de Auditorias
- **2026-04-28:** Auditoria inicial completa. Módulo considerado funcional para operação básica, com lacunas em inteligência de dados (previsão).