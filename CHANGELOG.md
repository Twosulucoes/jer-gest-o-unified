# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Added — Vouchers (P3, auditoria etapa Hqy0B-p3)
- **[Vouchers]** `pg_cron` agora roda `mark_expired_vouchers()` a cada **1 minuto** (era 15 min); chamada client-side redundante removida da listagem. Listagem fica mais leve e o status `expired` aparece em até 1 min após a janela fechar.
- **[Vouchers]** **Realtime** em `service_vouchers`: a `VouchersPage` se inscreve em `postgres_changes` filtrado por `event_id` e invalida automaticamente as queries (`vouchers`/`voucher-batches`) quando outro operador (mesma aba ou outra) cria, revoga ou reemite voucher. Sem F5 manual em pico de evento.
- **[Vouchers]** Atalhos UX nos filtros de Dia: botões **Hoje** e **Toda a etapa** com destaque do estado ativo, em listagem e auditoria.

### Added — Vouchers (P2, auditoria etapa Hqy0B-p2)
- **[Vouchers]** RPCs canônicas dedicadas: `revoke_voucher_v1(p_voucher_id, p_reason)`, `revoke_voucher_batch_v1(p_batch_id, p_reason)` e `reissue_voucher_v1(p_voucher_id, p_reason, p_new_qr)`. Atomic, com lock pessimista e idempotência (segundo clique não duplica reissue nem reinicia revogação). RLS aplicada via `SECURITY INVOKER`.
- **[Vouchers]** Trigger `revalidate_voucher_validity_on_update` em `service_vouchers`: BEFORE UPDATE recalcula `valid_from`/`valid_until` quando `target_*_id` ou `target_date` mudam (defesa em profundidade para manutenção manual via SQL).
- **[Vouchers]** Frontend `VouchersPage` migrado para as RPCs canônicas (revoke/reissue). Mensagens de erro técnicas (RLS, PostgREST, 404, schema) substituídas por PT-BR operacional via helper `humanizeVoucherError`.
- **[Vouchers]** Estados de UI completos: skeleton durante loading e empty state informativo (com sugestão de ajuste de filtro) tanto na lista de vouchers quanto na lista de lotes.
- **[Vouchers]** Logs `console.log("DEBUG: ...")` removidos de produção.

### Added — Vouchers (P1, auditoria etapa Hqy0B-p1)
- **[Vouchers]** Filtros completos na listagem: **Dia** (date picker, default = hoje), **Janela/viagem/local** (lista da etapa ativa, dependente do escopo), **Status**, **Escopo**, **Tipo**, busca textual. Indicador visual da etapa ativa e do dia filtrado.
- **[Vouchers]** Filtros completos na auditoria: **Dia** (default = hoje), **Resultado** (sucesso/recusa), **Serviço**, **Origem** (online/offline), **Operador** (dropdown dinâmico). Indicador de etapa ativa e contagem de registros.
- **[Vouchers]** Trigger `log_voucher_status_change` em `service_vouchers` registra automaticamente em `service_voucher_audit` toda mudança de status (revoke, expire, unrevoke), com `event_type`, `voucher_id`, `event_stage_id`, `old_status` → `new_status`, motivo e dados de reemissão.
- **[Vouchers]** Trigger `enforce_audit_issuer_id` força `issuer_id = auth.uid()` em `service_voucher_audit` (anti-spoof).
- **[Vouchers]** Coluna `event_stage_id` denormalizada em `service_voucher_batches` (com backfill via primeiro voucher do lote) e em `service_voucher_attempts` (com backfill + trigger `fill_attempt_event_stage_id`). Listagem de lotes deixa de fazer subquery e passa a filtrar direto.
- **[Vouchers]** RLS endurecida por etapa para `service_vouchers`, `service_voucher_batches`, `service_voucher_uses` e `service_voucher_attempts` via `check_user_stage_access(event_stage_id)` — operacionais (`alimentacao`/`transporte`/`alojamento`) só veem vouchers das etapas atribuídas em `user_stage_assignments`. `admin`/`secretaria`/`super_admin`/`coordenacao_tecnica` mantêm acesso amplo (bypass na função).

### Fixed — Vouchers (P0, auditoria etapa Hqy0B)
- **[Vouchers]** Emissão (individual e lote) destravada: `stageId` passa a ser propagado pelos dois wizards a partir de `useStageScope()` no `VouchersPage`. Sem etapa ativa os botões "Novo Voucher" / "Novo Lote" ficam desabilitados com tooltip explicativo.
- **[Vouchers]** Voucher de **alojamento** agora exige campo "Data" obrigatório nos wizards; trigger `derive_voucher_validity` recusa `INSERT` com `target_facility_id` sem `target_date` (regra "válido somente no dia").
- **[Vouchers]** RPC `redeem_voucher` reescrita canônica:
  - Restaura enforce de **uso único por (voucher, serviço, instância)** para qualquer tipo (nominal e aggregate).
  - Restaura incremento de `current_uses` e bloqueio por `max_uses`.
  - **`p_context_id` ausente** com voucher target → `wrong_instance` (não mais aceito silenciosamente).
  - **Clamp de `p_offline_at`**: futuro vira `now()`; mais velho que 24 h é recusado como `offline_too_old`.
  - Voucher sem `valid_until` é recusado com `missing_validity` (defesa em profundidade).
  - Janelas atravessando meia-noite (`end_time < start_time`) ganham +1 dia em `valid_until`.
- **[Vouchers]** `VoucherValidarPage` admin reformulada: exige seleção da janela/viagem/local (instâncias filtradas pela etapa ativa) antes de permitir scan; perfis operacionais (alimentação/transporte/alojamento/coordenação técnica) passam a poder validar.
- **[Vouchers]** `ValidacaoQRPage` (scanner universal) deixa de fazer fallback silencioso para `meals` quando o ponto de scan é "general"/"entrada" e orienta o operador para a tela dedicada.
- **[Vouchers]** Sync offline (`voucherOffline.syncVoucherQueue`) deixa de passar parâmetro `p_metadata` inexistente, eliminando falhas em massa de fila offline.
- **[Vouchers]** Auditoria (`VoucherAuditoriaPage`) corrige JOINs quebrados: `service_voucher_batches(label)` (era `name`) e `profiles(full_name)` (era `display_name`).

### Added
- **[Manual]** Nova seção "Primeiros Passos" para perfil Admin com 8 cards de jornada cronológica e barra de progresso.
- **[Manual]** Tabela `admin_manual_progress` para rastreamento persistente de conclusão de etapas por usuário.
- **[Manual]** Campos `link_path` e `action_label` em `help_manual_sections` para tornar o manual interativo.
- **[Manual]** Interface de edição de cards interativos no `SuperManualPage`.
- **[Manual]** Redação completa da Seção 4 (PWAs Mobile): inclusão de bloco transversal Offline (4.0), Vouchers (4.6) e reescrita estruturada das 5 PWAs operacionais.
- **[Manual]** Padronização de terminologia: substituição total de "Incidentes" por "Ocorrências" no conteúdo do manual.
- **[Manual]** Implementação de alerta LGPD na PWA Delegação devido ao acesso a dados de saúde (medical_notes).
- Centro de Regras do Evento: 4 páginas públicas em `/eventos/:eventSlug/` (regras, modalidades, qualificação, assistente-inscrição)
- Componentes compartilhados de badges regulatórios: `RuleStatusBadge`, `EligibilityBadge`, `SelectionMethodBadge`, `DisciplineTypeBadge`
- `SportEventRuleDrawer`: drawer lateral com resumo regulatório, campos estruturados e JSON bruto
- `RuleWarningCallout`: alertas visuais para confirmação manual, somente estadual, não elegível
- `RuleJsonAccordion`: accordion para auditoria de JSONs estruturados
- Hook `useEventRulesCenter`: consolidação de `sport_event_rules` + `sport_events` + `sports` + `categories`
- Tipo `RuleSportEventView`: view derivada com campos calculados (national_flow_status, institution_limit_summary, etc.)
- Utilitários em `rulesTransform.ts`: parseAllowedGenders, buildNationalFlowStatus, buildSelectionMethodLabel, etc.
- Filtros por tipo de disciplina, status nacional, busca textual e exportação CSV em todas as tabelas
- Mapa de Qualificação com agrupamento por modalidade/sede/prioridade e regras especiais expansíveis
- Assistente Operacional de Inscrição com painel de regras, restrições e elegibilidade nacional por modalidade
- Consolidação de ranking cross-heat para modalidades individuais (time/mark)
- `CrossHeatRankingCard`: ranking geral exibido na página da partida (bateria) com destaque da bateria atual
- `CrossHeatRankingTab`: tab de classificação no wizard (Passo 5) com filtros, busca e exportação CSV
- `useCrossHeatRanking` hook: busca batch de todas as baterias/resultados/tentativas com refresh automático a cada 30s
- `computeCrossHeatRanking` em individualRanking.ts: ranking consolidado com empates (posição compartilhada) e outcomes ordenados (DSQ > DNS > DNF > WO)
- Geração automática de baterias (heats) para modalidades individuais de família time e mark (Atletismo, Natação, etc.)
- Componente `CentralStructureHeatsTab` com wizard de 3 sub-etapas (Definir → Revisar → Confirmar)
- `useCollectiveStepStatus` agora suporta bloqueio de passos para individuais time/mark
- **[PWA]** Correção na navegação entre módulos: o seletor de contexto (switcher) agora está sempre visível no PWA, mesmo para usuários com apenas um módulo.
- **[PWA]** Botão Home do PWA ajustado para levar sempre à landing page de seleção de módulos (`/pwa`).
- **[Documentação]** Implementada área técnica em `/super/documentacao` com modelo Docs-as-Code (import.meta.glob).
- **[Documentação]** Sistema de auditoria de visualização de documentos técnicos via `audit_events`.
- **[Documentação]** Integração condicional (super_admin) no rodapé do Manual de Instruções.
- **[Documentação]** Reformulação completa do `README.md` e atualização dos manuais operacionais (Fase "Documentação Opulenta").


### Changed
- **[Roteamento]** Conclusão da Fase 2 do Saneamento de Rotas: normalização e segregação de escopos Admin (negócio) vs Super (infraestrutura).
- **[Roteamento]** Movimentação de rotas críticas para escopo Super: `/admin/acessos/pwa`, `/admin/importacao/aliases`, `/admin/debug-publicados`.
- **[Roteamento]** Implementação de redirecionamentos permanentes para manter retrocompatibilidade de links antigos.
- Labels de credenciamento padronizados ("Registrar presença", "Emitir credencial")

### Removed
- **[Dívida Técnica]** Remoção definitiva de código comentado e importações mortas em `AppRoutes.tsx` e `AdminLayout.tsx`.
- **[Roteamento]** Remoção da rota redundante `/admin/dados` (unificada em `/super/dados`).
- **[Roteamento]** Remoção da rota órfã `/admin/central-controle` (redirecionada para `/admin`).
- **[Roteamento]** Remoção da rota órfã `/admin/auth/email-templates` (redirecionada para `/admin`).

### Fixed
- Unificação de `credential_code` e `qr_code_value` em utilitário centralizado
- Confirmação modal em ações batch de credenciamento

### Security
- RLS habilitado em 100% das tabelas (41/41)
- 13 triggers de validação de integridade referencial

---

## Convenção de Registro

Ao registrar mudanças, use o módulo como prefixo:

```
### Added
- **[Credenciamento]** Link direto para página do participante na listagem
- **[Competição]** Página de agenda visual de partidas

### Fixed
- **[Alimentação]** Constraint de duplicidade em consumo por janela
```

### Categorias

| Seção | Quando usar |
|-------|------------|
| `Added` | Funcionalidade nova |
| `Changed` | Alteração em funcionalidade existente |
| `Deprecated` | Funcionalidade marcada para remoção |
| `Removed` | Funcionalidade removida |
| `Fixed` | Correção de bug |
| `Security` | Correção ou melhoria de segurança |
