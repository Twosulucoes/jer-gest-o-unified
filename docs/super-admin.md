# Super Admin — Documentação

## O que é o Super Admin

O Super Admin é o nível mais alto de acesso no sistema JER Gestão, destinado ao **desenvolvedor/fornecedor** do sistema. Ele possui acesso irrestrito a todos os eventos, configurações globais e ferramentas de diagnóstico.

## Diferença entre Super Admin e Admin

| Aspecto | Admin (Cliente) | Super Admin (Fornecedor) |
|---------|-----------------|--------------------------|
| Escopo | Um evento por vez | Todos os eventos |
| Acesso | `/admin/*` | `/super/*` + `/admin/*` |
| Configurações | Parâmetros do evento | Configurações globais do sistema |
| Logs | Logs do evento ativo | Logs de todo o sistema |
| Visual | Tema azul | Tema escuro (zinc/amber) |

## Rotas do Super Admin

| Rota | Página | Descrição |
|------|--------|-----------|
| `/super` | Dashboard | KPIs globais (eventos, participantes, usuários) |
| `/super/eventos` | Eventos | Lista todos os eventos, permite "entrar como admin" |
| `/super/logs` | Logs | audit_events global com filtros e export CSV |
| `/super/config` | Configurações | Feature flags e parâmetros JSONB |
| `/super/demo` | Demo Seeds | Geração de dados de demonstração |
| `/super/validador` | Validador | Validação técnica de schema |

## Como criar o primeiro Super Admin

Execute no SQL Editor do Supabase:

```sql
-- Substitua pelo UUID do usuário admin existente
INSERT INTO public.user_roles (user_id, role)
VALUES ('5a096804-3eca-47a6-9e4e-e131ef99a3f0', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

> O usuário WORNER (UUID acima) é o admin padrão do sistema.

## Permissões

- `super_admin` tem acesso total a `/super/*` e `/admin/*`
- Todas as verificações de `allowedRoles` no ProtectedRoute são ignoradas para super_admin
- A tabela `system_config` só é acessível via RLS por super_admin
- A função `is_super_admin(user_id)` (SECURITY DEFINER) pode ser usada em policies RLS

## Indicadores Visuais

- No Admin (cliente), o avatar do super_admin exibe badge "S" em amber
- No dropdown do usuário, aparece link "Painel Super" para navegar ao `/super`
- O layout Super Admin usa tema escuro (zinc-900/950) com accent amber

## Tabela system_config

Armazena configurações globais do sistema em formato JSONB:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `key` | text (unique) | Identificador da configuração |
| `value` | jsonb | Valor da configuração |

Exemplos de uso:
```json
// key: "feature_flags"
{ "modulo_pesquisa": true, "modulo_cde": false }

// key: "limites"
{ "max_participantes_por_evento": 5000, "max_eventos": 10 }
```
