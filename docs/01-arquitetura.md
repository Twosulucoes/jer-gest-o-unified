# 01 — Arquitetura

## Diagrama de Camadas

```
┌─────────────────────────────────────┐
│          Frontend (Lovable)         │
│  React 18 + Vite + Tailwind + TS   │
│  shadcn/ui + react-query           │
├─────────────────────────────────────┤
│       Supabase Client SDK          │
├──────────┬──────────┬───────────────┤
│  Auth    │ Postgres │   Storage    │
│  (JWT)   │  + RLS   │  (Buckets)  │
├──────────┴──────────┴───────────────┤
│         Edge Functions (Deno)       │
│  import-inscricoes  │  validate-qr │
│  public-events      │  public-results│
└─────────────────────────────────────┘
```

## Frontend

- **Framework**: React 18 + Vite 5 + TypeScript 5
- **UI**: Tailwind CSS v3 + shadcn/ui (Radix primitives)
- **State/Fetch**: @tanstack/react-query (cache, retry, invalidation)
- **Routing**: react-router-dom v6 com `BrowserRouter`
- **Auth**: Context via `useAuth` + guard `ProtectedRoute` com RBAC
- **QR Code**: biblioteca `qrcode` (geração client-side Canvas)

## Backend

- **Database**: PostgreSQL (Supabase managed)
- **Auth**: Supabase Auth (email/password)
- **Storage**: 2 buckets (credential-templates, match-attachments)
- **Edge Functions**: 4 funções Deno (import-inscricoes, validate-qr, public-events, public-results)
- **RPCs principais**:
  - `import_inscricoes_batch` — importação em massa (SECURITY DEFINER)
  - `rpc_get_sport_event_rules` — consulta de regras por prova
  - `rpc_upsert_sport_event_rules` — persistência de regras
  - `rpc_seed_sport_event_rules_for_event` — seed automático em massa
- **Segurança**: RLS em 100% das tabelas + 13 triggers de validação

## Módulos de Configuração

### Motor de Regras por Prova
```
src/types/sportEventRules.ts       → tipos TypeScript (Family, Format, Rules)
src/config/sportPresetCatalog.ts   → presets por modalidade (FUTSAL, BASQUETE...)
src/hooks/useSportEventRules.ts    → hook de query/mutation
src/components/admin/competition/  → RulesForm, RulesPresetPicker, RulesJsonEditor
src/pages/admin/RegrasProvaPage.tsx     → editor individual
src/pages/admin/RegrasLotePage.tsx      → seed e revisão em lote
```

### Identidade Visual e Componentes de Relatório
```
src/hooks/useEventBranding.ts                   → hook react-query (cache de branding por evento)
src/components/relatorios/ReportHeader.tsx      → cabeçalho com logos + título oficial
src/components/relatorios/ReportFooter.tsx      → rodapé institucional + paginação + data/hora
src/components/relatorios/ReportShell.tsx       → wrapper padrão (header + conteúdo + footer)
src/pages/admin/IdentidadeVisualPage.tsx        → editor /admin/configuracoes/identidade-visual
src/pages/admin/RelatoriosHubPage.tsx           → hub /admin/relatorios (cards "Em breve")
```

- **Tabela**: `event_branding` (1:1 com `events`) — até 3 logos como JSONB ordenado, textos institucionais e dados de assinatura.
- **Bucket**: `report-assets` (público) — armazena os arquivos de logo. Upload restrito a admin via RLS em `storage.objects`.

## Decisões Arquiteturais

1. **Client-side only** — sem servidor Node/Python; toda lógica server-side via Supabase
2. **RLS como barreira primária** — mesmo que o frontend falhe, o banco protege
3. **Roles em tabela separada** — `user_roles` nunca em `profiles` (previne privilege escalation)
4. **Utilitários centralizados** — `credentialUtils.ts` evita divergência de formatos
5. **Triggers de integridade** — validação de event_id cruzado em todas as entidades
6. **Motor de regras JSONB** — flexibilidade para campos extras por modalidade sem alterar schema
7. **Presets como catálogo frontend** — fácil de expandir sem migração de banco
8. **Seed heurístico** — detecta modalidade por nome para configuração automática em massa
