# Plano — Navegação por Etapas + Voltar Inteligente

> Objetivo: usuário alterna etapas e navega entre módulos sem voltar para `/admin`. Botão "Voltar" (incluindo gesto/back do celular) sempre retorna para a última tela real do fluxo, com fallback para a Home do módulo.

---

## Diagnóstico atual

- ✅ Existe `StageLayout` + drill-down `/admin/etapas/:stageId/...`.
- ✅ Existe `ModuleHeader` (com link "Ver no Mapa") e `EventProvider` global.
- ❌ Não existe: histórico por módulo, BackButton inteligente, interceptação de `popstate`, contexto persistente de etapa.
- ❌ ~80 telas usam `useNavigate(-1)` ou links fixos para `/admin`, fazendo o usuário cair fora do contexto.

---

## FASE A — Fundação (sem mexer em telas)

1. `src/contexts/StageContext.tsx` — etapa ativa persistida em localStorage (`jer_active_stage_id`).
2. `src/hooks/useNavigationHistory.ts` — pilha por módulo (chave = primeiro segmento após `/admin`), até 20 entradas em `sessionStorage`.
3. `src/components/navigation/BackButton.tsx`:
   - Histórico válido → `navigate(-1)` dentro do mesmo módulo
   - Sem histórico → Home do módulo (`/admin/{modulo}`)
   - Já está na Home do módulo → `/admin`
4. Listener global `popstate` no `AdminLayout` para o gesto/back do celular seguir a mesma regra.

**Risco:** baixo. Nenhuma tela quebra.

## FASE B — Padronizar `ModuleHeader`

1. `<BackButton />` à esquerda + breadcrumb opcional (Módulo › Etapa › Tela).
2. `EtapaSwitcher` integrado quando dentro de `/admin/etapas/:stageId/...` (troca de etapa sem sair do módulo).
3. Versão mobile: ícone voltar + título truncado + kebab.

**Telas afetadas:** ~30 (mudança automática via componente).

## FASE C — Aplicar nas telas que ainda não usam `ModuleHeader`

- Auditoria de Competição e Logística.
- Trocar headers manuais por `ModuleHeader` + `BackButton`.
- Garantir que links internos preservem `stageId` no path.

**Prioritárias:** `/admin/etapas/:stageId/*`, `/admin/competicao/*`, `/admin/delegacoes/:id`, `/admin/participantes/:id`.

## FASE D — Estados, permissões, doc

- Skeletons + empty states acionáveis + error boundary local.
- Visibilidade por perfil em `BackButton`/`EtapaSwitcher` (via `accessControl.ts`).
- Auditoria opcional: registrar troca de etapa em `audit_events`.
- Atualizar README e docs internos.

---

## Decisões a confirmar antes da Fase A

| # | Decisão | Recomendação |
|---|---------|--------------|
| 1 | Fallback do Voltar sem histórico | Home do módulo atual |
| 2 | Gesto/back do celular | Interceptar `popstate` |
| 3 | Persistência do histórico | `sessionStorage` |
| 4 | Etapa ativa | `localStorage` |
| 5 | Onde começar | Fase A + B juntas |

## Estimativa

| Fase | Tempo | Risco |
|------|-------|-------|
| A | 30 min | Baixo |
| B | 30 min | Baixo |
| C | 1-2h | Médio |
| D | 1h | Baixo |

**Próxima ação proposta:** aprovar Fase A + B numa rodada única.
