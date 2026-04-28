# Auditoria do Módulo de Alojamento - JER Gestão
**Data:** 28 de Abril de 2026
**Status Global:** 🟢 Fase 3 Concluída (2026-04-28)

## 1. Introdução e Objetivo
Esta auditoria analisa o estado do módulo de Alojamento, focando na integração entre a gestão administrativa (alocação) e a operação de campo (PWA). O diagnóstico identifica uma divergência estrutural grave entre os esquemas de dados que compromete a utilidade do módulo em operação real.

---

## 2. Análise do Estado Atual (Pós-Unificação)

### 2.1 Estrutura de Dados Unificada
O sistema foi unificado no esquema `public`:
- **Tabelas Operacionais:** `lodging_locations`, `lodging_units` e `lodging_occupancies`.
- **Registro de Execução:** O PWA agora utiliza as RPCs `pwa_lodging_checkin` e `pwa_lodging_checkout` que gravam diretamente em `public.lodging_occupancies`.
- **Auditoria:** Nova tabela `public.lodging_audit_logs` registra cada tentativa de check-in/out para rastreabilidade total.

### 2.2 Interfaces Administrativas (Web Admin)
- **`AlojamentoHubPage`**: Dashboard unificado que mostra ocupação real vinda do campo.
- **`AlocacaoLotePage`**: Wizard funcional que agora reflete o status de check-in real dos participantes.
- **`AlojamentoOcupacaoPage`**: Visão detalhada que exibe notas de divergência.
- **`AlojamentoPresencaPage`**: NOVO - Painel de reconciliação de presença noturna.
- **`AlojamentoDivergenciasPage`**: NOVO - Relatório de conflitos planejado vs real.

---

## 3. Relatório de Evolução (Fase 3)

| Frente | Status | Evidência Objetiva |
|:---|:---:|:---|
| **Inteligência de Presença** | ✅ Pleno | RPC valida check-in ativo e unidade correta. |
| **Painel de Reconciliação** | ✅ Pleno | Visão por unidade de Presentes, Ausentes e Sem Check-in. |
| **Relatório de Divergências** | ✅ Pleno | Consolidação de conflitos e pendências exportável. |
| **Visibilidade PWA** | ✅ Pleno | Operador vê faltosos diretamente na tela da unidade. |

---

## 4. Definições de Negócio Aplicadas

- **Noite Operacional:** Ciclo das 18:00 às 06:00 do dia seguinte.
- **Faltoso:** Pessoa alocada (`allocated`) mas sem check-in realizado.

---

## Histórico de Auditorias
- **2024-04-28 (Noite II):** Fase 3 Concluída. Inteligência, Relatórios e Reconciliação.
- **2026-04-28 (Noite):** Fase 2 Concluída. Granularidade, Gênero e Presença implementados.
- **2026-04-28 (Tarde):** Unificação confirmada (Fase 1).
- **2026-04-28 (Manhã):** Auditoria inicial completa.
