# Auditoria Operacional: Módulo de Alojamento — JER Gestão
**Data:** 2026-05-03 (re-audit pós Alimentação)
**Status Global:** 🟡 OPERACIONAL COM RESSALVAS — duas telas críticas existem em `src/` mas estão **órfãs** (não registradas em rotas), além de ajustes alinhados ao novo modelo de presença efetiva introduzido pelo módulo de Alimentação.

> Esta auditoria substitui a anterior (declarada "FECHADO PARA OPERAÇÃO" em 2026-04-28), que se baseou no inventário do código sem testar se as rotas estavam de fato registradas. O histórico está preservado ao final.

---

## 1. Levantamento do Estado Atual

### 1.1 Telas e fluxos existentes

#### Admin
| Tela | Rota declarada | Rota registrada? | Função |
|:---|:---|:---:|:---|
| Hub de Alojamento | `/admin/etapa/:stageId/alojamento` | ✅ | Visão geral de locais e quartos da etapa, atalhos para operações. |
| Locais | `/alojamento/locais` | ✅ | CRUD de `lodging_locations`. |
| Unidades | `/alojamento/unidades` | ✅ | CRUD de `lodging_units` com gênero, capacidade. |
| Ocupação | `/alojamento/ocupacao` | ✅ | Operação real de check-in/out, listas. |
| Presença Noturna | `/alojamento/presenca` | ✅ | Reconciliação Presentes/Ausentes/Faltosos. |
| Relatórios | `/alojamento/relatorios` | ✅ | Exportação XLSX/CSV/PDF. |
| **Alocação em Lote** | `/admin/alojamento/alocacao-lote` (docs) | ❌ **órfã** | Wizard de alocação por delegação respeitando gênero/capacidade. **Existe em `src/pages/admin/alojamento/AlocacaoLotePage.tsx` mas não há `<Route>` registrado.** |
| **Divergências** | `/alojamento/divergencias` (auditoria anterior) | ❌ **órfã** | Lista consolidada de divergências (alocado × real) e ausências de check-in. **Existe em `src/pages/admin/AlojamentoDivergenciasPage.tsx` mas não há `<Route>` registrado.** |

#### PWA (`/pwa/alojamento`)
| Tela | Rota | Função |
|:---|:---|:---|
| Home | `/pwa/alojamento` | Atalhos para escanear, buscar, ocupação, lista. |
| Scanner | `/pwa/alojamento/scan` | Check-in / Check-out / Modo Lua via QR. |
| Buscar | `/pwa/alojamento/buscar` | Busca manual (nome/CPF) — somente consulta. |
| Ocupação | `/pwa/alojamento/ocupacao` | Visão de ocupação atual. |
| Pessoa | `/pwa/alojamento/pessoa/:id` | Detalhes de hospedagem da pessoa. |
| Incidentes | `/pwa/alojamento/incidentes` e `/incidentes/novo` | Trilha de incidentes. |
| Lista Completa | `/pwa/alojamento/lista-completa` | Lista consolidada de hóspedes. |
| Faltosos da unidade | `/pwa/alojamento/unidade/:unitId/faltosos` | "Quem deveria estar aqui". |

### 1.2 Modelo de dados envolvido
- `lodging_locations(event_id, event_stage_id, name, address, is_active)`
- `lodging_units(event_id, event_stage_id, location_id, name, capacity, gender_restriction, is_active)`
- `lodging_occupancies(participant_id, unit_id, status, checked_in_at, checked_in_by, checked_in_device_id, checked_in_location_id, checked_in_unit_id, checked_out_at, checked_out_by, divergence_notes, event_stage_id)`
- `lodging_presence_logs(participant_id, unit_id, event_id, recorded_by, device_id, recorded_at)` — modo lua.
- `lodging_audit_logs(action, success, error_code, error_message, metadata, …)` — trilha completa.
- `lodging_incidents` — incidentes operacionais.

### 1.3 RPCs operacionais
- `pwa_lodging_checkin(p_device_id, p_token, p_location_id, p_unit_id, p_mode)`
- `pwa_lodging_checkout(p_device_id, p_token, p_location_id)`
- `pwa_lodging_register_presence(p_device_id, p_token, p_unit_id, p_mode)`
- Todas com `SECURITY DEFINER` + verificação de `check_user_stage_access(stage_id)`.
- Validações ativas no check-in: gênero (`unit.gender_restriction` × `people.gender`), capacidade (`unit.capacity`), duplicidade (`status='checked_in'`), participante existente e ativo.

### 1.4 RLS
- `lodging_locations`/`lodging_units`/`lodging_occupancies`: políticas estritas para `admin`/`secretaria` (write), `coordenacao_tecnica`/`alojamento` (read), e `Stage restricted access` (FOR ALL com `check_user_stage_access`).
- `lodging_audit_logs` com `is_offline` e `device_info` para trilha completa.

---

## 2. Lacunas e Riscos Identificados

### 2.1 Críticos — afetam operação de campo

1. **Alocação em Lote (`AlocacaoLotePage`) é uma rota fantasma.** O arquivo
   `src/pages/admin/alojamento/AlocacaoLotePage.tsx` está implementado e
   citado em `docs/04-modulos-operacionais.md` como "Pronto — 100%", mas
   não há `<Route>` em `src/routes/AppRoutes.tsx`. Coordenação não
   consegue acessar o wizard pela URL nem por menu.

2. **Divergências (`AlojamentoDivergenciasPage`) também órfã.** Mesma
   situação — implementada, declarada conforme na auditoria anterior,
   mas inacessível ao operador. A coluna "alocado × real" só aparece
   inline na ocupação, sem a consolidação prometida.

3. **Hub de Alojamento não tem entrada para Divergências nem para
   Alocação em Lote.** Mesmo se as rotas fossem registradas, hoje não
   há card no `AlojamentoHubPage` que aponte para elas — operadores
   precisariam memorizar a URL.

### 2.2 Altos — afetam consistência cruzada com Alimentação

4. ~~**`pwa_lodging_checkin` ignora `participants.left_event_at`.**~~ ✅ **Resolvido (Etapa 1).** RPC bloqueia com `LEFT_EVENT` e grava o motivo em `lodging_audit_logs`.

5. **`pwa_lodging_checkin` ignora `participants.needs_lodging`.** Pessoas
   que declararam não precisar de alojamento na inscrição (visitantes,
   delegados sem hospedagem) podem ser hospedadas sem alerta.

6. ~~**Não há "saída antecipada" automática ao registrar `left_event_at`.**~~ ✅ **Resolvido (Etapa 1).** Trigger `trg_participant_left_event_lodging` faz auto-checkout em `checked_in` (com `checked_out_at = left_event_at`) e cancela `planned`, gerando trilha em `lodging_audit_logs` com `action='auto_checkout'`.

### 2.3 Médios — qualidade da informação

7. **`gender_restriction` é compatibilizado contra `people.gender`.**
   A validação assume que `people.gender` está sempre preenchido. Para
   pessoas eventuais (vouchers), o cadastro pode não ter gênero — o
   check-in do voucher de alojamento não passa por essa validação.

8. **Relatório de Divergências mistura "Check-in pendente" com
   "alocação × real".** Ao re-rotear a página, a coluna `Status` precisa
   distinguir os dois casos para que a coordenação saiba o que pedir
   ao operador (cobrar check-in vs explicar a divergência).

9. **Documentação desatualizada.** `docs/04-modulos-operacionais.md`
   declara "Alojamento (✅ Pronto — 100%)" e o auditório anterior
   declara "FECHADO PARA OPERAÇÃO". O re-audit aponta divergências.

### 2.4 Médios — débito técnico
10. **`participants.biological_sex` continua coexistindo com
    `people.gender`.** Auditoria anterior já sinalizou; até hoje não
    foi removido. RPCs usam `people.gender`, mas APIs antigas ainda
    leem o campo legado.

---

## 3. Proposta de Evolução

### Etapa 0 — Higiene de roteamento + atalhos no Hub (este PR)
Objetivo: fazer com que as duas telas órfãs voltem a ser acessíveis,
com mínimo risco de regressão. Não toca DB.

- Registrar `<Route path="alojamento/divergencias">` (escopo `etapa/`) e `<Route path="alojamento/alocacao-lote">`.
- Adicionar dois cards no `AlojamentoHubPage`: "Alocação em Lote" e "Divergências".
- Atualizar este documento de auditoria com diagnóstico realista.
- Atualizar `docs/04-modulos-operacionais.md` removendo afirmação enganosa de 100%.

### Etapa 1 — Cross-check com saída antecipada (Alimentação Etapa 2) ✅
- ✅ Migration `20260503181640_alojamento_etapa1_left_event.sql`:
  - `pwa_lodging_checkin` recebeu validação após o lookup de gênero:
    se `participants.left_event_at IS NOT NULL`, retorna
    `{ ok: false, error: 'LEFT_EVENT' }` com a data formatada e
    grava `lodging_audit_logs` com `error_code='LEFT_EVENT'`.
  - Trigger `trg_participant_left_event_lodging` (`AFTER UPDATE OF
    left_event_at ON participants`, condição `WHEN OLD IS DISTINCT
    FROM NEW`): quando `left_event_at` é registrado, executa
    auto-checkout dos `lodging_occupancies` em status `checked_in`
    (`checked_out_at` = `left_event_at`, `divergence_notes`
    apendado com motivo) e cancela linhas em status `planned`
    (preservando o histórico). Cada auto-checkout gera linha em
    `lodging_audit_logs` com `action='auto_checkout'` e
    `metadata.reason='left_event'`.
- ✅ `AlojamentoScanPage` mapeia `LEFT_EVENT` para a mensagem
  "Participante registrou saída antecipada do evento.".

### Etapa 2 — Validar `needs_lodging`
- Atualizar `pwa_lodging_checkin` para retornar erro `NEEDS_LODGING_FALSE`
  quando o participante não declarou necessidade de alojamento. Permitir
  override via flag opcional do operador (justificado em
  `divergence_notes`).
- Trilha em `lodging_audit_logs` com o novo `error_code`.

### Etapa 3 — Limpar `participants.biological_sex`
- Migration de `DROP COLUMN` (após confirmação de que nenhum read
  ainda usa o campo legado).
- Audit de qualquer caller restante.

### Etapa 4 — Refinar Divergências
- Coluna `Tipo de Divergência` separando "alocado × real" de
  "check-in pendente" e "saída sem checkout".
- Filtros por etapa, local, delegação.
- Exportação consistente com a Alimentação Etapa 4.

### Etapa 5 — Visão por delegação
- `/pwa/delegacao/alojamento` (espelho da Etapa 5 de Alimentação) com
  RLS escopada por `delegation_id`.

---

## 4. Permissões por Perfil (alvo)

| Ação | admin | secretaria | coord_tecnica | alojamento | delegacao | publico |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| CRUD de locais/unidades | ✅ | ✅ | 👁 | 👁 | ❌ | ❌ |
| Operar check-in/out (PWA) | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Ver dashboards/divergências/alocação em lote | ✅ | ✅ | ✅ | 👁 | 👁 (própria, futuro) | ❌ |

---

## 5. Critérios de Pronto desta Etapa 0
- ✅ Diagnóstico realista do estado atual com tabela telas × rota registrada.
- ✅ Re-rotear `AlojamentoDivergenciasPage` e `AlocacaoLotePage` com guards de role corretos.
- ✅ Adicionar cards no `AlojamentoHubPage`.
- ✅ Atualizar `README.md`, `docs/04-modulos-operacionais.md` e este documento.

## 6. Roteiro de Teste Operacional (Etapa 0)

1. Login como `admin`, ir até `/admin/etapa/<id>/alojamento` → conferir os dois novos cards "Alocação em Lote" e "Divergências".
2. Clicar em "Divergências" → carrega a página `AlojamentoDivergenciasPage` com a lista de ocupações.
3. Filtrar por "Divergência de Unidade" e "Check-in Pendente" → resultados mudam.
4. Voltar ao Hub e clicar em "Alocação em Lote" → wizard abre na etapa 1 (seleção de delegação).
5. Login como `alojamento` → rota `/admin/etapa/<id>/alojamento/divergencias` deve estar acessível (somente leitura), `/alocacao-lote` é admin/secretaria.

---

## Histórico de Auditorias (preservado)

### 2026-04-28 (Fechamento original)
Veredito anterior: ✅ FECHADO PARA OPERAÇÃO. Inventário do código foi
ok no papel, mas o registro de rotas não foi conferido — daí o
re-audit acima.

### 2026-04-28 (Fase 3, Fase 2, Fase 1, Manhã)
Histórico das fases originais. Mantido para referência.
