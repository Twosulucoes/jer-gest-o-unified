# Análise do sistema de usuários e permissões

## 1) Visão geral do modelo

O projeto implementa controle de acesso em **camadas**:

1. **Autenticação** via Supabase Auth (sessão + usuário).
2. **Autorização por perfil (RBAC)** com enum `app_role` e tabela `user_roles`.
3. **Guarda de rota no frontend** (`ProtectedRoute`, `SuperAdminRoute`, `PwaModuleLayout`).
4. **RLS no banco** (policies com `has_role(auth.uid(), ...)`) para garantir proteção de dados mesmo se o frontend falhar.
5. **Edge Function administrativa** (`admin-users`) para operações privilegiadas de gestão de contas.

## 2) Perfis e armazenamento

- Os perfis oficiais estão no enum `app_role`, incluindo: `admin`, `secretaria`, `coordenacao_tecnica`, `coordenador_modalidade`, `transporte`, `alimentacao`, `alojamento`, `delegacao`, `mesario`, `arbitragem`, `cde` e `super_admin`.
- O vínculo usuário ↔ perfil fica em `user_roles`.
- Dados cadastrais básicos ficam em `profiles` (`full_name`, `avatar_url`, `active`).

Na documentação interna, a regra explícita é manter permissões em `user_roles` (e não em `profiles`) e validar por `has_role(...)`.

## 3) Como o frontend decide acesso

### 3.1 Carregamento de sessão e perfis (`useAuth`)

O hook:

- restaura sessão com `supabase.auth.getSession()`;
- escuta mudanças com `onAuthStateChange`;
- busca perfis do usuário em `user_roles` e dados pessoais em `profiles`;
- expõe `roles`, `hasRole(...)`, `profile`, `loading`.

Ou seja, todas as decisões de rota dependem da lista de roles retornada para o usuário autenticado.

### 3.2 Área admin (`ProtectedRoute`)

A lógica de proteção:

- exige login;
- bloqueia usuário sem nenhum role;
- permite bypass total para `super_admin`;
- se o usuário só tiver perfis operacionais (PWA), **redireciona para o módulo PWA**;
- nas subrotas, aplica `allowedRoles` por página.

Isso cria uma separação clara entre perfis administrativos e operacionais.

### 3.3 Área super (`SuperAdminRoute`)

Só permite acesso quando `hasRole("super_admin")` é verdadeiro. Sem isso, redireciona para `/admin` e mostra aviso de acesso negado.

### 3.4 Módulos PWA (`PwaModuleLayout`)

- Exige usuário autenticado;
- Autoriza se o usuário tiver: `admin`, `secretaria` ou algum dos `allowedRoles` do módulo;
- Caso contrário, envia para `/pwa/acesso-negado`.

## 4) Matriz de permissão nas rotas

O roteamento em `App.tsx` confirma o desenho da documentação:

- `/super/*` protegido por `SuperAdminRoute`;
- `/admin/*` protegido por `ProtectedRoute`;
- páginas sensíveis usam `allowedRoles` específicos (ex.: acessos de usuários/delegações só `admin` e `secretaria`);
- contexto de etapa (`/admin/etapa/:stageId/*`) permite combinação de roles operacionais e administrativos, com filtros por submódulo.

## 5) Gestão de usuários (Edge Function `admin-users`)

A função concentra o ciclo de vida das contas:

- valida autenticação via token Bearer;
- valida autorização do solicitante (somente `admin` ou `secretaria`);
- ações implementadas: `list_users`, `invite_user`, `set_role`, `set_roles`, `set_active`, `revoke_sessions`, `resend_invite`, `reset_password`, `generate_reset_link`, `get_user_audit`;
- grava auditoria em `audit_events`.

### Regras importantes já aplicadas

- `secretaria` não pode criar nem atribuir role `admin`/`secretaria`;
- ao desativar usuário (`set_active=false`), revoga sessões;
- impede autodesativação do próprio usuário.

## 6) Escopo fino por vínculo (além do role)

Além de RBAC puro, há vínculos de escopo:

- `user_sport_links`: restringe `coordenador_modalidade` às modalidades vinculadas;
- `match_user_assignments`: restringe `mesario`/oficiais às partidas designadas.

Esse padrão melhora muito a segurança porque combina **perfil + escopo de dados**.

## 7) Pontos de atenção observados

1. **Inconsistência de capacidades para `super_admin`**
   - O frontend reconhece `super_admin` em rotas.
   - A Edge Function `admin-users` valida apenas chamador `admin`/`secretaria` e a lista `VALID_ROLES` não inclui `super_admin`.
   - Impacto: comportamento administrativo de `super_admin` pode ficar parcial/inconsistente dependendo do fluxo usado.

2. **Dependência do frontend para UX, mas segurança real está no banco**
   - O desenho é correto (RLS como barreira principal), mas é crítico manter policies atualizadas em todas as novas tabelas para não haver “furo” em endpoints futuros.

3. **Complexidade crescente de roles**
   - Como há muitos perfis e regras por módulo, é recomendável manter uma matriz única “código + docs” sempre sincronizada para evitar drift.

## 8) Conclusão

O sistema de usuários está bem estruturado e segue um padrão robusto:

- **auth centralizada**;
- **RBAC via `user_roles`**;
- **guardas de rota** para UX e segregação de áreas;
- **RLS/has_role** como camada de proteção real de dados;
- **auditoria** nas ações administrativas.

A principal melhoria prioritária é alinhar completamente o papel `super_admin` entre frontend, Edge Functions e políticas operacionais para evitar zonas cinzentas de permissão.
