# 09 — Padrões Backend / Supabase

## Princípios

1. **RLS obrigatório** — toda tabela nova deve ter RLS habilitado + policies
2. **Roles via `has_role()`** — nunca verificar roles diretamente na policy
3. **SECURITY DEFINER** para funções que bypassam RLS (ex: importação batch)
4. **Triggers de integridade** — validar event_id cruzado entre entidades relacionadas
5. **`updated_at` automático** — trigger em toda tabela

## Checklist para Nova Tabela

```sql
-- 1. Criar tabela
CREATE TABLE public.nova_tabela (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  -- ... colunas ...
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE public.nova_tabela ENABLE ROW LEVEL SECURITY;

-- 3. Trigger de updated_at
CREATE TRIGGER update_nova_tabela_updated_at
  BEFORE UPDATE ON public.nova_tabela
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Policies por perfil
CREATE POLICY "Admin full access" ON public.nova_tabela
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- (repetir para cada perfil aplicável)
```

## Edge Functions

| Função | Arquivo | Descrição |
|--------|---------|-----------|
| `import-inscricoes` | `supabase/functions/import-inscricoes/index.ts` | Pré-processa planilha e chama RPC |
| `validate-qr` | `supabase/functions/validate-qr/index.ts` | Valida QR Code e registra scan |

### Padrão de Edge Function
- CORS headers obrigatórios
- Autenticação via Bearer token
- Service client para operações privilegiadas
- Resposta JSON padronizada

## Migrations

- Diretório: `supabase/migrations/`
- **Read-only** no Lovable (geradas via ferramenta de migration)
- Nunca editar manualmente `src/integrations/supabase/types.ts`

## Secrets

| Secret | Uso |
|--------|-----|
| `SUPABASE_URL` | URL do projeto |
| `SUPABASE_ANON_KEY` | Chave pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave privilegiada (edge functions) |
