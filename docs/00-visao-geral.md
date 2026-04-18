# 00 — Visão Geral

## O que é o JER Gestão

Sistema de **gestão operacional** dos Jogos Escolares de Roraima (JER e JERPA). Gerencia toda a operação do evento após a fase de inscrição: credenciamento, logística, competição, apuração e publicação de resultados.

## Posicionamento do Sistema

- **Inscrição oficial**: realizada exclusivamente no sistema oficial do evento (SIGECOM), conforme Regulamento Geral (Art. 58–60).
- **JER Gestão**: importa/espelha os dados do SIGECOM para montar a **base operacional do evento** — usada para execução de campo, rastreabilidade e prestação de contas.
- **O JER Gestão NÃO substitui o SIGECOM** e NÃO cria inscrições oficiais.

## Arquitetura de Acesso — 3 Níveis Hierárquicos

```
┌─────────────────────────────────────────────────────────┐
│                 SUPER ADMIN (/super)                    │
│          Desenvolvedor / Fornecedor do sistema          │
│   Dashboard global, logs, config, todos os eventos      │
├─────────────────────────────────────────────────────────┤
│                CLIENTE ADMIN (/admin)                   │
│        Secretaria / Coordenação do evento               │
│   10 seções: Preparação, Credenciamento, Competição,    │
│   Logística, Relatórios, Pesquisa, Acessos, Config...   │
├─────────────────────────────────────────────────────────┤
│               OPERADORES PWA (/pwa)                     │
│            Equipes de campo (externos)                   │
│   Módulos isolados: Transporte, Alimentação,            │
│   Alojamento, Coordenação, Delegação, Ao Vivo           │
└─────────────────────────────────────────────────────────┘
```

## Perfis e Permissões

| Perfil | Descrição | Onde acessa | Principais funcionalidades |
|--------|-----------|-------------|---------------------------|
| `super_admin` | Desenvolvedor/fornecedor | `/super` + `/admin` | Dashboard global, todos os eventos, logs, configurações |
| `admin` | Administrador do evento | `/admin` | Acesso total a todos os módulos |
| `secretaria` | Gestão cadastral | `/admin` | Credenciamento, importação, publicação, acessos |
| `coordenacao_tecnica` | Competição | `/admin` + `/pwa` | Regras, resultados, apuração |
| `coordenador_modalidade` | Modalidades específicas | `/admin` (filtrado) | Competição restrita às modalidades vinculadas |
| `mesario` | Registro em campo | `/pwa` (Ao Vivo) | Lançamento de eventos na partida |
| `arbitragem` | Arbitragem | `/pwa` (Ao Vivo) | Visualização de designações |
| `transporte` | Operador de transporte | `/pwa/transporte` | Viagens, embarque, scan QR |
| `alimentacao` | Operador de alimentação | `/pwa/alimentacao` | Consumo, janelas, scan QR |
| `alojamento` | Operador de alojamento | `/pwa/alojamento` | Ocupação, check-in, incidentes |
| `cde` | Comissão Disciplinar | `/admin` (limitado) | Processos disciplinares |
| `delegacao` | Chefe de delegação | `/pwa/delegacao` | Consulta da própria delegação |

## Público-alvo

- **Secretaria** — gestão cadastral, credenciamento, publicação
- **Coordenação Técnica** — competição, apuração, resultados, regras por prova
- **Coordenador de Modalidade** — competição restrita às modalidades vinculadas
- **Mesário** — registro de partidas em campo (PWA Ao Vivo)
- **Equipes operacionais** — transporte, alimentação, alojamento
- **Chefes de delegação** — consulta da própria delegação
- **Público** — resultados publicados oficialmente

## Escopo funcional

```
Importação (SIGECOM) → Credenciamento/QR → Logística → Competição (Regras → Estrutura → Confrontos → Agenda → Resultados) → Publicação → Evidências
```

## Fluxo de Trabalho Típico

1. **Cliente cria evento** no painel admin (nome, ano, datas)
2. **Importa participantes** via planilha SIGECOM (XLSX)
3. **Normaliza provas** — mapeia nomes importados para provas canônicas
4. **Credencia participantes** — check-in + emissão de credencial com QR
5. **Configura competição** — regras, fases, grupos, partidas via wizard
6. **Cria usuários operacionais** — convite por email para perfis logísticos
7. **Distribui links PWA** — via WhatsApp/email para operadores de campo
8. **Operadores trabalham** — scan QR, embarque, consumo, check-in
9. **Mesários lançam resultados** — via PWA Ao Vivo durante partidas
10. **Coordenador valida e publica** — resultado oficial com boletim

### Status dos módulos (Auditoria 2026-04-14)

| Módulo | Status | Notas |
|--------|--------|-------|
| Importação / Espelhamento SIGECOM | ✅ Pronto | Idempotente, tolerante a falhas, auditoria completa |
| Credenciamento + QR Code | ✅ Pronto | Check-in, emissão, reemissão, validação QR |
| Motor de Regras por Prova | ✅ Pronto | Presets, seed automático, editor individual e em lote |
| Central da Competição (Wizard) | ✅ Pronto | 7 passos para coletivas, 6 para individuais time/mark |
| Painel de Controle | ✅ Pronto | Visão consolidada de todas as provas |
| Classificação (Standings) | ✅ Pronto | Coletivas por grupo + ranking individual + cross-heat |
| Resultados e Governança | ✅ Pronto | Ciclo lançar→validar→publicar com boletim oficial |
| Combate (Judô, Karatê, etc.) | ✅ Pronto | combat_detail JSONB, CombatResultForm, auto-detecção |
| Transporte | ✅ Pronto | CRUD + embarque + relatórios |
| Alimentação | ✅ Pronto | CRUD + consumo + dashboard + relatórios |
| Alojamento | 🟡 Parcial | CRUD + ocupação com trigger, falta mapa visual |
| PWA Operacional | ✅ Pronto | 6 módulos isolados por perfil |
| PWA Ao Vivo | ✅ Pronto | Interface touch-friendly, dark mode, offline |
| Super Admin | ✅ Pronto | Dashboard global, logs, config |
| Publicação Oficial | 🟡 Parcial | RLS anon funcional, sem portal público |
| Evidências / OSC | ⛔ Não iniciado | Apenas match-attachments existem |
| Configurações | ✅ Pronto | Parâmetros, irregularidades, normalização, validador, mapa |

## O que NÃO faz

- Inscrição de participantes (feita exclusivamente no SIGECOM)
- Alteração de dados no sistema oficial (SIGECOM)
- Gestão financeira
- Comunicação/marketing
- Streaming/transmissão de jogos
