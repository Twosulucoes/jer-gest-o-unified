# JER Gestão

Sistema de **gestão operacional** dos Jogos Escolares de Roraima (JER e JERPA).

Gerencia toda a operação do evento **após a fase de inscrição**: credenciamento, logística (transporte, alimentação, alojamento), competição, apuração e publicação de resultados.

---

## Status dos Módulos (Auditoria 2026-04-14)

| Módulo | Status | Completude |
|--------|--------|-----------|
| **Preparação** (Eventos, Instituições, Delegações, Importação, Participantes) | ✅ Pronto | 100% |
| **Credenciamento** (Check-in, Emissão, QR, Validação) | ✅ Pronto | 95% |
| **Modelos de Credencial** | 🟡 Parcial | 70% |
| **Competição — Central/Wizard** (Fases, Grupos, Estrutura, Confrontos, Agenda) | ✅ Pronto | 90% |
| **Competição — Motor de Regras** (Presets, Seed, Editor) | ✅ Pronto | 100% |
| **Competição — Resultados e Governança** (Lançamento, Validação, Publicação) | 🟡 Parcial | 75% |
| **Competição — Classificação** (Standings coletivas, Ranking individual/cross-heat) | ✅ Pronto | 85% |
| **Competição — Combate** (combat_detail JSONB, CombatResultForm, auto-detecção) | ✅ Pronto | 90% |
| **Competição — Página da Partida** (Lineup, Eventos, Placar, Oficiais, Anexos) | ✅ Pronto | 90% |
| **Painel de Controle da Competição** | ✅ Pronto | 100% |
| **Logística — Transporte** (Veículos, Rotas, Viagens, Embarque) | 🟡 Parcial | 60% |
| **Logística — Alimentação** (Tipos, Janelas, Consumo, Dashboard tempo real) | ✅ Pronto | 95% |
| **Logística — Alojamento** (Locais, Unidades, Ocupação) | 🟡 Parcial | 65% |
| **PWA Operacional** (Alojamento, Transporte, Alimentação, Coordenação, Delegação) | 🟡 Parcial | 70% |
| **PWA Ao Vivo** (Mesário touch-friendly, dark mode, offline) | ✅ Pronto | 90% |
| **Publicação Oficial** (Portal público, Edge Functions, PDF boletins) | 🟡 Parcial | 65% |
| **Evidências / OSC** | ⚪ Não iniciado | 0% |
| **Configurações** (Parâmetros, Irregularidades, Normalização, Validador, Mapa) | ✅ Pronto | 100% |
| **Acessos e Perfis** (Usuários, Delegações, Sport Links, PWA Guards) | ✅ Pronto | 85% |
| **Pesquisa de Satisfação** | 🟡 Parcial | 60% |
| **Links e Páginas Públicas** | ✅ Pronto | 85% |
| **Relatórios** | 🟡 Parcial | 50% |
| **Boletins Oficiais** (Criação, publicação, geração PDF) | 🟡 Parcial | 70% |

**Resumo**: 63 tabelas no banco, 29 RPCs, 4 Edge Functions, 28+ rotas admin, 25+ rotas PWA, 11 perfis de acesso.

---

## Posicionamento do Sistema

1. **A inscrição oficial acontece no sistema oficial do evento (SIGECOM)**, conforme Regulamento Geral (Art. 58–60).
2. **O JER Gestão NÃO substitui o sistema oficial de inscrição.** Ele importa/espelha os dados exportados do SIGECOM para viabilizar a operação de campo.
3. **Após importados, os dados no JER Gestão constituem a "base operacional do evento"** — usada para rastreabilidade e execução de campo, mas sem valor regulatório de inscrição.

---

## Escopo Funcional

```
Importação (SIGECOM) → Credenciamento/QR → Logística → Competição → Apuração → Publicação → Evidências
```

### O que FAZ
- Importação/espelhamento dos dados do sistema oficial (SIGECOM)
- Credenciamento e emissão de credenciais com QR Code
- Gestão logística (transporte, alimentação, alojamento)
- Motor de regras por prova — parametrização de família, formato, pontuação, desempate e políticas de W.O.
- Presets esportivos — configurações prontas para Futsal, Futebol, Handebol, Basquete, Karatê
- Seed automático de regras — geração em massa para todas as provas de um evento
- Gestão de competições (fases, grupos, partidas, resultados)
- Painel de Controle da Competição — visão consolidada do progresso
- Estrutura de grupos para coletivas — wizard com sugestão automática
- Baterias/séries para individuais — distribuição automática de atletas
- Ranking cross-heat — consolidação de resultados de todas as baterias
- Agendamento de partidas — individual e em lote com detecção de conflitos
- Perfis especializados — coordenador_modalidade e mesário com acessos filtrados
- Designação de oficiais — mesários, árbitros, fiscais, anotadores
- Modo ao vivo (touch-friendly) — PWA para mesários em campo
- Governança de resultados — ciclo lançado → validado → publicado com boletim oficial
- Apuração e publicação de resultados

### O que NÃO faz
- Inscrição de participantes (feita exclusivamente no SIGECOM)
- Alteração de dados no sistema oficial (SIGECOM)
- Gestão financeira
- Comunicação/marketing
- Streaming/transmissão de jogos

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
- [Importação (SIGECOM)](docs/operacao/importacao-sigecom.md)

## Deploy

1. **Preview**: https://id-preview--02caebf9-e7e0-4dff-bce8-2d8c1fecc666.lovable.app
2. **Produção**: https://joyful-sports-hub.lovable.app
3. **Supabase**: Projeto conectado via Lovable Cloud
4. **Variáveis de ambiente**: `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
