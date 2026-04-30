# JER Gestão — Sistema de Gestão de Eventos Esportivos

![JER Gestão](https://img.shields.io/badge/JER_Gestão-v5.0-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Operacional-success?style=for-the-badge)
![Tech](https://img.shields.io/badge/Stack-Lovable_%2B_Supabase-orange?style=for-the-badge)

O **JER Gestão** é uma plataforma robusta de gestão operacional para os Jogos Escolares de Roraima (JER e JERPA). O sistema atua como a espinha dorsal logística e competitiva do evento, transformando dados de inscrição em uma operação de campo eficiente e auditável.

---

## 🧭 Mapa da Galáxia (Documentação)

Para navegar pela complexidade do sistema, utilize os guias detalhados abaixo:

### 📖 Fundamentos
- [**00 — Visão Geral**](docs/00-visao-geral.md): O que é o sistema, perfis de acesso e posicionamento frente ao SIGECOM.
- [**01 — Arquitetura**](docs/01-arquitetura.md): Stack tecnológica, fluxos de dados e decisões de design.
- [**02 — Modelo de Acesso e Perfis**](docs/02-modelo-de-acesso-e-perfis.md): Matriz de permissões (RBAC) e segurança.
- [**12 — Glossário**](docs/12-glossario.md): Dicionário de termos técnicos e esportivos do sistema.

### ⚙️ Operação
- [**04 — Módulos Operacionais**](docs/04-modulos-operacionais.md): Detalhamento técnico de Importação, Credenciamento, Logística e Competição.
- [**07 — Fluxos Operacionais**](docs/07-fluxos-operacionais.md): Jornadas do usuário de ponta a ponta.
- [**08 — Padrões Frontend**](docs/08-padroes-frontend-lovable.md): Guia de estilo, componentes e UX.
- [**09 — Padrões Backend**](docs/09-padroes-backend-supabase.md): SQL, RLS, Triggers e Edge Functions.

### 📊 Resultados e Governança
- [**10 — Publicação e Resultados**](docs/10-publicacao-e-resultados.md): Ciclo de vida da informação oficial.
- [**11 — Operação OSC e Prestação de Contas**](docs/11-operacao-osc-prestacao-de-contas.md): Evidências e relatórios formais.
- [**Inventário Completo de Rotas**](docs/inventario-completo-sistema.md): Mapa de todas as URLs do Admin e PWA.

---

## 🚀 Status dos Módulos (Auditoria 2026-04-30)

| Módulo | Status | Destaque Recente |
| :--- | :---: | :--- |
| **🏠 Alojamento** | ✅ | Fechado para operação. Controle de ocupação e presença noturna. |
| **🍽️ Alimentação** | ✅ | Motor de janelas de serviço e controle de divergências. |
| **🚌 Transporte** | ✅ | Gestão de embarque e listas de passageiros por viagem. |
| **🏆 Competição** | ✅ | Motor de regras JSONB e suporte a 6 famílias de modalidades. |
| **📄 Boletins** | ✅ | Geração automática de PDF e XLSX oficial. |
| **📱 PWA Operacional** | ✅ | Módulos isolados por perfil com suporte a contexto de etapa. |
| **💡 Manual e Ajuda** | ✅ | **Novo!** Jornada de "Primeiros Passos" interativa para Admins. |

---

## 🛠️ Tecnologias Principais

- **Frontend:** React 18, Vite, Tailwind CSS, shadcn/ui.
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions).
- **Inteligência:** Lovable AI Gateway para orquestração de fluxos complexos.
- **Relatórios:** jsPDF, ExcelJS e React-PDF.

---

## 📦 Como começar (Desenvolvimento)

1. Clone o repositório.
2. Instale as dependências: `npm install` ou `bun install`.
3. Configure as variáveis de ambiente do Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. Inicie o servidor de desenvolvimento: `npm run dev`.

---

© 2026 JER Gestão — Desenvolvido para a Secretaria de Educação de Roraima.

