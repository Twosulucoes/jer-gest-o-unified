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
| **Identificação da Unidade** | 🟡 Parcial | RPC suporta unidade, PWA utiliza localização (Facility) como base. |
| **Controle de Presença** | ❌ Ausente | Planejado para Fase 2. |
| **Check-out por QR** | ✅ Pleno | Fluxo unificado e auditável no `public`. |
| **Proteção contra Duplicidade** | ✅ Pleno | RPC `pwa_lodging_checkin` impede check-in duplo no esquema unificado. |
| **Comportamento Offline** | ✅ Pleno | Sync atualizado para as novas RPCs unificadas. |
| **Visão Real-time (Admin)** | ✅ Pleno | Dashboard agora reflete a operação real via `public.lodging_occupancies`. |
| **Trilha de Auditoria** | ✅ Pleno | Nova tabela `public.lodging_audit_logs` registra eventos operacionais. |

---

## 4. Diagnóstico Pós-Unificação

### 4.1 Conquistas da Fase 1
- **Fim da Dualidade de Esquemas**: O esquema `alojamento` foi aposentado para novas gravações operacionais. Tudo converge para `public.lodging_occupancies`.
- **Registro de Divergência**: Se um participante faz check-in em local diferente do planejado, o sistema registra a divergência mas não bloqueia a operação, permitindo flexibilidade em campo.
- **Rastreabilidade**: Todas as tentativas de check-in/out (sucesso ou erro) são gravadas em `lodging_audit_logs`.

### 4.2 Lacunas Remanescentes (Fase 2)
- **Controle de Presença Diária**: Necessidade de validar se o hóspede retornou ao alojamento todas as noites (Presença Noturna).
- **Granularidade de Quarto no PWA**: Evoluir a UI do PWA para permitir seleção ou leitura de QR do Quarto específico.
- **Validação de Regras de Gênero no Check-in**: Implementar bloqueios ou alertas mais rígidos caso o gênero do ocupante não bata com a unidade.

---

## 5. Recomendações de Próximos Passos (Fase 2)

1. **Módulo de Presença Noturna**: Criar um modo "Presença" no scanner PWA que registre apenas o retorno da pessoa à unidade, sem alterar o status de `checked_in`.
2. **Vínculo Granular no Check-in (UI)**: Alterar o PWA para que o operador possa selecionar a **Unidade (Quarto)**, permitindo a atualização real da ocupação planejada em nível de quarto.
3. **Painel de Gestão de Divergência**: Criar relatório no Admin focado em resolver as divergências registradas durante o check-in.

---
## Histórico de Auditorias
- **2026-04-28:** Unificação concluída (Fase 1). Esquemas Admin e PWA operando sobre a mesma base de dados.
- **2026-04-28 (Manhã):** Auditoria inicial completa. Identificada desconexão crítica entre os esquemas de dados Admin e PWA.