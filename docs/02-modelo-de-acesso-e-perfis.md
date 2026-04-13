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
