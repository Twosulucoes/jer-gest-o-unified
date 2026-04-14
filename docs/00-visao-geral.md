# 00 — Visão Geral

## O que é o JER Gestão

Sistema de **gestão operacional** dos Jogos Escolares de Roraima (JER e JERPA). Gerencia toda a operação do evento após a fase de inscrição: credenciamento, logística, competição, apuração e publicação de resultados.

## Posicionamento do Sistema

- **Inscrição oficial**: realizada exclusivamente no sistema oficial do evento (SIGECOM), conforme Regulamento Geral (Art. 58–60).
- **JER Gestão**: importa/espelha os dados do SIGECOM para montar a **base operacional do evento** — usada para execução de campo, rastreabilidade e prestação de contas.
- **O JER Gestão NÃO substitui o SIGECOM** e NÃO cria inscrições oficiais.

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

### Status dos módulos (Auditoria 2026-04-14)

| Módulo | Status | Notas |
|--------|--------|-------|
| Importação / Espelhamento SIGECOM | ✅ Pronto | Idempotente, tolerante a falhas, auditoria completa |
| Credenciamento + QR Code | ✅ Pronto | Check-in, emissão, reemissão, validação QR |
| Motor de Regras por Prova | ✅ Pronto | Presets, seed automático, editor individual e em lote |
| Central da Competição (Wizard) | ✅ Pronto | 7 passos para coletivas, 6 para individuais time/mark |
| Painel de Controle | ✅ Pronto | Visão consolidada de todas as provas |
| Classificação (Standings) | ✅ Pronto | Coletivas por grupo + ranking individual + cross-heat |
| Resultados e Governança | 🟡 Parcial | Ciclo lançar→validar→publicar funciona, falta portal público |
| Combate (Judô, Karatê, etc.) | 🟡 Parcial | combat_detail JSONB existe, CombatResultForm criado, não integrado automaticamente |
| Transporte | 🟡 Parcial | CRUD funcional, falta relatórios e scan QR integrado |
| Alimentação | 🟡 Parcial | CRUD + consumo funcional, falta constraint anti-duplicidade e dashboard |
| Alojamento | 🟡 Parcial | CRUD + ocupação com trigger de capacidade, falta relatórios |
| PWA Operacional | 🟡 Parcial | 5 módulos PWA (alojamento, transporte, alimentação, coordenação, delegação) |
| PWA Ao Vivo | ✅ Pronto | Interface touch-friendly para mesários, dark mode, offline |
| Publicação Oficial | 🟡 Parcial | RLS anon funcional, sem portal público |
| Evidências / OSC | ⛔ Não iniciado | Apenas match-attachments existem |
| Configurações | ✅ Pronto | Parâmetros, irregularidades, normalização, validador, mapa |

## O que NÃO faz

- Inscrição de participantes (feita exclusivamente no SIGECOM)
- Alteração de dados no sistema oficial (SIGECOM)
- Gestão financeira
- Comunicação/marketing
- Streaming/transmissão de jogos
