# 02 — Modelo de Acesso e Perfis

## Perfis (app_role)

Armazenados na tabela `user_roles` (nunca em `profiles`). Validados via função `has_role(user_id, role)` (SECURITY DEFINER).

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

## Regras

- Um usuário pode ter múltiplos roles
- Perfil sem nenhum role → sem acesso ao admin
- `admin` tem policy ALL em todas as tabelas
- Perfis operacionais (transporte, alimentacao) → escopo restrito + scans próprios
