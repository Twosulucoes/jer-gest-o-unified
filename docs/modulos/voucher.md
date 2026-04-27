# Módulo de Voucher — Auditoria de Estado Atual

> **Tipo:** Relatório de diagnóstico (não é especificação nem manual operacional).
> **Data da auditoria:** 2026-04-27.
> **Escopo:** somente análise do código atualmente versionado. Nenhuma alteração funcional foi feita nesta etapa.

---

## 1. Contexto de negócio assumido

O voucher do JER Gestão deve ser instrumento **paralelo ao crachá**, destinado **exclusivamente a pessoas eventuais sem credencial oficial** (prestadores pontuais, acompanhantes). Participantes oficiais (atletas, técnicos, delegação, organização) consomem serviços **com o QR do próprio crachá** e não usam voucher.

Requisitos de negócio considerados como referência:

1. Cada voucher deve estar amarrado a **um serviço específico** (uma refeição em uma data, um trecho de transporte, uma diária de alojamento).
2. A validação deve ser feita por **leitura de QR**, igual à credencial.
3. Apenas perfis **`admin` e `secretaria`** podem criar lote, emitir individual, reemitir ou cancelar.
4. Toda operação deve gerar **trilha de auditoria** (responsável, data/hora, tipo, detalhes).

---

## 2. Plano da auditoria executado

1. Levantamento de arquivos (`grep voucher` em `src/`, `supabase/`, `docs/`, `README.md`).
2. Mapeamento de tabelas, RPCs, RLS e triggers no banco (`information_schema`, `pg_proc`, `pg_policy`, `pg_trigger`).
3. Leitura integral de `VouchersPage.tsx`, `VoucherValidarPage.tsx`, `ParticipantVoucherTab.tsx`, `voucherScan.ts`, `voucherMessages.ts`, `voucherExport.ts`.
4. Verificação da integração nos PWAs operacionais (`alimentacao`, `alojamento`, `transporte`).
5. Conferência das rotas e proteção por perfil em `App.tsx` e `AdminLayout.tsx`.
6. Conferência de documentação existente (`README.md`, `docs/`).

---

## 3. Inventário do que existe hoje

### 3.1 Páginas e rotas

| Rota | Arquivo | Finalidade | Perfis liberados (ProtectedRoute) |
|---|---|---|---|
| `/admin/vouchers` | `src/pages/admin/VouchersPage.tsx` | Listagem, emissão individual (wizard 4 passos), emissão em lote por delegação, impressão de QR, histórico de uso, revogação, exportação CSV/PDF. | `admin`, `secretaria` |
| `/admin/voucher/validar` | `src/pages/admin/VoucherValidarPage.tsx` | Validar manualmente um voucher (escanear QR + escolher serviço meals/transport/lodging). | `admin`, `secretaria`, `coordenacao_tecnica`, `transporte`, `alimentacao`, `alojamento` |
| Aba dentro de `/admin/participantes/:id` | `src/components/admin/participant/ParticipantVoucherTab.tsx` (em `ParticipanteDetalhePage.tsx`) | Emitir/listar/revogar voucher **nominal** vinculado a um participante específico. | Renderiza para `admin`, `secretaria`, `super_admin` (checagem `hasRole` interna). |

Observações:
- O menu do AdminLayout exibe apenas o item **"Vouchers (Validar)"** apontando para `/admin/vouchers` (com ícone `BadgeCheck`). O `label` está incorreto: a rota é a tela de **gestão**, não de validação.
- Não há link de menu para `/admin/voucher/validar`. A tela existe mas só é alcançável digitando a URL.

### 3.2 Bibliotecas de apoio

| Arquivo | Função |
|---|---|
| `src/lib/voucherScan.ts` | `isVoucherQr(rawValue)` (detecta prefixo `voucher:`) e `tryRedeemVoucher(rawValue, kind, contextId)` que chama RPC `redeem_voucher`. |
| `src/lib/voucherMessages.ts` | Dicionário pt-BR/en para mensagens de erro/sucesso de redemption. |
| `src/lib/voucherExport.ts` | Exportação CSV e PDF da listagem de vouchers. |

### 3.3 Modelo de dados (Postgres / Supabase)

**`public.service_vouchers`**

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `event_id` | uuid NOT NULL | escopo do evento |
| `participant_id` | uuid NULL | obrigatório só em vouchers `nominal` |
| `qr_code_value` | text NOT NULL | gerado no front (`voucher:<base36>-<rand20>`) |
| `scope_transport` / `scope_meals` / `scope_lodging` | bool NOT NULL | 1 voucher pode cobrir vários escopos |
| `valid_from` | tstz NOT NULL DEFAULT now() | |
| `valid_until` | tstz NULL | sem prazo se nulo |
| `max_uses` | int NULL | ilimitado se nulo |
| `current_uses` | int NOT NULL DEFAULT 0 | |
| `status` | text DEFAULT 'active' | `active`/`revoked`/`expired`/`exhausted` |
| `notes`, `revoke_reason`, `revoked_by`, `revoked_at`, `issued_by` | metadados | |
| `created_at`, `updated_at` | tstz | trigger `trg_service_vouchers_touch` |

**Colunas inferidas pelo código mas não retornadas pelo `information_schema` na consulta padrão** (provavelmente adicionadas em migração posterior — confirmar diretamente no banco antes de evoluir):
- `voucher_type` (`'nominal' | 'aggregate'`)
- `label` (text) — usado em vouchers agregados
- `is_contingency` (bool)

> ⚠️ Discrepância: a UI já trata `voucher_type`/`label`/`is_contingency`, mas o snapshot `information_schema` consultado nesta auditoria não retornou essas colunas. Pode ser cache do snapshot ou migração mais recente. **Necessário validar antes de qualquer evolução.**

**`public.service_voucher_uses`** (registro de consumo)

| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `voucher_id` | uuid NOT NULL |
| `service_kind` | text NOT NULL (`transport`/`meals`/`lodging`) |
| `context_id` | uuid NULL (id da janela de refeição, viagem, dormitório, etc.) |
| `used_at` | tstz NOT NULL DEFAULT now() |
| `used_by` | uuid NULL (operador que validou) |
| `notes` | text NULL |

### 3.4 Funções e triggers

- **RPC `public.redeem_voucher(p_qr_value, p_service_kind, p_context_id)`**
  - `SECURITY DEFINER`.
  - Bloqueia chamadores que não tenham um dos perfis: serviço-específico (`transporte`/`alimentacao`/`alojamento`) ou `admin`/`secretaria`.
  - Faz `SELECT ... FOR UPDATE` no voucher.
  - Verifica `status='active'`, `valid_until`, `valid_from`, escopo do serviço, `max_uses`.
  - Insere em `service_voucher_uses`, incrementa `current_uses`.
  - Retorna `{ok, reason?, participant_id?, person_name?, remaining_uses?}`.
  - **Não retorna** `voucher_type`/`label`/`is_contingency` que a UI consome — a UI lê esses campos diretamente da row em outros pontos, mas no fluxo PWA o tipo é tratado como se viesse do retorno (ver `voucherSuccessMessage`).
- **Trigger `trg_audit_vouchers`** em `service_vouchers` chamando `audit_people_voucher_changes()` → grava em `public.audit_events` (`table_name`, `record_id`, `action`, `payload`, `created_by`).
- **Trigger `trg_service_vouchers_touch`** atualiza `updated_at`.
- **Não há trigger de auditoria** em `service_voucher_uses` — o consumo é registrado pela própria RPC, mas mudanças manuais (que não deveriam ocorrer) não seriam capturadas.

### 3.5 RLS

| Tabela | Política | Comando | Quem |
|---|---|---|---|
| `service_vouchers` | `vouchers_read_admin_ops` | SELECT | `admin`, `secretaria`, `coordenacao_tecnica`, `super_admin`, `transporte`, `alimentacao`, `alojamento` |
| `service_vouchers` | `vouchers_write_admin` | ALL | `admin`, `secretaria`, `super_admin` |
| `service_voucher_uses` | `voucher_uses_read` | SELECT | mesma lista de leitura |
| `service_voucher_uses` | (sem política de WRITE) | — | inserção ocorre via RPC `SECURITY DEFINER` |

> O `super_admin` aparece como escritor — é uma exceção esperada do sistema, mas a regra de negócio descrita pelo usuário cita apenas `admin` e `secretaria`.

### 3.6 Integração nos PWAs operacionais

- `pwa/alimentacao/AlimentacaoScanPage.tsx`: detecta voucher por prefixo, chama `tryRedeemVoucher(rawValue, "meals", windowId)`. Trata sucesso/erro com `voucherMessages`. Registra `method: "voucher"` na trilha local.
- `pwa/alojamento/AlojamentoScanPage.tsx`: idem, com `serviceKind = "lodging"` e `contextId = facilityId`.
- `pwa/transporte/TransporteEmbarquePage.tsx`: idem, com `"transport"` e `tripId`.
- `pwa/transporte/TransporteScanPage.tsx`: rótulo "Credencial ou voucher" — sem chamada explícita, apenas indica suporte.

### 3.7 Documentação existente

- `README.md` linha 9: parágrafo curto sobre "Pessoas Unificadas + Vouchers QR" descrevendo voucher como **multiuso para quem não tem credencial**.
- `docs/`: **não há arquivo dedicado** ao módulo voucher. Não há manual operacional, nem documento de regras, nem fluxograma.
- `mem://features/pessoas-unificadas-vouchers` é referenciado no índice de memória mas o arquivo não está presente em `.lovable/memory/features/`.

---

## 4. Diagnóstico por frente exigida

### 4.1 Cadastro de pessoas eventuais

- **Não existe cadastro próprio para "pessoa eventual"**. Todo voucher nominal exige um `participant_id` já existente (pesquisado em `participants` + `people`).
- Não há campos como "tipo de envolvimento" (prestador/acompanhante/voluntário), "instituição", "responsável pela autorização", "documento apresentado".
- O voucher do tipo `aggregate` (sem nome) compensa parcialmente, mas não há identificação da pessoa que efetivamente porta o QR.

### 4.2 Criação de lotes

- Existe **um único caminho de lote**: "Lote por Delegação" (`BulkIssueByDelegationDialog`) que emite vouchers **nominais de contingência** para participantes **já credenciáveis**, o oposto do propósito declarado de voucher (pessoas sem credencial).
- O wizard de emissão individual permite "lote agregado" (N vouchers anônimos com sufixo `#01`, `#02`).
- **Não há criação de lote vinculado a um serviço específico** (ex.: "100 vouchers para o almoço de 12/06 no refeitório X"). Um voucher hoje vale para qualquer instância do escopo até esgotar `max_uses` ou expirar.
- Parâmetros do lote são genéricos: escopos (transporte/alimentação/alojamento como booleanos), `max_uses`, `valid_until`. Não há campo `meal_window_id`, `trip_id`, `facility_id` no voucher.

### 4.3 Emissão e impressão

- QR único gerado no front (`genQrValue`) com prefixo `voucher:` — funcional.
- Existe `PrintVoucherDialog` que abre uma janela de impressão por voucher.
- **Não há impressão em lote** (PDF compilado de todos os vouchers de um lote para imprimir de uma vez).
- Layout impresso: contém QR, label/nome, escopos, validade. **Não traz** o serviço específico (porque não existe vínculo) nem instruções para o portador.

### 4.4 Validação no consumo

- Leitura de QR funciona nos 3 PWAs operacionais e na tela administrativa `/admin/voucher/validar`.
- A RPC valida: existência, status, validade temporal, escopo do serviço, `max_uses`.
- **Não valida serviço específico** — qualquer voucher com `scope_meals = true` libera qualquer refeição; `scope_transport = true` libera qualquer trecho.
- **Bloqueio de duplo consumo**: não há restrição de unicidade `(voucher_id, service_kind, context_id)` em `service_voucher_uses`. Um operador pode escanear o mesmo voucher duas vezes na mesma janela e cada redemption será aceito até `max_uses` esgotar. A regra `meal_consumptions_unique` que existe para credenciais oficiais **não tem equivalente para vouchers**.
- Bloqueio de voucher revogado/expirado: ✅ tratado pela RPC.
- Registro de consumo: grava `voucher_id`, `service_kind`, `context_id`, `used_at`, `used_by`. **Não grava** `event_id` denormalizado nem local físico além do `context_id`.

### 4.5 Reemissão e cancelamento

- **Cancelamento (revogação)** ✅: dialog em `VouchersPage` exige motivo, atualiza `status`, `revoked_at`, `revoked_by`, `revoke_reason`. Trigger de auditoria registra a mudança em `audit_events`.
- **Reemissão por extravio**: ❌ **não existe fluxo dedicado**. O caminho seria revogar manualmente e emitir um novo, mas sem amarração entre os dois (sem `replaces_voucher_id`/`replaced_by`). Histórico de "esse voucher é a reemissão daquele" se perde.
- **Reimpressão** (mesmo voucher, novo papel): existe via botão "QR" na listagem.

### 4.6 Permissões por perfil

| Operação | Esperado pelo negócio | Estado atual |
|---|---|---|
| Listar vouchers (`/admin/vouchers`) | admin, secretaria | ✅ ProtectedRoute restringe a `admin`, `secretaria` |
| Criar/emitir/revogar | admin, secretaria | ✅ no front; ✅ RLS `vouchers_write_admin` (também permite `super_admin`) |
| Validar consumo (PWA) | qualquer perfil de serviço | ✅ RPC valida perfil por tipo de serviço |
| Validar manualmente (`/admin/voucher/validar`) | admin, secretaria | ⚠️ ProtectedRoute hoje libera também `coordenacao_tecnica`, `transporte`, `alimentacao`, `alojamento` (tela existe mas não está no menu) |
| Aba `ParticipantVoucherTab` | admin, secretaria | ✅ checagem `hasRole` permite `admin`, `secretaria`, `super_admin` |

### 4.7 Trilha de auditoria

- Mudanças em `service_vouchers` (INSERT/UPDATE/DELETE) → `audit_events` via trigger ✅.
- Consumo de voucher: registrado em `service_voucher_uses` (gravado pela RPC `SECURITY DEFINER`, com `used_by = auth.uid()`). Não passa pelo trigger de `audit_events`, mas a tabela de consumo é a própria trilha.
- **Não há tela de consulta consolidada de auditoria de voucher**. O usuário precisa abrir o histórico voucher por voucher (`UsageHistoryDialog`). Não há filtro por operador, por delegação, por intervalo de data.
- Lote criado em massa não fica marcado como "mesmo lote" — cada voucher tem seu `created_at`, mas não há `batch_id` ou `batch_label` compartilhado.

### 4.8 Estados de interface

- Loading: `Loader2` em todas as queries pesadas ✅.
- Vazio: cards de "Nenhum voucher encontrado" ✅.
- Erro: tratado via `toast.error` ✅.
- Sucesso: `toast.success` + dialog de impressão ✅.
- Skeleton: usado em `ParticipantVoucherTab` ✅.

### 4.9 Consistência com o restante do sistema

- Visual segue o design system (Cards, Badges, semantic tokens) ✅.
- QR é instrumento único de validação ✅ (prefixo `voucher:` distingue de credenciais).
- ❌ **Inconsistência conceitual:** README descreve voucher como "multiuso para quem não tem credencial" e o código implementa exatamente isso, **mas o contexto de negócio reformulado pelo cliente** (esta auditoria) define voucher como **vinculado a serviço específico e exclusivo de pessoas eventuais**. Há divergência estrutural entre o que está no banco/código e o que se quer.
- ❌ "Lote por Delegação" emite vouchers de contingência para credenciados — fluxo conflita diretamente com a regra "credenciados não usam voucher".
- ❌ A aba `ParticipantVoucherTab` na ficha de participante reforça a ideia de voucher para credenciados.

---

## 5. Lacunas e Inconsistências (priorizadas)

### 🔴 Alto impacto — quebra de regra de negócio

1. **Voucher não vincula serviço específico**. Hoje é direito genérico de consumo dentro de escopos. Impacto: impossível controlar "este voucher era só para o almoço do dia 12"; risco de uso indevido em outras janelas/viagens; relatório de previsão vs realizado por serviço fica impossível.
2. **Sem cadastro de pessoa eventual**. Voucher nominal exige `participant_id` (credenciado). Não há onde registrar acompanhante/prestador. Impacto: nenhum rastreio de quem efetivamente recebeu/usou o voucher; perda de auditoria humana.
3. **Sem proteção contra duplo consumo na mesma instância de serviço**. Falta unique `(voucher_id, service_kind, context_id)`. Impacto: mesmo voucher pode ser escaneado múltiplas vezes na mesma refeição se `max_uses > 1`.
4. **"Lote por Delegação" e aba `ParticipantVoucherTab` operam sobre credenciados**, contrariando a regra "credenciados não usam voucher". Impacto: confusão operacional, vouchers sendo emitidos para quem deveria usar crachá.

### 🟠 Médio impacto — auditoria e governança

5. **Sem fluxo de reemissão com link entre voucher antigo e novo**. Falta coluna `replaces_voucher_id`. Impacto: histórico fragmentado, dificulta investigação de extravio.
6. **Sem `batch_id` para agrupar lote**. Impacto: impossível listar/imprimir/revogar todos os vouchers de um mesmo lote.
7. **Tela `/admin/voucher/validar` não está no menu** e libera perfis indevidos no ProtectedRoute. Impacto baixo de exploit (RPC valida perfil), mas é incoerente.
8. **Item de menu "Vouchers (Validar)" aponta para `/admin/vouchers`** (página de gestão). Impacto: confusão de UX; perfil `alimentacao` aparece no `roles` do menu mas a rota destino bloqueia esse perfil → item quebrado para esse usuário.

### 🟡 Baixo impacto — UX/qualidade

9. **Sem impressão em lote** (apenas individual).
10. **Sem central única de auditoria** com filtros por operador/data/delegação. Hoje é histórico por voucher.
11. **Sem documentação dedicada** em `docs/`. Memória `mem://features/pessoas-unificadas-vouchers` referenciada no índice mas arquivo ausente.
12. **Discrepância de schema possível**: `voucher_type`, `label`, `is_contingency` consumidos pela UI, mas não retornados pelo `information_schema` no snapshot inspecionado — confirmar se foram aplicados em migrações posteriores que ainda não constam no espelho consultado.

---

## 6. Recomendações de próximos passos (não executados)

### A. Correções no que já existe

1. Corrigir o item de menu (`AdminLayout.tsx`): rótulo, rota e lista de `roles`. Decidir se `Vouchers` (gestão) e `Validar voucher` (operacional) são dois itens.
2. Reavaliar perfis de `/admin/voucher/validar` no `App.tsx` para alinhar à regra "validação no PWA, gestão no admin".
3. Confirmar (via `\d service_vouchers` em produção) presença de `voucher_type`, `label`, `is_contingency` e versionar a migração se faltar.
4. Adicionar índice/constraint `UNIQUE (voucher_id, service_kind, context_id) WHERE context_id IS NOT NULL` em `service_voucher_uses` para prevenir duplo consumo na mesma instância.

### B. Complementos de fluxo já iniciado

5. Adicionar coluna `replaces_voucher_id` em `service_vouchers` + botão "Reemitir" que revoga o original com motivo "reemissão" e cria o novo com link.
6. Adicionar `batch_id` (uuid) e `batch_label` (text) em `service_vouchers`; impressão em lote agrupada por `batch_id`; revogação em lote.
7. Tela administrativa de auditoria consolidada (`/admin/vouchers/auditoria`) com filtros por período, operador, delegação, serviço, status.

### C. Construção do que ainda não existe

8. Modelo `service_voucher_target` (ou colunas dedicadas) que amarre cada voucher a uma instância concreta de serviço:
   - `target_meal_window_id` (FK `meal_windows`)
   - `target_trip_id` (FK `transport_trips`)
   - `target_facility_id` + `target_date` (FK `lodging_facilities`)
   Validar na RPC `redeem_voucher` que `p_context_id = target_*_id`.
9. Cadastro de "pessoa eventual" — opções:
   - (a) Nova tabela `eventual_people (id, event_id, full_name, document, role_kind ENUM('prestador','acompanhante','outro'), authorized_by, notes)` referenciada por `service_vouchers.eventual_person_id`.
   - (b) Reaproveitar `people` com flag `is_eventual` + tabela enxuta de envolvimento eventual.
10. Tela "Emitir lote para serviço" com fluxo: escolher serviço (refeição X data, viagem Y, alojamento Z) → quantidade → opcionalmente lista nominal de eventuais → gerar PDF de impressão.
11. Aposentar (ou renomear como "Voucher de contingência para credenciado", deixando explícita a exceção) o "Lote por Delegação" e a aba `ParticipantVoucherTab`. Decisão depende da política do cliente.
12. Documento operacional em `docs/modulos/voucher.md` (manual do usuário do módulo) e atualização da memória `mem://features/pessoas-unificadas-vouchers`.

---

## 7. Perguntas em aberto para o cliente

1. **Vouchers nominais para credenciado existem como contingência (credencial perdida) ou devem ser eliminados completamente?** O código atual tem esse caminho explícito (`is_contingency = true`); a regra nova sugere remover.
2. **Voucher por serviço específico**: cada voucher cobre **uma única instância** (uma refeição, uma viagem) ou pode cobrir **um conjunto definido** (ex.: todas as refeições do dia 12)?
3. **Pessoa eventual precisa de CPF obrigatório** ou aceitamos cadastro mínimo (nome + tipo de envolvimento)?
4. **Reemissão por extravio** exige aprovação adicional (fluxo de 2 perfis) ou basta motivo registrado?
5. **Impressão em lote** deve gerar 1 PDF por página por voucher (formato carteira) ou múltiplos por página (formato adesivo/etiqueta)?

---

## 8. Critério de pronto desta auditoria

- [x] Inventário do existente.
- [x] Diagnóstico por frente.
- [x] Lacunas priorizadas com impacto.
- [x] Próximos passos agrupados (correção / complemento / construção).
- [x] Documento `docs/modulos/voucher-auditoria.md` criado.
- [x] Nota no `README.md` apontando para esta auditoria.
- [ ] Implementação — **não faz parte deste passo**.
