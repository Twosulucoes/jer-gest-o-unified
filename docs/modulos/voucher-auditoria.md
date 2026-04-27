# Auditoria de Fechamento — Módulo de Voucher JER Gestão

> **Data da Auditoria de Fechamento:** 2026-04-27.
> **Estado:** NÃO FECHADO (Bloqueios técnicos identificados).

Esta é uma análise consolidada da aderência do módulo de Voucher aos requisitos de negócio reformulados, cobrindo desde o diagnóstico inicial até as melhorias de UX offline.

---

## 1. Levantamento Consolidado do Estado Atual

### 1.1 Web Administrativo
- **Rotas e Telas**: 
    - `/admin/vouchers`: Gestão central de vouchers e lotes.
    - `/admin/vouchers/auditoria`: Central unificada de rastreabilidade.
    - `/admin/pessoas/eventuais`: Cadastro de portadores não credenciados.
    - `/admin/voucher/validar`: Validação manual administrativa.
- **Perfis**: `admin` e `secretaria` com acesso pleno. `/admin/voucher/validar` restrito corretamente via `App.tsx`.
- **Fluxos**: Emissão individual/lote amarrada a instância, reemissão com vínculo (`replaces_voucher_id`), revogação com motivo.
- **Exportação**: CSV e PDF (etiquetas) operacionais em `voucherExport.ts`.
- **Documentação**: `README.md` e `docs/modulos/voucher.md` atualizados.

### 1.2 PWAs Operacionais
- **Alimentação**: Scan online, fila offline, sincronização e central de conflitos (`VoucherConflictCentral`).
- **Alojamento**: Scan online, fila offline, sincronização e central de conflitos.
- **Transporte**: Scan online, fila offline e sincronização. **Lacuna**: Central de conflitos não integrada na tela de embarque.
- **Mensagens**: Dicionário compartilhado `voucherMessages.ts` e `pwa-messages.ts` com padronização total.
- **Módulo Offline**: `voucherOffline.ts` gerencia fila persistente (`localStorage`) e sync automático.

---

## 2. Plano de Inspeção
A auditoria seguiu a ordem: 
1. **Modelo de Dados**: Verificação de colunas e constraints via `information_schema`.
2. **Lógica de Negócio**: Inspeção da RPC `redeem_voucher` e bibliotecas `lib/voucher*`.
3. **Interfaces PWA**: Verificação de importação de componentes de UX e tratamento de estados.
4. **Governança**: Conferência da Central de Auditoria e permissões de rotas.
**Metodologia de Regressão**: Comparação do schema real vs. expectativas do código frontend e RPCs.

---

## 3. Relatório de Aderência por Frente

| Frente | Classificação | Evidência Objetiva |
|---|---|---|
| **Cadastro de Eventual** | ✅ Conforme | Tabela `service_eventual_people` funcional com campos de vínculo e proteção contra exclusão. |
| **Modelo de Voucher** | ✅ Conforme | Colunas `target_*_id`, `batch_id` e `replaces_voucher_id` presentes e utilizadas. |
| **Desativação Legada** | ✅ Conforme | Aba na ficha de participante desativada; "Lote por Delegação" removido. |
| **Emissão Admin** | ✅ Conforme | Wizards exigem instância; agrupamento por lote com rótulos opcional. |
| **Impressão Etiqueta** | ✅ Conforme | PDF gerado com grade de etiquetas, QR e identificação do serviço. |
| **Validação Online** | ✅ Conforme | RPC confere instância exata e bloqueia duplo consumo na mesma instância. |
| **Fila Offline PWA** | ⚠️ Parcial | Fila funcional no front, mas ignora instante real da leitura no BD/RPC. |
| **Central de Conflitos**| ⚠️ Parcial | UX rica em Alimentação/Alojamento; **Ausente** no PWA de Transporte. |
| **Padronização Msg** | ✅ Conforme | Dicionário único `voucherMessages.ts` garante a mesma língua em todo o sistema. |
| **Reemissão c/ Vínculo**| ✅ Conforme | Preserva histórico e imprime nova etiqueta imediatamente. |
| **Auditoria Admin** | ⚠️ Parcial | Página funcional, mas exibe campos vazios para origem offline por falta de colunas no BD. |
| **Permissões** | ✅ Conforme | `/admin/voucher/validar` e `/admin/vouchers` protegidos por perfis corretos. |

---

## 4. Verificação de Regressão Entre Etapas

- **UX Offline**: A última entrega introduziu o uso de `metadata`, `is_offline` e `offline_at` no frontend (`VoucherAuditoriaPage.tsx`), mas **não aplicou** as colunas correspondentes na tabela `service_voucher_attempts`.
- **PWA Transporte**: Durante a refatoração para paridade offline, o componente `VoucherConflictCentral` não foi adicionado ao arquivo `TransporteEmbarquePage.tsx`, criando uma regressão de paridade funcional com os outros PWAs.

---

## 5. Comparativo Acumulado (Auditorias Anteriores)

| Lacuna Apontada | Origem | Estado Atual | Justificativa |
|---|---|---|---|
| Sem vínculo com serviço | Inicial | **RESOLVIDO** | FKs obrigatórias implementadas. |
| Duplo consumo permitido | Inicial | **RESOLVIDO** | Bloqueio lógico na RPC `redeem_voucher`. |
| Perfis indevidos /validar | Pós Fase 4 | **RESOLVIDO** | Rota restrita a admin/secretaria em `App.tsx`. |
| Ausência de fila offline | Pós Fase 4 | **PARCIAL** | Fila existe no front; Pendente persistência de metadados no BD. |
| Detalhe pobre em conflitos| Pós Fase 4 | **PARCIAL** | UX implementada; Depende de schema para dados reais. |

---

## 6. Lacunas Remanescentes

### 6.1 Bloqueantes (Uso em Campo)
1. **Schema Mismatch (Auditoria)**: A tabela `service_voucher_attempts` não possui colunas `metadata`, `is_offline` e `offline_at`. Impacto: Auditoria administrativa não diferencia origem online/offline e não mostra detalhes ricos de conflito.
2. **Ignorância do Tempo Real (RPC)**: A RPC `redeem_voucher` não aceita `p_offline_at`. Impacto: Vouchers escaneados offline dentro da validade podem ser rejeitados se sincronizados após a expiração.
3. **Transporte sem Conflitos**: Operador de transporte não vê a central de conflitos. Impacto: Vouchers recusados no sync offline ficam "invisíveis" para o motorista/fiscal.

### 6.2 Melhorias Opcionais
1. **Constraint de Unicidade**: Adicionar `UNIQUE` em `service_voucher_uses` (reforço de segurança).
2. **Filtro de Lote na Auditoria**: Facilitar investigação de erros em emissões massivas.

---

## 7. Veredito Final de Fechamento

**ESTADO: NÃO FECHADO.**

O módulo apresenta excelente evolução em UX e regras de negócio, mas possui uma **desconexão crítica entre a camada de persistência (BD/RPC) e as novas funcionalidades de paridade offline**. O sistema está "pronto no front" mas "incompleto no back" para os requisitos de operação sob internet instável.

**Procedimento de Mitigação**: Exige uma nova entrega técnica focada exclusivamente em atualização de schema e atualização da assinatura da RPC `redeem_voucher`.

---

## 8. Recomendações Priorizadas

1. **Alta**: Aplicar migração para adicionar `is_offline`, `offline_at` e `metadata` (JSONB) em `service_voucher_attempts`.
2. **Alta**: Atualizar `redeem_voucher` para receber metadados offline e usá-los na validação temporal.
3. **Alta**: Integrar `VoucherConflictCentral` no `TransporteEmbarquePage.tsx`.
4. **Média**: Implementar índice de unicidade em `service_voucher_uses` como redundância à lógica da RPC.

---
## Histórico de Auditorias

### Auditoria Pós Fase 4 (2026-04-27 18:00)
[Conteúdo preservado: Fila offline resiliente recomendada; Correção de perfis em /admin/voucher/validar apontada.]

### Auditoria Inicial (2026-04-27 10:00)
[Conteúdo preservado: Diagnóstico de ausência de vínculo com serviço e cadastro de eventuais.]
