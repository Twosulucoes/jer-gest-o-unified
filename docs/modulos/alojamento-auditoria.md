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

---

# Mini-Auditoria de Confirmação - Fase 1
**Data:** 28 de Abril de 2026 (Tarde)
**Veredito:** ✅ Confirmada e Sólida

## 1. Passo a Passo da Validação

### 1.1 Fonte Única de Verdade (Single Source of Truth)
- **Status:** ✅ Conforme
- **Evidência:** Varredura completa do código fonte confirmou que não existem mais `INSERT` ou `UPDATE` direcionados ao esquema `alojamento`. Todas as rotas operacionais e administrativas convergem para `public.lodging_occupancies`. Referências remanescentes ao esquema `alojamento` são exclusivas para leitura histórica ou via RPC `resolve_qr` (que apenas lê tokens).

### 1.2 RPCs Operacionais
- **Status:** ✅ Conforme
- **Evidência:** Inspeção das funções `pwa_lodging_checkin` e `pwa_lodging_checkout` confirmou:
  - Proteção rigorosa contra check-in duplo.
  - Validação de status de participante (ativo).
  - Registro automático de divergência entre unidade planejada e executada.
  - Gravação em `lodging_audit_logs` com metadados ricos (dispositivo, usuário, erro).

### 1.3 Integração Admin (Planejado vs Executado)
- **Status:** ✅ Conforme
- **Evidência:** A tela `AlojamentoOcupacaoPage` consome a mesma tabela que o PWA. O alerta de divergência está implementado e visível no dashboard administrativo, garantindo que a gestão saiba quando o planejado não foi seguido.

### 1.4 Fila Offline no PWA
- **Status:** ✅ Conforme
- **Evidência:** O hook `useAlojamentoOffline` foi atualizado para as novas RPCs unificadas. O fluxo de persistência local, tentativa de sincronismo e notificação de sucesso/erro permanece funcional e integrado ao novo modelo de dados.

### 1.5 Trilha de Auditoria Unificada
- **Status:** ✅ Conforme
- **Evidência:** A tabela `public.lodging_audit_logs` centraliza agora todos os eventos operacionais de alojamento, eliminando a dispersão que existia na `alojamento.scan_events`.

### 1.6 Permissões e Segurança
- **Status:** ✅ Conforme
- **Evidência:** Políticas RLS (Row Level Security) aplicadas a todas as novas tabelas do `public`. Proteções de rota no `App.tsx` garantem que apenas o perfil `alojamento` acesse o PWA e perfis administrativos acessem a gestão.

## 2. Verificação de Não Regressão
- **Alocação em Lote:** Mantida funcional, agora com vínculos corrigidos (hints de FK) para evitar ambiguidade.
- **Voucher de Alojamento:** Integração preservada no scanner PWA.
- **Pessoas Unificadas:** Fluxo de busca e detalhamento de pessoa integrado ao modelo de participantes unificado.

## 3. Conclusão
A fundação do módulo de Alojamento foi corrigida com sucesso. A dualidade de esquemas, que era o maior risco técnico identificado, foi eliminada sem perda de funcionalidade. O sistema está pronto para a **Fase 2: Controle de Presença Noturna**.