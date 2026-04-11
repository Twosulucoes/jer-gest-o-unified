# Contribuindo com o JER Gestão

## Princípios

1. **Mudança incremental** — PRs pequenos e focados, um módulo por vez
2. **Segurança primeiro** — toda tabela nova deve ter RLS + policies
3. **Dados reais** — nunca usar dados mockados em produção
4. **Rastreabilidade** — toda ação relevante registra operador e timestamp

## Como Abrir uma Issue

Use o template:

```
**Módulo:** [Credenciamento / Transporte / Alimentação / ...]
**Tipo:** [Bug / Melhoria / Nova funcionalidade]
**Descrição:** [O que acontece / o que deveria acontecer]
**Passos para reproduzir:** [Se bug]
**Perfil afetado:** [admin / secretaria / ...]
```

## Convenção de Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(credenciamento): adicionar link para página do participante
fix(alimentacao): corrigir duplicidade de consumo por janela
docs: atualizar README com roadmap
security(rls): adicionar policy de DELETE para secretaria
```

Prefixos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `security`

Escopo (módulo): `credenciamento`, `competicao`, `transporte`, `alimentacao`, `alojamento`, `importacao`, `auth`, `rls`, `storage`

## Checklist de PR

Antes de submeter, verificar:

### Banco de Dados
- [ ] Tabelas novas têm RLS habilitado
- [ ] Policies criadas para todos os perfis aplicáveis
- [ ] Triggers de `updated_at` adicionados
- [ ] Constraints de unicidade onde aplicável
- [ ] Migration testada (up e rollback)

### Frontend
- [ ] Rota protegida com `ProtectedRoute` e `allowedRoles` corretos
- [ ] Componentes usam tokens semânticos do design system (não cores diretas)
- [ ] Dados via `@tanstack/react-query` (não fetch direto)
- [ ] Sem dados mockados / hardcoded

### Operacional
- [ ] Labels/nomenclatura consistente com o glossário
- [ ] Ações críticas têm confirmação (AlertDialog)
- [ ] Rastreabilidade preservada (quem/quando/contexto)
- [ ] CHANGELOG atualizado

## Boas Práticas Lovable

1. **Plan Mode** — para mudanças amplas, use o plan mode antes de implementar
2. **Prompts focados** — um componente/página por prompt
3. **Conteúdo real** — use dados e cenários do JER, não lorem ipsum
4. **Tokens semânticos** — sempre `bg-primary`, `text-muted-foreground`, nunca `bg-blue-500`
5. **Componentes pequenos** — extrair componentes focados, não monolitos
6. **Reusar shadcn/ui** — preferir variantes sobre componentes custom
