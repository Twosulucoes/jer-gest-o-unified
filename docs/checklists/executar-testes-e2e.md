# Executar Testes E2E — JER Gestão

## Pré-requisitos

```bash
npm install -g tsx   # ou use npx tsx
```

## Variáveis de Ambiente

```bash
export SUPABASE_URL="https://dfzjrijdcskncrwaiykr.supabase.co"
export SUPABASE_SERVICE_KEY="<sua-service-role-key>"
```

> ⚠️ Use a **Service Role Key** (não a anon key). Disponível em Supabase Dashboard → Settings → API.

## Executar Scripts Individuais

```bash
# Prova Coletiva (Futsal)
npx tsx scripts/e2e-prova-coletiva.ts

# Prova Individual (Atletismo 100m)
npx tsx scripts/e2e-prova-individual.ts

# Com limpeza automática dos dados de teste
npx tsx scripts/e2e-prova-coletiva.ts --cleanup
```

## Executar Suite Completa

```bash
npx tsx scripts/run-e2e-tests.ts

# Com limpeza
npx tsx scripts/run-e2e-tests.ts --cleanup
```

## Interpretar Resultados

Cada passo mostra:
- ✅ **Passou** — critério de sucesso atendido
- ❌ **Falhou** — erro encontrado (detalhes no log)
- ⚠️ **Warning** — funcionou com ressalvas
- ⏭️ **Skipped** — passo pulado por dependência

### Exemplo de output (sucesso):

```
═══════════════════════════════════════════════════════
RELATÓRIO: e2e-prova-coletiva
Início: 2026-04-14T18:00:00Z  |  Fim: 2026-04-14T18:00:12Z
Duração total: 12.3s
Passos: 13 total | ✅ 13 | ❌ 0 | ⚠️ 0 | ⏭️ 0
───────────────────────────────────────────────────────
  ✅ Passo 0: Criar pré-requisitos (234ms)
  ✅ Passo 1: Criar sport_event (45ms)
  ...
═══════════════════════════════════════════════════════
```

## Logs

Logs são salvos automaticamente em `logs/e2e-<script>-<timestamp>.log`.

## Dados de Teste

Todos os dados criados usam prefixo `[E2E_TEST]` nos nomes. Use `--cleanup` para remover após execução, ou delete manualmente:

```sql
DELETE FROM events WHERE name LIKE '[E2E_TEST]%';
```

## Troubleshooting

| Erro | Solução |
|------|---------|
| `Missing env: SUPABASE_URL` | Configure as variáveis de ambiente |
| `permission denied` | Use a Service Role Key, não a anon key |
| `violates foreign key` | Dados de teste anteriores não foram limpos; use `--cleanup` |
| `duplicate key` | Execute com `--cleanup` para limpar dados antigos |
