# 02 — Modelo de Acesso e Perfis

## Hierarquia de Acesso — 3 Níveis + Global/Etapa

```
Super Admin (/super) → acesso global, todos os eventos
    └── Cliente Admin GLOBAL (/admin) → preparação, acessos, config
            └── [botão "Entrar na Etapa"]
                  └── Cliente Admin ETAPA (/admin/etapa/:stageId/...)
                        operação: credenciamento, competição, logística
        └── Operadores PWA (/pwa) → módulo isolado por perfil
```

### Regra de separação obrigatória

- **Global** nunca exibe módulos operacionais de Etapa.
- **Etapa** nunca exibe itens do Global.
- Única ponte: botões dedicados **"Entrar na Etapa"** ↔ **"Sair da Etapa"**.
- URLs legadas (`/admin/credenciamento`, `/admin/competicao/*`, `/admin/transporte/*`, `/admin/alimentacao/*`, `/admin/alojamento/*`) são redirecionadas pelo `RedirectToEtapas` para a etapa lembrada (`localStorage.jer_last_active_stage_id`) ou para `/admin/etapas`.
- Toda entrada/saída registra `stage_enter` / `stage_exit` em `audit_events`.
- Perfil `delegacao` **não** acessa o Web — usa exclusivamente o PWA.

## Perfis (app_role)

Armazenados na tabela `user_roles` (nunca em `profiles`). Validados via função `has_role(user_id, role)` (SECURITY DEFINER).

### Perfis Disponíveis

| Perfil | Nível | Descrição |
|--------|-------|-----------|
| `super_admin` | Super | Acesso total a `/super` e `/admin` de qualquer evento |
| `admin` | Admin | Acesso total a todos os módulos do evento |
| `secretaria` | Admin | Gestão cadastral, credenciamento, importação, publicação |
| `coordenacao_tecnica` | Admin + PWA | Competição, apuração, resultados, regras por prova |
| `coordenador_modalidade` | Admin | Competição restrita às modalidades vinculadas (via `user_sport_links`) |
| `mesario` | PWA | Acesso exclusivo a partidas designadas (via `match_user_assignments`) |
| `transporte` | PWA | Operação de transporte (veículos, rotas, viagens, embarque) |
| `alimentacao` | PWA | Operação de alimentação (janelas de serviço, registro de consumo) |
| `alojamento` | PWA | Operação de alojamento (locais, unidades, ocupação) |
| `arbitragem` | PWA | Visualização de designações de arbitragem |
| `cde` | Admin | Comissão Disciplinar Esportiva |
| `delegacao` | PWA | Consulta restrita aos dados da própria delegação |

## Redirecionamento Automático por Perfil

Ao fazer login no PWA (`/pwa/login`), o sistema redireciona automaticamente:

| Perfil | Redireciona para |
|--------|-----------------|
| `super_admin` | `/admin` |
| `admin` | `/admin` |
| `secretaria` | `/admin` |
| `transporte` | `/pwa/transporte` |
| `alimentacao` | `/pwa/alimentacao` |
| `alojamento` | `/pwa/alojamento` |
| `coordenacao_tecnica` | `/pwa/coordenacao` |
| `delegacao` | `/pwa/delegacao` |
| `mesario` | `/aovivo` |
| `arbitragem` | `/aovivo` |

## Isolamento de Módulos PWA

Cada módulo PWA é protegido pelo componente `PwaModuleLayout`:

- Valida se o perfil do usuário está na lista de perfis permitidos
- Se não autorizado → redireciona para `/pwa/acesso-negado`
- Admin e secretaria sempre têm acesso (bypass)
- **Sem menu lateral** — apenas header com título do módulo e logout
- **Sem navegação entre módulos** — operador vê apenas seu módulo

## Matriz de Permissões por Módulo

| Módulo | admin | secretaria | coord_tecnica | coord_modalidade | mesario | transporte | alimentacao | delegacao | público |
|--------|:-----:|:----------:|:-------------:|:----------------:|:-------:|:----------:|:-----------:|:---------:|:-------:|
| Eventos/Cadastros | CRUD | CRUD | R | — | — | — | — | — | — |
| Importação | ✓ | ✓ | — | — | — | — | — | — | — |
| Credenciamento | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| Validação QR | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | — | — |
| Transporte | ✓ | ✓ | ✓ | — | — | ✓ | — | — | — |
| Alimentação | ✓ | ✓ | ✓ | — | — | — | ✓ | — | — |
| Alojamento | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| Competição | ✓ | ✓ | ✓ | ✓ (filtrado) | — | — | — | — | — |
| Partida ao vivo | ✓ | ✓ | ✓ | ✓ | ✓ (designada) | — | — | — | — |
| Designação de oficiais | ✓ | — | ✓ | ✓ | R | — | — | — | — |
| **Regras por Prova** | **CRUD** | **R** | **CRUD** | **R** | — | — | — | — | — |
| **Regras em Lote (Seed)** | **✓** | — | **✓** | — | — | — | — | — | — |
| Resultados (publicados) | ✓ | ✓ | ✓ | R | — | — | — | — | R |
| Credenciais (próprias) | ✓ | ✓ | ✓ | — | — | — | — | R | — |

**Legenda**: ✓ = acesso completo ao módulo | R = somente leitura | CRUD = Create/Read/Update/Delete

## Tabelas de Vínculo

### user_sport_links
Vincula `coordenador_modalidade` a modalidades específicas de um evento.
- Campos: `user_id`, `sport_id`, `event_id`, `created_by`
- Constraint: UNIQUE(user_id, sport_id, event_id)
- Gerenciado na área de Gestão de Acessos pelo admin

### match_user_assignments
Designa usuários (mesários, árbitros) para partidas específicas.
- Campos: `match_id`, `user_id`, `role`, `event_id`, `created_by`
- Roles: mesario, arbitro_principal, arbitro_auxiliar, fiscal, anotador
- Constraint: UNIQUE(match_id, user_id, role)

## Implementação

### Frontend (ProtectedRoute)
```tsx
<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"]}>
  <ComponenteProtegido />
</ProtectedRoute>
```

### Frontend (PwaModuleLayout)
```tsx
<PwaModuleLayout moduleTitle="Transporte" allowedRoles={["transporte"]} moduleIcon={Truck}>
  <TransporteHomePage />
</PwaModuleLayout>
```

### Frontend (SuperAdminRoute)
```tsx
<SuperAdminRoute>
  <SuperDashboardPage />
</SuperAdminRoute>
```

### Backend (RLS Policy)
```sql
CREATE POLICY "Secretaria can read" ON tabela
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'secretaria'));
```

### RLS em sport_event_rules
```sql
-- SELECT: admin, coordenacao_tecnica, secretaria
-- INSERT/UPDATE/DELETE: admin, coordenacao_tecnica
-- Seed em massa (overwrite): somente admin
```

## Gestão de Usuários Operacionais

### Fluxo de Criação
1. Admin acessa `/admin/acessos/usuarios` → clica "Novo Usuário"
2. Preenche email, nome completo (obrigatório, mín. 3 caracteres), perfil
3. Sistema chama Edge Function `admin-users` (action: `invite_user`)
4. Supabase Auth envia email com link de ativação → redirect para `/pwa/set-password`
5. Usuário acessa link, define nome completo e senha (mín. 8 chars, 1 maiúscula, 1 número)
6. Conta ativada: `profiles.active = true`
7. Usuário faz login no PWA → redirecionado automaticamente para módulo do perfil

### Edge Function: admin-users
- **Ações**: `list_users`, `invite_user`, `set_role`, `set_active`, `revoke_sessions`, `resend_invite`, `reset_password`, `get_user_audit`
- **Permissão**: apenas `admin` e `secretaria` (via service role)
- **Restrição**: `secretaria` não pode criar/atribuir perfis `admin` ou `secretaria`
- **Auditoria**: todas as ações são registradas em `audit_events`

## Regras

- Um usuário pode ter múltiplos roles
- Perfil sem nenhum role → sem acesso ao admin
- `admin` tem policy ALL em todas as tabelas
- `super_admin` tem acesso global a todos os eventos + painel `/super`
- Perfis operacionais (transporte, alimentacao) → escopo restrito + módulo PWA isolado
- `coordenacao_tecnica` pode criar/editar regras por prova e executar seed (missing_only)
- `coordenador_modalidade` acessa apenas provas das modalidades vinculadas via `user_sport_links`
- `mesario` acessa apenas partidas designadas via `match_user_assignments`
- Seed com `overwrite` requer perfil `admin`
- Usuário com `profiles.active = false` é bloqueado no login (admin e PWA)
