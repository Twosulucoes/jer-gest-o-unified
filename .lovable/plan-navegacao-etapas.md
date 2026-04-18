# Plano: Reestruturação de Navegação, Permissões e Modelo Institucional

> **Status:** aguardando aprovação para iniciar pela Fase 0+1.
> **Última atualização:** 2026-04-17
> **Origem:** pedido do cliente para unificar Instituição/Delegação, adicionar drill-down por etapa, e simplificar menu.

## Contexto e diagnóstico

### Estado atual do banco (verificado via SQL nesta sessão)
- **13 instituições ↔ 13 delegações** com cardinalidade efetiva **1:1** no evento ativo.
- Nenhuma instituição é reusada entre eventos (`delegacoes_com_instituicao_compartilhada = 0`) → **fusão é segura**.
- **16 etapas** já cadastradas em `event_stages`.
- `event_stage_id` já existe (nullable) em: `lodging_locations`, `lodging_units`, `lodging_occupancies`, `meal_types`, `meal_windows`, `transport_routes`, `transport_trips`, `transport_vehicles`, `import_logs`, `import_pendencias`, `participant_sport_events`, `pesquisa_events`.
- `event_stage_id` é **NOT NULL** apenas em `participant_event_stages` (tabela ponte que materializa a inscrição por etapa).
- `participants` NÃO tem `event_stage_id` direto — vínculo via `participant_event_stages`.

### Dores reportadas
1. Menu confuso, com Instituição e Delegação separadas significando a mesma coisa.
2. Falta de filtro de etapa em Participantes.
3. Falta de drill-down: o operador quer entrar na etapa e ver tudo daquela etapa.
4. Build atual quebrado por `event_stage_id` referenciado em código mas tipo `Database` desatualizado.

### Decisões já tomadas pelo cliente
- **Instituição × Delegação:** fundir tabelas no banco.
- **Etapa:** navegação por drill-down (`/admin/etapas/:stageId/...`).
- **Escopo:** plano completo primeiro, execução em fases.

---

## FASE 0 — Estabilizar build (URGENTE)

Sem isso, nada deploya.

1. **`supabase/functions/import-inscricoes/index.ts:1580`** — guard correto para `cpf_valid: string | null` (usar `if (row.cpf_valid !== null)` antes do cast).
2. **`AlimentacaoHubPage.tsx`, `AlojamentoHubPage.tsx`, `TransporteHubPage.tsx`** — `types.ts` desatualizado vs. banco. Mitigação imediata: cast local `as any` nas queries que usam `event_stage_id`.
3. Confirmar `bun run build` verde antes da Fase 1.

## FASE 1 — Renomeação visual (sem migration)

1. **AdminLayout** — remover "Instituições" do menu; renomear "Delegações" → "Delegações (Escolas)".
2. **DelegacoesPage** — exibir nome da escola como coluna principal; dialog unificado que cria `institution + delegation` em transação (RPC `create_delegation_with_school`).
3. **Doc:** atualizar `docs/menu-cliente-admin.md`.

## FASE 2 — Drill-down por Etapa

Novas rotas:
```
/admin/etapas
/admin/etapas/:stageId
/admin/etapas/:stageId/{participantes|delegacoes|competicao|credenciamento|alojamento|alimentacao|transporte}
```

Componentes novos: `StageContext`, `StageLayout`, `EtapaSwitcher` (abaixo do EventSwitcher).

Filtros automáticos por etapa:
- **Participantes:** `WHERE id IN (SELECT participant_id FROM participant_event_stages WHERE event_stage_id = :stageId)`.
- **Logística:** `.eq("event_stage_id", stageId)` direto.
- **Competição:** `participant_sport_events.event_stage_id` (nullable; backfill necessário).

Menu lateral reorganizado:
- **Topo:** Dashboard, **Etapas** (nova entrada principal).
- **Globais ao evento:** Eventos, Importação, Modalidades, Categorias, Locais, Configurações, Sistema.
- Itens operacionais movidos para dentro da etapa (drill-down).

## FASE 3 — Fusão `institutions` → `delegations` no banco

**Migration (a aprovar no momento da execução):**
```sql
ALTER TABLE delegations
  ADD COLUMN school_name text,
  ADD COLUMN school_cnpj text,
  ADD COLUMN school_address text,
  ADD COLUMN school_email text,
  ADD COLUMN school_phone text,
  ADD COLUMN school_uf text,
  ADD COLUMN school_municipality text;

UPDATE delegations d
SET school_name = i.name, school_cnpj = i.cnpj /* ... */
FROM institutions i WHERE d.institution_id = i.id;

ALTER TABLE delegations ALTER COLUMN school_name SET NOT NULL;
-- tratar people.institution_id (nullable) → migrar ou deprecar
-- após validação: DROP TABLE institutions; DROP COLUMN delegations.institution_id;
```

Refactor de **~26 arquivos** que fazem `delegations(institution_id, institutions(name))`. Atualizar Edge Function `import-inscricoes`.

## FASE 4 — Permissões e RLS revisitadas

Auditar policies que referenciam `institutions`. Garantir isolamento de etapa para perfis técnicos. Atualizar `docs/02-modelo-de-acesso-e-perfis.md`.

---

## Resumo de risco

| Fase | Risco | Reversível? | Tempo estimado |
|------|-------|-------------|----------------|
| 0 | Baixo | Sim | 10 min |
| 1 | Baixo | Sim | 30 min |
| 2 | Médio | Sim (rotas novas convivem com antigas) | 2-3h |
| 3 | **Alto** | Difícil (drop de tabela) | 1-2h + validação |
| 4 | Médio | Sim | 1h |

## Próxima ação proposta

Executar **Fase 0 + Fase 1** numa única rodada (~40 min, deploy imediato). Fases 2/3/4 cada uma com aprovação separada.
