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
- **Edge Functions**: 2 funções Deno (import-inscricoes, validate-qr)
- **RPC**: `import_inscricoes_batch` (SECURITY DEFINER)
- **Segurança**: RLS em 100% das tabelas + 13 triggers de validação

## Decisões Arquiteturais

1. **Client-side only** — sem servidor Node/Python; toda lógica server-side via Supabase
2. **RLS como barreira primária** — mesmo que o frontend falhe, o banco protege
3. **Roles em tabela separada** — `user_roles` nunca em `profiles` (previne privilege escalation)
4. **Utilitários centralizados** — `credentialUtils.ts` evita divergência de formatos
5. **Triggers de integridade** — validação de event_id cruzado em todas as entidades
