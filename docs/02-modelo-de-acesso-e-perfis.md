# 02 — Modelo de Acesso e Perfis

## Perfis (app_role)

Armazenados na tabela `user_roles` (nunca em `profiles`). Validados via função `has_role(user_id, role)` (SECURITY DEFINER).

### Perfis Disponíveis

| Perfil | Descrição |
|--------|-----------|
| `admin` | Acesso total a todos os módulos e operações |
| `secretaria` | Gestão cadastral, credenciamento, importação, publicação |
| `coordenacao_tecnica` | Competição, apuração, resultados, regras por prova |
| `coordenador_modalidade` | Competição restrita às modalidades vinculadas (via `user_sport_links`) |
| `mesario` | Acesso exclusivo a partidas designadas (via `match_user_assignments`) |
| `transporte` | Operação de transporte (veículos, rotas, viagens, embarque) |
| `alimentacao` | Operação de alimentação (janelas de serviço, registro de consumo) |
| `alojamento` | Operação de alojamento (locais, unidades, ocupação) |
| `arbitragem` | Visualização de designações de arbitragem |
| `cde` | Comissão Disciplinar Esportiva |
| `delegacao` | Consulta restrita aos dados da própria delegação |

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

## Regras

- Um usuário pode ter múltiplos roles
- Perfil sem nenhum role → sem acesso ao admin
- `admin` tem policy ALL em todas as tabelas
- Perfis operacionais (transporte, alimentacao) → escopo restrito + scans próprios
- `coordenacao_tecnica` pode criar/editar regras por prova e executar seed (missing_only)
- `coordenador_modalidade` acessa apenas provas das modalidades vinculadas via `user_sport_links`
- `mesario` acessa apenas partidas designadas via `match_user_assignments`
- Seed com `overwrite` requer perfil `admin`
- Usuário com `profiles.active = false` é bloqueado no login (admin e PWA)

## Gestão de Usuários Operacionais

### Página de Gestão
- URL: `/admin/acessos/usuarios`
- Acesso: `admin` e `secretaria`
- Funcionalidades: listagem com filtros, convite, alteração de perfil, ativar/desativar, reenviar convite, resetar senha, histórico de auditoria

### Fluxo de Convite
1. Admin acessa `/admin/acessos/usuarios` → clica "Novo Usuário"
2. Preenche email, nome completo (obrigatório, mín. 3 caracteres), perfil
3. Sistema chama Edge Function `admin-users` (action: `invite_user`)
4. Supabase Auth envia email com link de ativação → redirect para `/pwa/set-password`
5. Usuário acessa link, define nome completo e senha (mín. 8 chars, 1 maiúscula, 1 número)
6. Conta ativada: `profiles.active = true`
7. Usuário faz login no PWA e acessa módulo conforme perfil

### Edge Function: admin-users
- **Ações**: `list_users`, `invite_user`, `set_role`, `set_active`, `revoke_sessions`, `resend_invite`, `reset_password`, `get_user_audit`
- **Permissão**: apenas `admin` e `secretaria` (via service role)
- **Restrição**: `secretaria` não pode criar/atribuir perfis `admin` ou `secretaria`
- **Auditoria**: todas as ações são registradas em `audit_events`

### Como Reenviar Convite
1. Acesse `/admin/acessos/usuarios`
2. Clique no usuário com status "Convite pendente"
3. No drawer lateral, clique "Reenviar Convite"

### Como Desativar Usuário
1. Acesse `/admin/acessos/usuarios`
2. Clique no usuário
3. No drawer, desative o switch "Desativar usuário"
4. Confirme no diálogo de confirmação
5. Sessões ativas são invalidadas automaticamente

### Como Trocar Perfil
1. No drawer do usuário, altere o select de "Perfil"
2. A alteração é salva automaticamente e registrada em `audit_events`
