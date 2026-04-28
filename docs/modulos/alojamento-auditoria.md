# Auditoria do Módulo de Alojamento - JER Gestão
**Data:** 28 de Abril de 2026
**Status Global:** 🟢 Unificado (Fase 1 Concluída - 2026-04-28)

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
- **`AlojamentoScanPage`**: Executa Check-in e Check-out via QR Code gravando no esquema unificado.
- **Divergência:** Sistema permite check-in não planejado ou em local divergente, registrando a ocorrência para auditoria posterior.

---

## 3. Relatório de Evolução (Fase 1)

| Frente | Status | Evidência Objetiva |
|:---|:---:|:---|
| **Cadastro de Unidades** | ✅ Pleno | Tabelas unificadas no `public`. |
| **Alocação de Pessoas** | ✅ Pleno | Agora o dado planejado (`public`) é lido e validado pelo PWA. |
| **Check-in por QR** | ✅ Pleno | Implementado no `public` com registro de divergência. |
| **Identificação da Unidade** | ✅ Pleno | PWA agora permite seleção de Unidade (Quarto) com persistência local. |
| **Controle de Presença** | ✅ Pleno | Modo "Presença Noturna" implementado no scanner PWA. |
| **Check-out por QR** | ✅ Pleno | Fluxo unificado e auditável no `public`. |
| **Proteção contra Duplicidade** | ✅ Pleno | RPC `pwa_lodging_checkin` impede check-in duplo no esquema unificado. |
| **Comportamento Offline** | ✅ Pleno | Sync atualizado para as novas RPCs unificadas. |
| **Visão Real-time (Admin)** | ✅ Pleno | Dashboard agora reflete a operação real via `public.lodging_occupancies`. |
| **Trilha de Auditoria** | ✅ Pleno | Nova tabela `public.lodging_audit_logs` registra eventos operacionais. |

---

## 4. Diagnóstico Pós-Fase 2 (Granularidade e Regras)
54: 
55: ### 4.1 Conquistas da Fase 2
56: - **Granularidade de Unidade (Quarto)**: O PWA agora permite que o operador selecione a unidade específica no momento do check-in, amarrando a operação real ao planejamento.
57: - **Validação de Gênero**: Bloqueio automático no check-in caso o gênero da pessoa (vinda de `people.gender`) divirja da restrição da unidade.
58: - **Controle de Capacidade**: Bloqueio de check-in em unidades lotadas ou sem capacidade definida (zero/nula), forçando a qualidade do cadastro.
59: - **Presença Noturna**: Implementado fluxo dedicado para registro de retorno diário dos participantes sem afetar o status de check-in.
60: - **Alerta de Divergência Proeminente**: Operadores recebem aviso visual imediato quando um participante entra em unidade diferente da planejada.
61: 
62: ### 4.2 Lacunas Remanescentes (Fase 3)
63: - **Relatórios de Ocupação Histórica**: Análise de ocupação média e picos por unidade ao longo do evento.
64: - **Integração com Alimentação**: Bloqueio de refeições caso o check-in no alojamento não tenha sido realizado (opcional).
65: 
66: ---
67: 
68: ## 5. Recomendações de Próximos Passos (Fase 3)
69: 
70: 1. **Dashboard de Gestão de Conflitos**: Tela centralizada para coordenação resolver divergências registradas em campo.
71: 2. **Otimização de Alocação Inteligente**: Sugestão de unidades com base em gênero, delegação e proximidade.
72: 
73: ---
74: ## Histórico de Auditorias
75: - **2026-04-28 (Noite):** Fase 2 Concluída. Granularidade, Gênero e Presença implementados.
76: - **2026-04-28 (Tarde):** Unificação confirmada (Fase 1).
77: - **2026-04-28 (Manhã):** Auditoria inicial completa.