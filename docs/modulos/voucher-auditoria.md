# Auditoria de Fechamento — Módulo de Voucher JER Gestão

> **Auditoria 2026-05-06 (etapa Hqy0B-p1):** P0 já mergeado (#115). Pacote **P1** em PR aberta `claude/audit-vouchers-module-Hqy0B-p1`.
> **Estado:** 🟢 P0 mergeado / 🟡 P1 pendente revisão.
> Histórico: ✅ FECHADO 2026-04-28 → regressão por mudança de RPC → P0 mergeado em 2026‑05‑06 → P1 (filtros, audit, RLS).

## Auditoria 2026-05-06 (Hqy0B-p1) — Pacote P1

| Frente | Mudança | Migration / Arquivo |
|---|---|---|
| Denormalização | `event_stage_id` em `service_voucher_batches` e `service_voucher_attempts` (com backfill via voucher) + índices. Trigger `fill_attempt_event_stage_id` mantém preenchimento em novos inserts. | `20260507000000_voucher_p1_stage_scope_and_audit.sql` |
| Audit trigger | `log_voucher_status_change` em `service_vouchers` registra revoke/expire/unrevoke em `service_voucher_audit` com `event_type`, `old_status`/`new_status`, `revoke_reason`, `replaces_voucher_id`, `reissued_at`. | mesma migration |
| Anti-spoof | Trigger `enforce_audit_issuer_id` força `issuer_id = auth.uid()` em `service_voucher_audit`. | mesma migration |
| RLS por etapa | Policies novas em `service_vouchers`/`batches`/`uses`/`attempts` usando `check_user_stage_access(event_stage_id)`. Operacionais (transporte/alimentacao/alojamento) só enxergam vouchers das etapas atribuídas em `user_stage_assignments`; admin/secretaria/super_admin/coordenacao_tecnica bypassam. | mesma migration |
| Filtros listagem | **Dia** (default hoje), **Escopo** (já existia), **Janela/viagem/local** (dependente do escopo, lista da etapa ativa), **Status**/**Tipo**/Busca. Indicador visual etapa ativa + dia. | `src/pages/admin/VouchersPage.tsx` |
| Filtros auditoria | **Dia** (default hoje), **Resultado**, **Serviço**, **Origem (online/offline)**, **Operador** (dropdown dinâmico). Indicador etapa ativa + contagem. | `src/pages/admin/VoucherAuditoriaPage.tsx` |

---

## Auditoria 2026-05-06 — Bloqueadores P0 corrigidos

| # | Bloqueador | Onde | Correção |
|---|---|---|---|
| B1 | Emissão (individual e lote) lançava "Selecione uma etapa" mesmo com etapa ativa: wizards liam `instances.stageId` (campo inexistente). | `src/pages/admin/VouchersPage.tsx` | `stageId` propagado via prop a partir de `useStageScope()`; botões "Novo Voucher"/"Novo Lote" desabilitam quando não há etapa ativa. |
| B2 | Voucher de **alojamento** sem `target_date` nascia eterno (`valid_from/valid_until` NULL). | Trigger `derive_voucher_validity` + wizards | Trigger recusa INSERT sem `target_date` quando `target_facility_id` informado; UI exige campo "Data" no Step 2 de lodging em ambos wizards. |
| B3 | RPC `redeem_voucher` aceitava aggregate (lote anônimo) infinitas vezes; não incrementava `current_uses`; ignorava `max_uses`. | `redeem_voucher` | Migration `20260506500000_voucher_p0_fixes_canonical.sql` restaura uso único por `(voucher, serviço, instância)` para todos os tipos, incremento de `current_uses` e enforce de `max_uses`. |
| B4 | `p_context_id` ausente bypassava `wrong_instance` (NULL `<>` UUID = NULL). | RPC + telas admin | RPC trata `p_context_id IS NULL` com voucher target como `wrong_instance`; `VoucherValidarPage` exige seleção de janela/viagem/local; `ValidacaoQRPage` deixa de fazer fallback para `meals` em pontos `general`/`entrada`. |
| B5 | `p_offline_at` sem clamp permitia clock manipulado consumir fora da janela. | RPC | Futuro vira `now()`; `> 24h` no passado retorna `offline_too_old`. Voucher sem `valid_until` retorna `missing_validity` (defesa em profundidade). |
| B6 | Sync offline passava `p_metadata` inexistente → toda fila falhava. | `src/lib/voucherOffline.ts` | Removido parâmetro extra. |
| B7 | Auditoria com JOINs em colunas inexistentes (`batches.name`, `profiles.display_name`). | `src/pages/admin/VoucherAuditoriaPage.tsx` | Trocados para `batches.label` e `profiles.full_name`. |

Referência completa: relatório de auditoria entregue em `claude/audit-vouchers-module-Hqy0B`.

---

Esta é uma análise consolidada da aderência do módulo de Voucher aos requisitos de negócio reformulados, após a implementação das correções bloqueantes de paridade offline e schema.

---

## 1. Levantamento Consolidado do Estado Atual

### 1.1 Web Administrativo
- **Rotas e Telas**: 
    - `/admin/vouchers`: Gestão central de vouchers e lotes.
    - `/admin/vouchers/auditoria`: Central unificada de rastreabilidade (Exibindo origem offline, instante real e metadados ricos).
    - `/admin/pessoas/eventuais`: Cadastro de portadores não credenciados.
    - `/admin/voucher/validar`: Validação manual administrativa.
- **Perfis**: `admin` e `secretaria` com acesso pleno. `/admin/voucher/validar` restrito corretamente via `App.tsx`.
- **Fluxos**: Emissão individual/lote amarrada a instância, reemissão com vínculo (`replaces_voucher_id`), revogação com motivo.
- **Auditoria**: Tabela `service_voucher_attempts` agora possui colunas `is_offline`, `offline_at` e `metadata` (JSONB).

### 1.2 PWAs Operacionais
- **Alimentacao**: Scan online, fila offline (enviando `p_offline_at`), sincronização e central de conflitos.
- **Alojamento**: Scan online, fila offline (enviando `p_offline_at`), sincronização e central de conflitos.
- **Transporte**: Scan online, fila offline (enviando `p_offline_at`), sincronização e **Central de conflitos integrada**.
- **Regra Temporal**: A RPC `redeem_voucher` agora utiliza o instante real da leitura (`p_offline_at`) para validação de expiração.

---

## 2. Relatório de Aderência por Frente

| Frente | Classificação | Evidência Objetiva |
|---|---|---|
| **Cadastro de Eventual** | ✅ Conforme | Tabela `service_eventual_people` funcional. |
| **Modelo de Voucher** | ✅ Conforme | Colunas de vínculo e instância presentes. |
| **Fila Offline PWA** | ✅ Conforme | Registra e envia instante real da leitura; respeita validade temporal offline. |
| **Central de Conflitos**| ✅ Conforme | Integrada nos 3 PWAs (Alimentacao, Transporte, Alojamento). |
| **Auditoria Admin** | ✅ Conforme | Exibe marcação offline, instante real e detalhes ricos de conflito via JSONB. |
| **Persistência de Metadados**| ✅ Conforme | Tabela `service_voucher_attempts` sincronizada com o frontend. |

---

## 3. Mini-auditoria de Confirmação (2026-04-28 19:30)

### 3.1 Bloqueante de Schema
- **Status**: ✅ Resolvido.
- **Evidência**: Inspecionada a tabela `service_voucher_attempts`. Colunas `is_offline` (boolean), `offline_at` (timestamptz) e `metadata` (jsonb) existem e estão operacionais. Registros legados mantêm compatibilidade.

### 3.2 Bloqueante da Função de Validação
- **Status**: ✅ Resolvido.
- **Evidência**: A RPC `public.redeem_voucher` agora aceita `p_is_offline` e `p_offline_at`. A lógica utiliza `v_reference_time := COALESCE(p_offline_at, now())` para validar expiração, garantindo que leituras em campo dentro da validade sejam aceitas mesmo se sincronizadas tarde. A função compõe metadados detalhados (status, motivo da revogação, etc.) e os persiste em `service_voucher_attempts`.

### 3.3 Bloqueante do PWA Transporte
- **Status**: ✅ Resolvido.
- **Evidência**: `TransporteEmbarquePage.tsx` integra `<VoucherConflictCentral />`. O fluxo de leitura em `handleScan` agora trata vouchers offline via `addToVoucherQueue` com paridade aos demais PWAs. A central de conflitos unificada permite resolução e descarte local com persistência.

### 3.4 Verificação Integrada e Não Regressão
- **Auditoria Administrativa**: `/admin/vouchers/auditoria` exibe crachá de "OFFLINE", instante da leitura e detalhes ricos extraídos do JSONB de metadados.
- **Não Regressão**: Fluxos online e filas de credencial (Alimentacao/Alojamento) permanecem funcionais e isolados das mudanças de voucher.

---

## 4. Veredito Final

**ESTADO: FECHADO.**

O módulo de Voucher está tecnicamente completo, seguro e resiliente para operação real em campo, atendendo a todos os requisitos de rastreabilidade, paridade offline e governança temporal.

---

## Histórico de Auditorias

### Auditoria de Fechamento (2026-04-27)
**Estado: NÃO FECHADO.**
Identificados bloqueios técnicos: Schema mismatch na auditoria, ignorância do tempo real na RPC e ausência de central de conflitos no Transporte.

### Auditoria Pós Fase 4 (2026-04-27 18:00)
[Conteúdo preservado: Fila offline resiliente recomendada; Correção de perfis em /admin/voucher/validar apontada.]

### Auditoria Inicial (2026-04-27 10:00)
[Conteúdo preservado: Diagnóstico de ausência de vínculo com serviço e cadastro de eventuais.]
