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
- **Equipes operacionais** — transporte, alimentação, alojamento
- **Chefes de delegação** — consulta da própria delegação
- **Público** — resultados publicados oficialmente

## Escopo funcional

```
Importação (SIGECOM) → Credenciamento/QR → Logística → Competição (Regras → Estrutura → Confrontos → Agenda → Resultados) → Publicação → Evidências
```

### Módulos implementados
- ✅ Importação / Espelhamento SIGECOM
- ✅ Credenciamento + QR Code
- ✅ Competição (13 tabelas, wizard, lineup, eventos, placares)
- ✅ Motor de Regras por Prova (famílias, formatos, presets, seed automático)
- 🟡 Transporte, Alimentação, Alojamento (parciais)
- 🟡 Apuração e Publicação (parciais)
- ⛔ Evidências / OSC (não iniciado)

## O que NÃO faz

- Inscrição de participantes (feita exclusivamente no SIGECOM)
- Alteração de dados no sistema oficial (SIGECOM)
- Gestão financeira
- Comunicação/marketing
- Streaming/transmissão de jogos
