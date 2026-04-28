# Auditoria do Módulo de Alojamento - JER Gestão
**Data:** 28 de Abril de 2026
**Status Global:** 🟢 Fase 2 Concluída (2026-04-28)

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
- **`AlojamentoOcupacaoPage`**: Visão detalhada que exibe notas de divergência (quando o check-in ocorre em local diferente do planejado).

### 2.3 Interface Operacional (PWA)
- **`AlojamentoScanPage`**: Executa Check-in, Check-out e Presença Noturna via QR Code gravando no esquema unificado.
- **Divergência:** Sistema permite check-in não planejado ou em local divergente, registrando a ocorrência com alerta visual proeminente.

---

## 3. Relatório de Evolução (Fase 2)

| Frente | Status | Evidência Objetiva |
|:---|:---:|:---|
| **Cadastro de Unidades** | ✅ Pleno | Tabelas unificadas no `public`. |
| **Alocação de Pessoas** | ✅ Pleno | Agora o dado planejado (`public`) é lido e validado pelo PWA. |
| **Check-in por QR** | ✅ Pleno | Implementado no `public` com registro de divergência e validação de gênero. |
| **Identificação da Unidade** | ✅ Pleno | PWA agora permite seleção de Unidade (Quarto) com persistência local. |
| **Controle de Presença** | ✅ Pleno | Modo "Presença Noturna" implementado no scanner PWA. |
| **Check-out por QR** | ✅ Pleno | Fluxo unificado e auditável no `public`. |
| **Proteção contra Duplicidade** | ✅ Pleno | RPC `pwa_lodging_checkin` impede check-in duplo no esquema unificado. |
| **Comportamento Offline** | ✅ Pleno | Sync atualizado para as novas RPCs unificadas (Check-in, Check-out, Presença). |
| **Visão Real-time (Admin)** | ✅ Pleno | Dashboard agora reflete a operação real via `public.lodging_occupancies`. |
| **Trilha de Auditoria** | ✅ Pleno | Nova tabela `public.lodging_audit_logs` registra eventos operacionais. |

---

## 4. Diagnóstico Pós-Fase 2 (Granularidade e Regras)

### 4.1 Conquistas da Fase 2
- **Granularidade de Unidade (Quarto)**: O PWA agora permite que o operador selecione a unidade específica no momento do check-in, amarrando a operação real ao planejamento.
- **Validação de Gênero**: Bloqueio automático no check-in caso o gênero da pessoa (vinda de `public.people.gender`) divirja da restrição da unidade. O campo `participants.biological_sex` é considerado legado.
- **Controle de Capacidade**: Bloqueio de check-in em unidades lotadas ou sem capacidade definida (zero/nula), forçando a qualidade do cadastro.
- **Presença Noturna**: Implementado fluxo dedicado para registro de retorno diário dos participantes (`lodging_presence_logs`) sem afetar o status de check-in global.
- **Alerta de Divergência Proeminente**: Operadores recebem aviso visual imediato (Card Amarelo) acima da confirmação de sucesso quando um participante entra em unidade diferente da planejada.

### 4.2 Lacunas Remanescentes (Fase 3)
- **Relatórios de Ocupação Histórica**: Análise de ocupação média e picos por unidade ao longo do evento.
- **Painel de Gestão de Divergência**: Relatório administrativo para resolução de conflitos entre planejado e executado.

---

## 5. Recomendações de Próximos Passos (Fase 3)

1. **Dashboard de Gestão de Conflitos**: Tela centralizada para coordenação resolver divergências registradas em campo.
2. **Integração com Alimentação**: Bloqueio opcional de refeições baseado no status de alojamento.

---
## 6. Relatório de Entrega (Fase 3)

| Frente | Status | Detalhe |
|:---|:---:|:---|
| **Inteligência de Presença** | ✅ Pleno | RPC valida check-in ativo e unidade correta com bloqueios. |
| **Definição de Noite** | ✅ Pleno | Ciclo operacional 18h-06h consolidado na lógica de duplicidade. |
| **Painel de Reconciliação** | ✅ Pleno | Tela admin exibe Presentes, Ausentes e Sem Check-in por unidade. |
| **Relatório de Divergências** | ✅ Pleno | Consolidação de unidade divergente e pendências de check-in. |
| **Visibilidade de Faltosos (PWA)** | ✅ Pleno | Operador vê lista de quem "deveria estar mas não chegou" na unidade. |

### 6.1 Critérios Aplicados
- **Noite Operacional:** Das 18:00 às 06:00 do dia seguinte. Registros nesta janela são considerados da mesma "noite".
- **Faltoso da Unidade:** Pessoa com status `allocated` (alocação planejada) mas sem `checked_in`.

---
## Histórico de Auditorias
- **2024-04-28 (Noite II):** Fase 3 Concluída. Inteligência, Relatórios e Reconciliação.
- **2026-04-28 (Noite):** Fase 2 Concluída. Granularidade, Gênero e Presença implementados.
- **2026-04-28 (Tarde):** Unificação confirmada (Fase 1).
- **2026-04-28 (Manhã):** Auditoria inicial completa.
