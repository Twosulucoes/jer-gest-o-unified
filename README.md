# JER Gestão

Sistema de **gestão operacional** dos Jogos Escolares de Roraima (JER e JERPA).

Gerencia toda a operação do evento **após a fase de inscrição**: credenciamento, logística (transporte, alimentação, alojamento), competição, apuração e publicação de resultados.

> **Navegação ✅ Refatorada Global vs Etapa** — Separação total entre contexto Global e contexto de Etapa (2026-04-17)

---

## Estrutura de Navegação

O sistema é organizado em **3 níveis hierárquicos** + **separação Global ↔ Etapa**:

```
┌─────────────────────────────────────────────┐
│          SUPER ADMIN (/super)               │
│   Desenvolvedor / Fornecedor do sistema     │
├─────────────────────────────────────────────┤
│   CLIENTE ADMIN — GLOBAL (/admin)           │
│   Preparação · Acessos · Config · Sistema   │
│   Sem itens operacionais de Etapa           │
│   ─── botão "Entrar na Etapa" ───►          │
├─────────────────────────────────────────────┤
│   ETAPA (/admin/etapa/:stageId/...)         │
│   Credenciamento · Competição · Logística   │
│   Ocorrências · Pesquisa · Relatórios       │
│   Sem itens do Global                       │
│   ◄── botão "Sair da Etapa" ────            │
├─────────────────────────────────────────────┤
│        OPERADORES PWA (/pwa)                │
│   Equipes de campo (externos)               │
└─────────────────────────────────────────────┘
```

### Regra-de-ouro
- **Global** nunca mostra módulos operacionais de Etapa.
- **Etapa** nunca mostra itens do Global.
- Saída da Etapa só pelo botão dedicado **"Sair da Etapa"**.
- Links legados (`/admin/credenciamento`, `/admin/competicao/*`, `/admin/transporte/*`, etc.) redirecionam para a última etapa ativa ou para `/admin/etapas`.

### Super Admin (`/super`) — Desenvolvedor/Fornecedor

Painel exclusivo para quem desenvolve e mantém o sistema.

| Rota | Página | Descrição |
|------|--------|-----------|
| `/super` | Dashboard | KPIs globais (eventos, participantes, usuários, storage) |
| `/super/eventos` | Eventos | Todos os eventos de todos os clientes |
| `/super/logs` | Logs | Audit_events global com filtros |
| `/super/config` | Configurações | Feature flags e parâmetros globais |

- **Acesso**: apenas perfil `super_admin`
- **Como ativar**: `INSERT INTO user_roles (user_id, role) VALUES ('<uuid>', 'super_admin');`

### Cliente Admin GLOBAL (`/admin`) — Configuração do evento

Painel **enxuto** com apenas o que é transversal ao evento (não operacional de etapa):

| Seção | Itens |
|-------|-------|
| Dashboard | KPIs do evento ativo |
| Preparação | Eventos, Delegações, Participantes, Importação, Normalização, Irregularidades, Etapas |
| Relatórios Globais | Visão consolidada do evento |
| Acessos | Usuários Operacionais, Links Externos, Vínculos Delegação |
| Configurações | Parâmetros, Locais, Modalidades, Categorias, Modelos de Credencial |
| Sistema | Diagnóstico do Sistema, Demo/Seeds |
| **CTA** | **Entrar na Etapa** → leva ao seletor `/admin/etapas` |

### Cliente Admin ETAPA (`/admin/etapa/:stageId`)

Tudo que é operação acontece **dentro da Etapa**, escopado por `event_stage_id`:

| Módulo | Rota da Etapa |
|--------|--------------|
| Visão Geral | `/admin/etapa/:stageId` |
| Credenciamento | `/admin/etapa/:stageId/credenciamento` |
| Competição | `/admin/etapa/:stageId/competicao/*` |
| Alojamento | `/admin/etapa/:stageId/alojamento/*` |
| Alimentação | `/admin/etapa/:stageId/alimentacao/*` |
| Transporte | `/admin/etapa/:stageId/transporte/*` |
| Ocorrências | `/admin/etapa/:stageId/ocorrencias` |
| Pesquisa | `/admin/etapa/:stageId/pesquisa` |
| Relatórios da Etapa | `/admin/etapa/:stageId/relatorios` |

- **Banner fixo** indica nome da etapa ativa.
- **Botão "Sair da Etapa"** é a única saída para o Global.
- **Auditoria**: cada entrada/saída registra `stage_enter` / `stage_exit` em `audit_events`.

### Operadores PWA (`/pwa`) — Equipes de campo

Módulos isolados para operadores externos. Cada perfil vê **apenas** seu módulo.

| Módulo | Rota | Perfil |
|--------|------|--------|
| Transporte | `/pwa/transporte` | `transporte` |
| Alimentação | `/pwa/alimentacao` | `alimentacao` |
| Alojamento | `/pwa/alojamento` | `alojamento` |
| Coordenação | `/pwa/coordenacao` | `coordenacao_tecnica` |
| Delegação | `/pwa/delegacao` | `delegacao` |
| Ao Vivo | `/aovivo` | `mesario`, `arbitragem` |

- **Sem menu lateral** — apenas header com título do módulo e logout
- **Redirecionamento automático** — login redireciona para módulo do perfil
- **Acesso via links curtos** — `/go/:slug` para compartilhar via WhatsApp/email

### Links Externos

O cliente distribui acessos para operadores através de **links curtos** com QR code:

1. Acesse **Acessos → Links Externos** no admin
2. Crie link escolhendo módulo destino (Transporte, Alimentação, etc.)
3. Copie a URL ou baixe o QR Code
4. Compartilhe via WhatsApp, email ou SMS
5. Operador clica no link → faz login → cai no módulo dele

---

## Quick Start por Perfil

### Cenário 1: Super Admin
```
1. Logar com conta que tenha role super_admin
2. Acessar /super → ver dashboard global
3. Clicar em evento → "Entrar como admin" para gerenciar
```

### Cenário 2: Cliente Admin
```
1. Logar com conta admin/secretaria
2. Menu lateral com 10 seções organizadas
3. Criar operadores: Acessos → Usuários Operacionais → Novo
4. Distribuir links: Acessos → Links Externos → Criar Link
5. Gerenciar competição: Competição → Central → Wizard
```

### Cenário 3: Operador PWA
```
1. Receber link via WhatsApp do coordenador
2. Clicar no link → tela de login
3. Fazer login com email/senha do convite
4. Cair automaticamente no módulo (ex: Transporte)
5. Usar: scan QR, registrar consumo, embarcar passageiros
```

---

## Status dos Módulos (Auditoria 2026-04-14)

| Módulo | Status | Completude |
|--------|--------|-----------|
| **Preparação** (Eventos, Instituições, Delegações, Importação, Participantes) | ✅ Pronto | 100% |
| **Credenciamento** (Check-in, Emissão, QR, Validação) | ✅ Pronto | 95% |
| **Modelos de Credencial** | 🟡 Parcial | 70% |
| **Competição — Central/Wizard** (Fases, Grupos, Estrutura, Confrontos, Agenda) | ✅ Pronto | 90% |
| **Competição — Motor de Regras** (Presets, Seed, Editor) | ✅ Pronto | 100% |
| **Competição — Resultados e Governança** (Lançamento, Validação, Publicação, Auto-transição) | ✅ Pronto | 100% |
| **Competição — Classificação** (Standings coletivas, Ranking individual/cross-heat) | ✅ Pronto | 85% |
| **Competição — Combate** (combat_detail JSONB, CombatResultForm, auto-detecção) | ✅ Pronto | 90% |
| **Competição — Página da Partida** (Lineup, Eventos, Placar, Oficiais, Anexos) | ✅ Pronto | 90% |
| **Painel de Controle da Competição** | ✅ Pronto | 100% |
| **Logística — Transporte** (Veículos, Rotas, Viagens, Embarque, Relatórios) | ✅ Pronto | 85% |
| **Logística — Alimentação** (Tipos, Janelas, Consumo, Dashboard, Relatórios) | ✅ Pronto | 100% |
| **Logística — Alojamento** (Locais, Unidades, Ocupação, Relatórios) | ✅ Pronto | 85% |
| **PWA Operacional** (Alojamento, Transporte, Alimentação, Coordenação, Delegação) | ✅ Pronto | 85% |
| **PWA Ao Vivo** (Mesário touch-friendly, dark mode, offline) | ✅ Pronto | 90% |
| **Publicação Oficial** (Portal público, Edge Functions, PDF boletins) | 🟡 Parcial | 65% |
| **Evidências / OSC** | ⚪ Não iniciado | 0% |
| **Configurações** (Parâmetros, Irregularidades, Normalização, Validador, Mapa) | ✅ Pronto | 100% |
| **Acessos e Perfis** (Usuários, Delegações, Sport Links, PWA Guards) | ✅ Pronto | 85% |
| **Pesquisa de Satisfação** | 🟡 Parcial | 60% |
| **Links e Páginas Públicas** | ✅ Pronto | 85% |
| **Relatórios** (Central + Transporte + Alimentação + Alojamento) | ✅ Pronto | 100% |
| **Boletins Oficiais** (Criação, publicação, geração PDF) | 🟡 Parcial | 70% |
| **Super Admin** (Dashboard, Eventos, Logs, Config) | ✅ Pronto | 80% |

**Resumo**: 63 tabelas, 29 RPCs, 4 Edge Functions, 28+ rotas admin, 5 rotas super, 25+ rotas PWA, 12 perfis de acesso.

---

## Posicionamento do Sistema

1. **A inscrição oficial acontece no sistema oficial do evento (SIGECOM)**, conforme Regulamento Geral (Art. 58–60).
2. **O JER Gestão NÃO substitui o sistema oficial de inscrição.** Ele importa/espelha os dados exportados do SIGECOM para viabilizar a operação de campo.
3. **Após importados, os dados no JER Gestão constituem a "base operacional do evento"** — usada para rastreabilidade e execução de campo, mas sem valor regulatório de inscrição.

---

## Stack Técnica

- **Frontend**: React 18 + Vite 5 + TypeScript 5 + Tailwind CSS v3 + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + Storage)
- **Infraestrutura**: Lovable.dev
- **PWA**: Capacitor (Android/iOS) + vite-plugin-pwa

## Banco de Dados

- **63 tabelas** no schema `public`, todas com RLS habilitado
- **29 RPCs** (regras, competição, governança, importação, standings, etc.)
- **4 Edge Functions** (import-inscricoes, validate-qr, public-events, public-results)
- **13+ triggers** de integridade referencial
- **2 buckets** de storage (credential-templates, match-attachments)

## Documentação

Consulte a pasta `/docs` para documentação detalhada:

### Arquitetura e Referência
- [00 — Visão Geral](docs/00-visao-geral.md)
- [01 — Arquitetura](docs/01-arquitetura.md)
- [02 — Modelo de Acesso e Perfis](docs/02-modelo-de-acesso-e-perfis.md)
- [03 — Regras de Negócio](docs/03-regras-de-negocio.md)
- [04 — Módulos Operacionais](docs/04-modulos-operacionais.md)
- [05 — Banco de Dados e RLS](docs/05-banco-de-dados-e-rls.md)
- [06 — Storage e Evidências](docs/06-storage-e-evidencias.md)
- [07 — Fluxos Operacionais](docs/07-fluxos-operacionais.md)
- [08 — Padrões Frontend](docs/08-padroes-frontend-lovable.md)
- [09 — Padrões Backend](docs/09-padroes-backend-supabase.md)
- [10 — Publicação e Resultados](docs/10-publicacao-e-resultados.md)
- [11 — Operação OSC / Prestação de Contas](docs/11-operacao-osc-prestacao-de-contas.md)
- [12 — Glossário](docs/12-glossario.md)

### Guias e Operação
- [Guia do Cliente](docs/guia-cliente.md) — Para quem opera o evento
- [Guia do Operador](docs/guia-operador.md) — Para equipes de campo (PWA)
- [Super Admin](docs/super-admin.md) — Painel do fornecedor
- [Links Externos](docs/links-externos.md) — Distribuição de acessos
- [Menu Cliente Admin](docs/menu-cliente-admin.md) — Estrutura completa do menu
- [Importação (SIGECOM)](docs/operacao/importacao-sigecom.md)

### Validação
- [Validação de Navegação](docs/validacao-navegacao.md) — Checklist de testes
- [Relatório de Refatoração](docs/refatoracao-navegacao-relatorio.md)
- [Executar Testes E2E](docs/checklists/executar-testes-e2e.md)
- [Inventário Completo](docs/inventario-completo-sistema.md)

## Deploy

1. **Preview**: https://id-preview--02caebf9-e7e0-4dff-bce8-2d8c1fecc666.lovable.app
2. **Produção**: https://joyful-sports-hub.lovable.app
3. **Supabase**: Projeto conectado via Lovable Cloud
4. **Variáveis de ambiente**: `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
