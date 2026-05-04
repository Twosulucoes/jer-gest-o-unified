# Auditoria Operacional: Módulo de Alojamento — JER Gestão

**Reauditoria atual:** 2026-05-04 (auditoria solicitada pelo usuário cobrindo redundância, input × BD, RLS, enums/labels e UX/UI)
**Status global:** 🟡 OPERACIONAL COM DÉBITOS ESTRUTURAIS — fluxo de campo funciona; existem gaps reais de Lei de Escopo no banco, enums sem CHECK, campos do BD não expostos na UI, e labels duplicadas/divergentes entre telas.

> Esta reauditoria substitui as anteriores (2026-04-28 "FECHADO" e 2026-05-03 "OPERACIONAL COM RESSALVAS"). Histórico preservado ao final.

---

## 1. Inventário do Estado Atual

### 1.1 Rotas e telas (sem órfãos confirmados nesta passagem)

#### Admin (`/admin/etapa/:stageId/alojamento/...` — todas stage-scoped)

| Caminho | Página | Função | Status |
|:---|:---|:---|:---:|
| `/alojamento` | `AlojamentoHubPage` | Hub: cards e KPIs | ✅ |
| `/alojamento/locais` | `AlojamentoLocaisPage` | CRUD `lodging_locations` | ✅ |
| `/alojamento/unidades` | `AlojamentoUnidadesPage` | CRUD `lodging_units` | ✅ |
| `/alojamento/ocupacao` | `AlojamentoOcupacaoPage` | Operação check-in/out | ✅ |
| `/alojamento/presenca` | `AlojamentoPresencaPage` | Reconciliação noturna | ✅ |
| `/alojamento/relatorios` | `AlojamentoRelatoriosPage` | Exportação | ✅ |
| `/alojamento/divergencias` | `AlojamentoDivergenciasPage` | Lista divergências | ✅ (re-rotada na Etapa 0 anterior) |
| `/alojamento/alocacao-lote` | `AlocacaoLotePage` | Wizard de alocação por delegação | ✅ (re-rotada na Etapa 0 anterior) |

#### PWA (`/pwa/alojamento/...`)

`AlojamentoHomePage` · `AlojamentoScanPage` · `AlojamentoBuscarPage` · `AlojamentoOcupacaoPage` (PWA) · `AlojamentoPessoaPage` · `AlojamentoIncidentesPage` · `AlojamentoNovoIncidentePage` · `AlojamentoListaCompletaPage` · `AlojamentoUnidadeFaltososPage` — todas roteadas com `PwaRouteGuard` `["alojamento", "admin", "secretaria"]`.

### 1.2 Modelo de dados envolvido

| Tabela | event_id | event_stage_id | RLS | Notas |
|:---|:---:|:---:|:---:|:---|
| `lodging_locations` | NOT NULL | **NULLABLE** | ✅ | Locations of stay |
| `lodging_units` | NOT NULL | **NULLABLE** | ✅ | Quartos com gender, capacity, accessibility (campos extras não aparecem na UI) |
| `lodging_occupancies` | NOT NULL | **NULLABLE** | ✅ | Tem `unit_id` E `checked_in_unit_id` (planejado vs real) — dualidade não documentada |
| `lodging_audit_logs` | **AUSENTE** | **AUSENTE** | ⚠️ Sem RLS por etapa | Trilha completa, mas não é stage-scoped |
| `lodging_presence_logs` | NULLABLE | **AUSENTE** | ⚠️ | Modo lua de reconciliação |
| `lodging_incidents` | (via location_id) | (via location_id) | ✅ EXISTS via location | OK indireto |
| `lodging_supervisions` | NOT NULL | **AUSENTE** | ⚠️ Frouxa | Policy `Allow authenticated view` permite qualquer autenticado |

### 1.3 RPCs operacionais
- `pwa_lodging_checkin(p_device_id, p_token, p_location_id, p_unit_id, p_mode, p_force)` — valida `LEFT_EVENT`, `NEEDS_LODGING_FALSE`, `GENDER_MISMATCH`, `UNIT_FULL`, `ALREADY_CHECKED_IN`, `PARTICIPANT_NOT_FOUND`. SECURITY DEFINER. ✅
- `pwa_lodging_checkout(p_device_id, p_token, p_location_id)` ✅
- `pwa_lodging_register_presence(p_device_id, p_token, p_unit_id, p_mode)` ✅
- Trigger `trg_participant_left_event_lodging` faz auto-checkout / cancel quando `left_event_at` é setado ✅

---

## 2. Achados desta reauditoria

### 2.1 🔴 Crítico — banco / Lei de Escopo

1. **`event_stage_id` NULLABLE em `lodging_locations`/`units`/`occupancies`.**
   Migrações adicionaram a coluna mas nunca aplicaram `SET NOT NULL`. Consequência: `check_user_stage_access(NULL)` retorna FALSE, então registros sem stage ficam invisíveis para qualquer usuário stage-scoped (até admin tem que ter fallback). Fere o quadrante "Operação" do `dominio-canonico.md`.

2. **`lodging_audit_logs` sem `event_id` nem `event_stage_id`.**
   Auditoria operacional sem rastreabilidade de etapa. Impossibilita filtro por etapa em forenses; RLS por etapa é impraticável.

3. **`lodging_presence_logs` sem `event_stage_id`** e `event_id` nullable. Mesma falha.

4. **`lodging_supervisions` sem `event_stage_id` + RLS frouxa** (`Allow authenticated view USING (true)`): qualquer usuário autenticado lê supervisões de qualquer evento.

5. **Sem `CHECK` constraints para enums** (`status`, `gender_restriction`, `severity`, `category`). App força valores válidos, mas INSERT direto via service_role pode corromper.

### 2.2 🔴 Crítico — UI/dados

6. **Status `planned` e `cancelled` não traduzidos.** `ParticipantLogisticaTab.tsx:15-17` mapeia `allocated`/`checked_in`/`checked_out` mas faz fallback ao valor cru para os demais. Operador vê `planned` em inglês.

7. **Mensagens hardcoded em `AlojamentoScanPage`.** `LEFT_EVENT` e `NEEDS_LODGING_FALSE` têm texto literal no componente; resto vem de `systemMessages.ts`. Quebra centralização e dificulta i18n/ajuste.

### 2.3 🟡 Importante — UX/UI

8. **Inconsistência de gender label.** `AlojamentoUnidadesPage.tsx:34` mostra "Masculino"/"Feminino"/"Misto"; `AlojamentoHubPage.tsx:50` e `AlojamentoScanPage.tsx:443` mostram "Masc."/"Fem."/"Misto". Mesmo dado, telas adjacentes.

9. **Campos do BD ausentes na UI** (`lodging_units`):
   - `floor` (andar) — útil em prédios de múltiplos pavimentos.
   - `is_accessible` + `accessible_features_json` — **PCD não tem como ser sinalizado**.
   - `gender_zone` — agrupador de quartos (ex: ala feminina).
   - `min_age_policy` — restrição etária (separar adulto/menor).
   Acessibilidade é o mais grave. Quartos PCD existem no banco como conceito, mas a UI não permite preenchê-los nem buscá-los.

10. **`unit_id` vs `checked_in_unit_id` indocumentado.** Em `lodging_occupancies`, unit_id é o "alocado/planejado" e `checked_in_unit_id` é o "real onde fez check-in". Sem comentário no schema nem na UI; risco de queries usarem o errado.

11. **Sem confirmação de delete** em CRUD de units/locations.

12. **NEEDS_LODGING_FALSE flow confuso.** `AlojamentoScanPage:358-372` cai no fallback genérico mas é tratado especialmente em outro `if` (linha 302-331) com botão "Confirmar mesmo assim". Mistura de caminhos.

13. **Categoria de incidente sem cor** — todas badges `secondary`. `severity` tem cor (azul/âmbar/vermelho), `category` não. Falta hierarquia visual.

14. **Severity em badge minúsculo** (`baixa`, `media`, `alta`) enquanto labels do form vão capitalizadas.

15. **KPI ocupação recalculado em 4+ páginas** (`AlojamentoHubPage`, admin `AlojamentoOcupacaoPage`, `AlojamentoPresencaPage`, PWA `AlojamentoPessoaPage`). Falta hook `useLodgingOccupancy()` centralizando regra.

### 2.4 🟢 Cosmético / refactor ideal

16. `lodging_locations`/`units`/`occupancies` têm `metadata`/`seed_*` sem UI — corretamente ignorados (são internos / seed).
17. PWA OfflineSyncStatus, Hub cards e empty states estão bons.

---

## 3. Plano de evolução proposto

> Etapas 0–2 já estavam concluídas em PRs anteriores (re-rotear órfãs, validar `left_event_at`, validar `needs_lodging`). As etapas abaixo são novas, baseadas nos achados acima. Renumeradas para clareza.

### **Etapa 3 — Lei de Escopo + CHECKs no banco** ✅
**Migração: `20260504020200_alojamento_3_lei_de_escopo.sql`**

- [x] Backfill `event_stage_id`:
  - `lodging_locations`: heurística "primeiro stage não-arquivado do evento (mais antigo por start_date)".
  - `lodging_units`: herda de `lodging_locations` quando ambos referem o mesmo location; fallback para mesma heurística do evento.
  - `lodging_occupancies`: herda de `lodging_units` (relação direta via `unit_id`).
- [x] `SET NOT NULL` nas três tabelas em bloco com `EXCEPTION WHEN not_null_violation` — falha graciosamente com NOTICE se houver linhas órfãs (deploy não para).
- [x] `lodging_audit_logs`: adicionadas `event_id` + `event_stage_id` (nullable + FK), backfill via `unit_id` (preferencial) ou `location_id` (fallback), trigger `sync_lodging_audit_logs_scope` BEFORE INSERT/UPDATE.
- [x] `lodging_presence_logs`: adicionada `event_stage_id` (nullable + FK), backfill via `unit_id`, trigger `sync_lodging_presence_logs_scope`.
- [x] `lodging_supervisions`: adicionada `event_stage_id` (nullable + FK), backfill via `location_id`, trigger `sync_lodging_supervisions_scope`.
- [x] **RLS de `lodging_supervisions` apertada**: drop de TODAS as policies legadas (incluindo `Allow authenticated view USING (true)`), criadas policies canônicas via `has_role()` + `app_role`:
  - `admin`/`secretaria`: ALL
  - `coordenacao_tecnica`: SELECT
  - `alojamento`: ALL
  - Stage scoped read via `check_user_stage_access(event_stage_id)` (consistente com locations/units)
- [x] CHECK constraints (NOT VALID + tentativa de VALIDATE em EXCEPTION):
  - `lodging_units.gender_restriction IN ('male','female','mixed')`
  - `lodging_occupancies.status IN ('planned','allocated','checked_in','checked_out','cancelled')`
  - `lodging_incidents.severity IN ('baixa','media','alta')`
  - `lodging_incidents.category IN ('geral','disciplina','saude','patrimonio','seguranca')`
  - `lodging_incidents.status IN ('aberta','em_atendimento','resolvida')`
- [x] `COMMENT ON COLUMN` documentando `unit_id` (planejado) vs `checked_in_unit_id` (real onde fez check-in) em `lodging_occupancies` para resolver ambiguidade.
- [x] `types.ts` atualizado com novas colunas e relationships.

### **Etapa 4 — Labels e mensagens unificadas** 🔴/🟡
**Pequeno, risco baixo (puro front)**
- Criar `src/lib/alojamento/labels.ts` (módulo centralizado):
  - `lodgingStatusLabel(status)` → `{ label, tone }` (cobre todos os 5 status incl. `planned` e `cancelled`).
  - `genderRestrictionLabel(g, { short })` (long/short variants).
  - `severityLabel`/`categoryLabel`/`incidentStatusLabel` (cor + label).
- Mover `LEFT_EVENT` e `NEEDS_LODGING_FALSE` para `systemMessages.ts`.
- Substituir uses no `ParticipantLogisticaTab`, `AlojamentoUnidadesPage`, `AlojamentoHubPage`, `AlojamentoScanPage`, `AlojamentoIncidentesPage`.
- Padronizar capitalização das badges.

### **Etapa 5 — Acessibilidade e campos PCD na UI** 🟡
**Pequeno, risco baixo**
- `LodgingUnitFormDialog`: adicionar `floor`, `is_accessible` (switch), `accessible_features_json` (chips/checkboxes — rampas, banheiro adaptado, barras, sinalização tátil), `gender_zone` (texto livre opcional), `min_age_policy` (`adulto_only` / `menor_only` / `livre`).
- `AlojamentoUnidadesPage`: filtros "Acessibilidade" + "Andar"; ícone PCD nas linhas com `is_accessible=true`.
- Hub: card "Quartos PCD" com contagem.

### **Etapa 6 — Hook centralizado de ocupação** 🟡
**Pequeno, risco baixo**
- `useLodgingOccupancy({ unitId | locationId | stageId })` retornando `{ planned, checked_in, checked_out, capacity, percentual }`.
- Refactor das 4 páginas para usar o hook (testes manuais para confirmar números iguais).

### **Etapa 7 — UX miúda** 🟡
**Pequeno, risco baixo**
- Confirmação `AlertDialog` antes de deletar unidade/local.
- Documentar `unit_id` vs `checked_in_unit_id` (`COMMENT ON COLUMN`) e padronizar uso em queries.
- Cor por categoria de incidente.

### **Etapa 8 — Drop `participants.biological_sex`** 🟢
**Médio, risco médio (precisa confirmar callers)**
- Audit completo dos leitores restantes do campo legado.
- Migration drop após zerar callers.
- (Já estava na auditoria anterior — mantida.)

### **Etapa 9 — Visão por delegação no PWA** 🟢
**Médio**
- `/pwa/delegacao/alojamento` espelhando o padrão de `delegacao/alimentacao` (Etapa 5 da auditoria de Alimentação).
- RLS escopada por `delegation_id`.
- (Já estava na auditoria anterior — mantida.)

---

## 4. Critérios de pronto (esta reauditoria)

- ✅ Diagnóstico realista com achados ranqueados (🔴 7 críticos / 🟡 8 importantes / 🟢 ok).
- ✅ Plano de Etapas 3–9 com tamanho/risco estimado.
- [ ] Aprovação do usuário sobre a ordem de execução (recomendação: 3 → 4 → 5 → 6 → 7 → 8 → 9).
- [ ] Cada Etapa em uma PR draft separada para revisão incremental.

---

## 5. Recomendação de ordem

1. **Etapa 3 primeiro** — fecha o gap estrutural mais grave (Lei de Escopo, RLS frouxa, integridade de enums). É pré-requisito moral para tudo que vem depois (relatórios cross-stage, divergências corretas).
2. **Etapa 4** logo em seguida — barata, alta visibilidade, fecha o risco de exibir enum cru.
3. **Etapa 5** (acessibilidade) — destrava operação real de quartos PCD.
4. **6–7** em paralelo (refactor + UX miúda).
5. **8** depois de checar callers.
6. **9** quando houver decisão sobre o módulo Delegação amadurecer.

---

## Histórico de Auditorias (preservado)

### 2026-05-03 — Reauditoria pós-Alimentação
Estado: 🟡 OPERACIONAL COM RESSALVAS. Identificou órfãs (`AlocacaoLotePage`, `AlojamentoDivergenciasPage`) — corrigidas em Etapa 0. Etapas 1 e 2 (cross-check `left_event_at` e `needs_lodging`) também fechadas neste ciclo.

### 2026-04-28 — Fechamento original
Veredito: ✅ FECHADO PARA OPERAÇÃO. Inventário ok no papel mas registro de rotas não foi conferido — daí as duas reauditorias subsequentes.

### Etapas concluídas em ciclos anteriores (preservadas)

- **Etapa 0** ✅ — Re-rotear órfãs + cards no Hub + atualizar docs.
- **Etapa 1** ✅ — `pwa_lodging_checkin` valida `participants.left_event_at`; trigger `trg_participant_left_event_lodging` faz auto-checkout/cancel.
- **Etapa 2** ✅ — `pwa_lodging_checkin` valida `participants.needs_lodging` com override `p_force`; UI exibe toast com botão "Confirmar mesmo assim".

