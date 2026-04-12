# 02 — Modelo de Acesso e Perfis

## Perfis (app_role)

Armazenados na tabela `user_roles` (nunca em `profiles`). Validados via função `has_role(user_id, role)` (SECURITY DEFINER).

### Perfis Disponíveis

| Perfil | Descrição |
|--------|-----------|
| `admin` | Acesso total a todos os módulos e operações |
| `secretaria` | Gestão cadastral, credenciamento, importação, publicação |
| `coordenacao_tecnica` | Competição, apuração, resultados, regras por prova |
| `transporte` | Operação de transporte (veículos, rotas, viagens, embarque) |
| `alimentacao` | Operação de alimentação (janelas de serviço, registro de consumo) |
| `delegacao` | Consulta restrita aos dados da própria delegação |

## Matriz de Permissões por Módulo

| Módulo | admin | secretaria | coord_tecnica | transporte | alimentacao | delegacao | público |
|--------|:-----:|:----------:|:-------------:|:----------:|:-----------:|:---------:|:-------:|
| Eventos/Cadastros | CRUD | CRUD | R | — | — | — | — |
| Importação | ✓ | ✓ | — | — | — | — | — |
| Credenciamento | ✓ | ✓ | ✓ | — | — | — | — |
| Validação QR | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Transporte | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Alimentação | ✓ | ✓ | ✓ | — | ✓ | — | — |
| Alojamento | ✓ | ✓ | ✓ | — | — | — | — |
| Competição | ✓ | ✓ | ✓ | — | — | — | — |
| **Regras por Prova** | **CRUD** | **R** | **CRUD** | — | — | — | — |
| **Regras em Lote (Seed)** | **✓** | — | **✓** | — | — | — | — |
| Resultados (publicados) | ✓ | ✓ | ✓ | — | — | — | R |
| Credenciais (próprias) | ✓ | ✓ | ✓ | — | — | R | — |

**Legenda**: ✓ = acesso completo ao módulo | R = somente leitura | CRUD = Create/Read/Update/Delete

## Implementação

### Frontend (ProtectedRoute)
```tsx
<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}>
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
- Seed com `overwrite` requer perfil `admin`
