# 09 — Padrões Backend / Supabase

## Princípios

1. **RLS obrigatório** — toda tabela nova deve ter RLS habilitado + policies
2. **Roles via `has_role()`** — nunca verificar roles diretamente na policy
3. **SECURITY DEFINER** para funções que bypassam RLS (ex: importação batch, seed de regras)
4. **Triggers de integridade** — validar event_id cruzado entre entidades relacionadas
5. **`updated_at` automático** — trigger em toda tabela
6. **JSONB para configuração flexível** — campos como `rules` em `sport_event_rules` permitem extensão sem migração

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

## Checklist para Nova RPC

```sql
-- 1. Criar função com SECURITY DEFINER se precisar bypassar RLS
CREATE OR REPLACE FUNCTION public.rpc_nome(p_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar permissão
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  -- Lógica...
END;
$$;

-- 2. Revogar acesso público e conceder apenas a authenticated
REVOKE ALL ON FUNCTION public.rpc_nome FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_nome TO authenticated;
```

## Edge Functions

| Função | Arquivo | Descrição |
|--------|---------|-----------|
| `import-inscricoes` | `supabase/functions/import-inscricoes/index.ts` | Pré-processa planilha e chama RPC |
| `validate-qr` | `supabase/functions/validate-qr/index.ts` | Valida QR Code e registra scan |
| `public-events` | `supabase/functions/public-events/index.ts` | Lista eventos públicos |
| `public-results` | `supabase/functions/public-results/index.ts` | Resultados publicados |

### Padrão de Edge Function
- CORS headers obrigatórios
- Autenticação via Bearer token
- Service client para operações privilegiadas
- Resposta JSON padronizada

## RPCs de Regras

| RPC | Permissão | Descrição |
|-----|-----------|-----------|
| `rpc_get_sport_event_rules` | admin, coord_tecnica, secretaria | Retorna regras ou defaults |
| `rpc_upsert_sport_event_rules` | admin, coord_tecnica | Upsert com validação |
| `rpc_seed_sport_event_rules_for_event` | admin (overwrite), coord_tecnica (missing_only) | Seed em massa |

## RPCs de Seed de Logística

| RPC | Permissão | Descrição |
|-----|-----------|-----------|
| `seed_logistics_by_stage(p_event_id)` | admin | Gera dataset isolado por evento (veículos, alojamentos, unidades, refeitórios, janelas, rotas, viagens). Nomenclatura `{TIPO}-{SEDE}-{NNN}`, `seed_tag='seed:logistica:stage'`. Idempotente (aborta se já houver seed). |
| `clear_logistics_seed_by_stage(p_event_id)` | admin | Remove apenas linhas com `seed_tag='seed:logistica:stage'` no evento. |

UI: `/admin/seed-logistica` (apenas perfil `admin`). Auditoria gravada em `audit_events` (`table_name='logistics_seed'`).


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
