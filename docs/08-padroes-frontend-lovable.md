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
│   │   └── competition/  # componentes de competição (RulesForm, BracketView, etc.)
│   └── *.tsx        # componentes globais (AdminLayout, ProtectedRoute, NavLink)
├── config/          # catálogos e configurações (sportPresetCatalog, systemMap)
├── contexts/        # contextos React (EventContext)
├── hooks/           # hooks customizados (useAuth, useSportEventRules, use-mobile)
├── integrations/
│   └── supabase/    # client.ts (auto-generated) + types.ts (read-only)
├── lib/             # utilitários (credentialUtils, individualRanking, utils)
├── pages/
│   ├── admin/       # páginas do painel administrativo
│   └── *.tsx        # páginas raiz (Index, Login, NotFound)
├── types/           # tipos TypeScript (sportEventRules.ts)
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
- Tipos: `nomeTypes.ts` (ex: `sportEventRules.ts`)
- Catálogos/Config: `nomeCatalog.ts` (ex: `sportPresetCatalog.ts`)

### 6. Hooks Customizados (Padrão)
```tsx
// Hook com query + mutation (padrão usado em useSportEventRules)
export function useNome(id: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["nome", id],
    queryFn: async () => { /* ... */ },
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: async (payload) => { /* ... */ },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nome", id] });
      toast.success("Salvo com sucesso");
    },
  });

  return { data: query.data, isLoading: query.isLoading, save: mutation.mutate };
}
```
