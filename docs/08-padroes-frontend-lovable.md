# 08 — Padrões Frontend / Lovable

## Stack

- React 18 + Vite 5 + TypeScript 5
- Tailwind CSS v3 + shadcn/ui (Radix)
- @tanstack/react-query v5
- react-router-dom v6

## Estrutura de Diretórios

```
src/
├── components/
│   ├── ui/          # shadcn/ui components (não editar manualmente)
│   ├── admin/       # componentes de páginas admin (dialogs, cards, forms)
│   └── *.tsx        # componentes globais (AdminLayout, ProtectedRoute, NavLink)
├── hooks/           # hooks customizados (useAuth, useCredentialLookup, use-mobile)
├── integrations/
│   └── supabase/    # client.ts (auto-generated) + types.ts (read-only)
├── lib/             # utilitários (credentialUtils, individualRanking, utils)
├── pages/
│   ├── admin/       # páginas do painel administrativo
│   └── *.tsx        # páginas raiz (Index, Login, NotFound)
└── index.css        # design tokens (CSS variables)
```

## Padrões Obrigatórios

### 1. Tokens Semânticos
```tsx
// ✅ Correto
className="bg-primary text-primary-foreground"
className="text-muted-foreground"

// ❌ Errado
className="bg-blue-500 text-white"
className="text-gray-500"
```

### 2. Data Fetching
```tsx
// Sempre via react-query
const { data, isLoading } = useQuery({
  queryKey: ['events'],
  queryFn: async () => {
    const { data, error } = await supabase.from('events').select('*');
    if (error) throw error;
    return data;
  }
});
```

### 3. Rotas Protegidas
```tsx
<Route path="modulo" element={
  <ProtectedRoute allowedRoles={["admin", "secretaria"]}>
    <PaginaDoModulo />
  </ProtectedRoute>
} />
```

### 4. Componentes
- Preferir shadcn/ui com variantes sobre componentes custom
- Extrair componentes focados (um por responsabilidade)
- Dialogs de formulário como componentes separados (`*FormDialog.tsx`)
- Confirmação de ações críticas via `AlertDialog`

### 5. Nomenclatura
- Páginas: `NomePage.tsx` (ex: `CredenciamentoPage.tsx`)
- Componentes de dialog: `NomeFormDialog.tsx`
- Hooks: `useNome.ts`
- Utilitários: `nomeUtil.ts`
