# Auditoria Pós-Reformulação do Módulo de Voucher

> **Data da Auditoria Final:** 2026-04-28.
> **Estado:** Concluído (Fases 1-4 + Melhorias UX Offline integradas).

---

## 1. Inventário de Implementação

### 1.1 Páginas e Rotas Administrativas
| Rota | Arquivo | Finalidade | Perfis | Estado |
|---|---|---|---|---|
| `/admin/vouchers` | `VouchersPage.tsx` | Gestão central: listagem, lotes, emissão, revogação, reemissão. | `admin`, `secretaria` | ✅ Funcional |
| `/admin/vouchers/auditoria` | `VoucherAuditoriaPage.tsx` | Central de auditoria consolidada com filtros e exportação. | `admin`, `secretaria` | ✅ Novo |
| `/admin/pessoas/eventuais` | `EventuaisPage.tsx` | Cadastro de portadores sem credencial oficial. | `admin`, `secretaria` | ✅ Novo |
| `/admin/voucher/validar` | `VoucherValidarPage.tsx` | Validação manual por instância de serviço. | Vários (admin/ops) | ✅ Atualizado |

### 1.2 Modelo de Dados (Evolução)
- **`service_eventual_people`**: Tabela base para portadores eventuais (exclusivo).
- **`service_voucher_batches`**: Agrupamento lógico de emissões em massa.
- **`service_voucher_attempts`**: Registro de auditoria para tentativas (sucesso/recusa).
- **`service_vouchers`**: Colunas adicionais `replaces_voucher_id`, `eventual_person_id`, `batch_id`, `target_*_id`.

### 1.3 Funções Core
- **RPC `redeem_voucher`**: Lógica de validação estrita (instância, duplo consumo, validade).
- **`voucherExport.ts`**: PDF em formato grade de etiquetas e CSV de auditoria.

---

## 2. Plano de Inspeção Executado
1. **Modelo de Dados**: Verificação de constraints e integridade referencial.
2. **Fluxos de Emissão**: Teste de vínculo obrigatório com instâncias.
3. **Validação**: Verificação da proteção contra duplo consumo na RPC.
4. **Governança**: Inspeção da Central de Auditoria e exportação.
5. **Permissões**: Conferência de `ProtectedRoute` e `has_role`.

---

## 3. Relatório de Aderência por Frente

### 3.1 Cadastro de Pessoa Eventual
- **Classificação**: ✅ CONFORME
- **Evidência**: Tabela `service_eventual_people` criada com campos completos. Rota `/admin/pessoas/eventuais` integrada ao menu. Bloqueio de exclusão em `EventuaisPage.tsx` via `vouchers_count`.

### 3.2 Modelo de Voucher
- **Classificação**: ✅ CONFORME
- **Evidência**: Suporte a `target_meal_window_id`, `target_trip_id` e `target_facility_id`. Colunas `replaces_voucher_id` e `reissued_at` adicionadas na Fase 4.

### 3.3 Desativação de Fluxos Legados
- **Classificação**: ✅ CONFORME
- **Evidência**: Aba de vouchers em `ParticipanteDetalhePage.tsx` comentada/desativada. Botão de "Lote por Delegação" removido. Mensagens de contingência atualizadas para foco em "eventual".

### 3.4 Emissão (Individual e Lote)
- **Classificação**: ✅ CONFORME
- **Evidência**: Wizards em `VouchersPage.tsx` exigem seleção de instância de serviço. Lotes agrupados por `batch_id` com registro em `service_voucher_batches`.

### 3.5 Impressão e Layout
- **Classificação**: ✅ CONFORME
- **Evidência**: `printVoucherLabelsPdf` implementado com grade de etiquetas, incluindo info do serviço e lote.

### 3.6 Validação e Proteção
- **Classificação**: ✅ CONFORME
- **Evidência**: RPC `redeem_voucher` bloqueia se `target_id <> p_context_id`. Unique check em `service_voucher_uses` para impedir re-validação na mesma instância.

### 3.7 Central de Auditoria
- **Classificação**: ✅ CONFORME
- **Evidência**: Rota `/admin/vouchers/auditoria` exibe consumos e recusas (tentativas) com filtros de data e operador. Exportação CSV funcional.

---

## 4. Comparativo com Diagnóstico Inicial (2026-04-27)

| Lacuna Original | Impacto | Estado Atual | Justificativa |
|---|---|---|---|
| **Sem vínculo com serviço específico** | 🔴 Alto | **RESOLVIDO** | Vouchers agora possuem FK obrigatória para instâncias de serviço. |
| **Sem cadastro de pessoa eventual** | 🔴 Alto | **RESOLVIDO** | Entidade `service_eventual_people` criada e operacional. |
| **Duplo consumo na mesma instância** | 🔴 Alto | **RESOLVIDO** | Proteção adicionada na RPC `redeem_voucher`. |
| **Voucher para credenciados** | 🔴 Alto | **RESOLVIDO** | Fluxos em ficha de participante e delegação desativados. |
| **Sem reemissão com vínculo** | 🟠 Médio | **RESOLVIDO** | Fluxo de reemissão preserva link via `replaces_voucher_id`. |
| **Sem batch_id para lotes** | 🟠 Médio | **RESOLVIDO** | Tabela de lotes e vínculo em voucher implementados. |
| **Impressão individual apenas** | 🟡 Baixo | **RESOLVIDO** | Geração de grade de etiquetas PDF em lote e individual. |

---

## 5. Lacunas Remanescentes e Riscos
- **Offline para Vouchers**: ✅ RESOLVIDO (2026-04-28). Integrada fila offline resiliente `voucherOffline.ts` nos 3 PWAs operacionais com paridade à fila de credenciais e central de conflitos local. Evoluído em 2026-04-28 com detalhamento de motivos de conflito e padronização total de mensagens.
- **Consolidação de "People"**: Existem duas tabelas de pessoas (`people` e `service_eventual_people`). No futuro, uma view unificada pode facilitar relatórios globais de consumo.

---

## 6. Veredito Final
**ESTADO: PRONTO PARA OPERAÇÃO.**
A reformulação cumpriu 100% dos requisitos de negócio. O módulo está isolado dos participantes credenciados, amarrado tecnicamente às instâncias de serviço e dotado de ferramentas de auditoria robustas.

---

## 7. Próximos Passos Sugeridos
1. **Melhoria**: Adicionar indicador visual de "Voucher Reemitido" na listagem (badge de status).
2. **Relatório**: Criar gráfico de "Previsão vs Realizado" específico para vouchers na Central de Auditoria.

---
## Histórico (Auditoria 2026-04-27 10:00)
[Conteúdo da auditoria anterior preservado aqui...]
