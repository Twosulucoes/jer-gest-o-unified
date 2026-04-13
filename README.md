# JER Gestão

Sistema de **gestão operacional** dos Jogos Escolares de Roraima (JER e JERPA).

Gerencia toda a operação do evento **após a fase de inscrição**: credenciamento, logística (transporte, alimentação, alojamento), competição, apuração e publicação de resultados.

---

## Posicionamento do Sistema

1. **A inscrição oficial acontece no sistema oficial do evento (SIGECOM)**, conforme Regulamento Geral (Art. 58–60). Endereço: https://sigecom.mms.inf.br/login
2. **O JER Gestão NÃO substitui o sistema oficial de inscrição.** Ele importa/espelha os dados exportados do SIGECOM para viabilizar a operação de campo (credenciamento, logística, competição, apuração interna, evidências).
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
- **Motor de regras por prova** — parametrização de família, formato, pontuação, desempate e políticas de W.O. por modalidade
- **Presets esportivos** — configurações prontas para Futsal, Futebol, Handebol, Basquete, Karatê (Kata e Kumite)
- **Seed automático de regras** — geração em massa de regras para todas as provas de um evento com heurística por nome de modalidade
- Gestão de competições (fases, grupos, partidas, resultados)
- **Painel de Controle da Competição** — visão consolidada do progresso de todas as provas com status automático (Bloqueada/Não Iniciada/Em Andamento/Com Pendência/Concluída), barras de progresso visuais e navegação direta ao wizard
- **Estrutura de grupos para coletivas** — wizard com sugestão automática, alocação de equipes em grupos e geração de partidas round-robin por grupo
- **Controle de fluxo do wizard (coletivas)** — passos sequenciais com pré-condições: cada passo só fica acessível quando o anterior está concluído. Visual com estados (concluído/parcial/bloqueado) e barra de progresso. Deep-links respeitam bloqueios.
- **Agendamento de partidas** — Passo 4 (Agenda) do wizard com agendamento individual (data, hora, local) e em lote (horários sequenciais automáticos), detecção de conflitos de agenda por local/equipe/atleta, e contador de progresso
- **Perfis especializados** — `coordenador_modalidade` (acesso filtrado por modalidade via `user_sport_links`) e `mesario` (acesso exclusivo a partidas designadas via `match_user_assignments`)
- **Designação de oficiais** — atribuição de mesários, árbitros, fiscais e anotadores a partidas individuais via `match_user_assignments`, com busca por nome e histórico de atuações
- **Modo ao vivo (touch-friendly)** — interface de campo para registro de ocorrências em tempo real (gols, cartões, faltas) com botões grandes, placar automático, cronômetro manual, suporte offline (localStorage) e sincronização automática
- **Link direto para detalhe** — coluna "Detalhe" no Passo 4 (Agenda) do wizard com navegação para `/admin/competicao/partida/:id`
- **PWA "JER Ao Vivo"** — aplicação web progressiva instalável (`/aovivo`) para mesários registrarem partidas em tempo real no celular, com suporte offline, sincronização automática, interface touch-friendly dark mode, e acesso restrito via `match_user_assignments`
- Apuração e publicação de resultados
- Registro de evidências operacionais (prestação de contas / OSC)

### O que NÃO faz
- Inscrição de participantes (feita exclusivamente no SIGECOM)
- Alteração de dados no sistema oficial (SIGECOM)
- Gestão financeira
- Comunicação/marketing
- Streaming/transmissão de jogos

---

## Glossário

| Termo | Definição |
|-------|-----------|
| **Sistema Oficial de Inscrição (SIGECOM)** | Sistema externo onde as inscrições são realizadas conforme Regulamento. Origem regulatória dos dados. |
| **Base Operacional (JER Gestão)** | Dados importados do SIGECOM + estado operacional gerado no JER Gestão (credenciais, QR, consumo, alojamento, partidas, regras, logs). |
| **Importação / Espelhamento** | Processo técnico que transforma a exportação do SIGECOM em estrutura operacional no JER Gestão. Não constitui inscrição oficial. |
| **Motor de Regras** | Sistema de parametrização por prova (sport_event) que define família, formato, pontuação, desempate e políticas operacionais. |
| **Preset Esportivo** | Configuração pré-definida de regras para uma modalidade específica (ex: FUTSAL, BASQUETE, KARATE_KUMITE). |
| **Publicação Oficial** | Divulgação pública de resultados, somente após validação e autorização da coordenação. |
| **SEDUC-RR** | Secretaria de Educação de Roraima — órgão responsável pelo JER. |

Para glossário completo, veja [docs/12-glossario.md](docs/12-glossario.md).

---

## Stack Técnica

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + Storage)
- **Infraestrutura**: Lovable.dev

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
