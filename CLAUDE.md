# CLAUDE.md — JER Gestão

Guia de desenvolvimento para o Claude Code neste repositório.

---

## Visão Geral do Projeto

**JER Gestão** é uma plataforma de gestão operacional para os Jogos Escolares de Roraima (JER e JERPA). Gerencia inscrições, credenciamento, vouchers de alimentação/transporte/alojamento, resultados de competição, relatórios e publicação de resultados.

**Stack:**
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- UI: shadcn/ui (Radix UI primitives) — componentes em `src/components/ui/`
- Backend: Supabase (PostgreSQL + RLS + Edge Functions + Realtime)
- Roteamento: React Router v6
- Estado servidor: TanStack Query v5
- Formulários: React Hook Form + Zod
- Build/package: Bun

---

## Princípio Fundamental

Este projeto tem muito código funcionando. A missão é **melhorar o que existe**, nunca substituir.

---

## Regras Inegociáveis

### 1. Antes de criar, procure

```bash
grep -r "NomeDoConceito\|nomeDoConceito" src/ --include="*.tsx" --include="*.ts" -l
```

Se já existir algo parecido → **aproveite e melhore**. Nunca duplique.

### 2. Antes de alterar, entenda

Leia o arquivo completo antes de editar qualquer linha. Entenda:
- O que ele faz hoje
- De onde vêm os dados que ele usa
- Quais outros arquivos dependem dele

### 3. Nunca quebre o que funciona

- Se uma funcionalidade está operando, ela continua operando após a alteração
- Se precisar refatorar algo em uso, faça de forma incremental
- Em caso de dúvida entre refatorar e aproveitar: **aproveite**

### 4. Cada coisa no lugar certo

| O que | Onde |
|---|---|
| Novo hook | `src/hooks/` |
| Novo componente | `src/components/<modulo>/` |
| Query SQL nova | junto das queries/views existentes |
| Nova migration | `supabase/migrations/` com timestamp sequencial (`YYYYMMDDHHMMSS_descricao.sql`) |
| Nova rota | `src/routes/AppRoutes.tsx` |
| Nova página | `src/pages/<modulo>/` |

### 5. Reaproveite componentes existentes

Antes de criar um novo componente de UI, verifique:
- `src/components/ui/` — biblioteca shadcn/ui completa (button, card, dialog, drawer, sheet, badge, toast/sonner, table, tabs, select, input, skeleton, etc.)
- `src/components/shared/` — componentes reutilizáveis do projeto

Se existir → use. Adapte com props se necessário — não crie um segundo componente igual.

### 6. Mantenha o padrão do projeto

- Convenções de nome: camelCase para variáveis/funções, PascalCase para componentes, kebab-case para arquivos de página
- Classes Tailwind: siga o padrão visual já aplicado em componentes similares
- Tratamento de erro: `toast` (sonner) para feedback ao usuário, `console.error` para logging
- **Um único cliente Supabase** — `src/integrations/supabase/client.ts`. Nunca crie um segundo.
- Autenticação via `useAuth` (`src/hooks/useAuth.tsx`)
- Escopo de etapa via `useStageScope` (`src/hooks/useStageScope.ts`)

### 7. Documente o que mudou

Ao final de cada tarefa, liste:

```
ALTERAÇÕES REALIZADAS:
- [arquivo] → o que foi mudado e por quê
- [arquivo] → o que foi adicionado
- [migration] → o que foi criado no banco

ARQUIVOS NÃO TOCADOS (intencionalmente):
- [arquivo] → motivo
```

---

## Estrutura de Diretórios

```
src/
├── components/
│   ├── ui/              # shadcn/ui — nunca editar diretamente
│   ├── shared/          # componentes reutilizáveis do projeto
│   ├── admin/           # módulo administrativo
│   ├── credenciamento/  # módulo de credenciamento
│   ├── registros/       # módulo de registros
│   ├── relatorios/      # módulo de relatórios
│   └── ...              # demais módulos
├── hooks/               # hooks React customizados
├── pages/               # páginas por módulo
├── routes/
│   └── AppRoutes.tsx    # definição central de rotas
├── integrations/
│   └── supabase/
│       ├── client.ts    # cliente Supabase (único — não duplicar)
│       └── types.ts     # tipos gerados do banco
├── contexts/            # React contexts
├── lib/                 # utilitários e helpers
├── types/               # tipos TypeScript globais
└── utils/               # funções utilitárias

supabase/
└── migrations/          # migrations SQL (timestamp sequencial)
```

---

## Fluxo de Trabalho Padrão

```
1. Ler o prompt da tarefa
2. Mapear o que já existe relacionado ao tema (grep, find)
3. Identificar o que pode ser aproveitado
4. Propor o plano de execução (sem codar ainda) se houver ambiguidade
5. Executar de forma incremental
6. Rodar: bun run build
7. Documentar as alterações
```

---

## Comandos Úteis

```bash
# Desenvolvimento
bun run dev

# Build (validações incluídas)
bun run build

# Testes
bun run test

# Lint
bun run lint

# Validar dados do frontend
bun run validate:data
```

---

## Banco de Dados

- Projeto Supabase: `dfzjrijdcskncrwaiykr`
- Migrations em: `supabase/migrations/`
- Timestamp de migration: `YYYYMMDD000000_descricao_da_mudanca.sql`
- RLS ativo em todas as tabelas — sempre revisar políticas ao criar tabelas
- Funções/RPCs preferidas para operações atômicas e críticas

---

## Em Caso de Conflito

Se encontrar dois jeitos de implementar — um criando do zero e outro aproveitando o que existe — **sempre escolha aproveitar**, mesmo que a solução fique um pouco menos "elegante". Consistência vale mais que perfeição.
