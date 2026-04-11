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
- Gestão de competições (fases, partidas, resultados)
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
| **Base Operacional (JER Gestão)** | Dados importados do SIGECOM + estado operacional gerado no JER Gestão (credenciais, QR, consumo, alojamento, partidas, logs). |
| **Importação / Espelhamento** | Processo técnico que transforma a exportação do SIGECOM em estrutura operacional no JER Gestão. Não constitui inscrição oficial. |
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
- [03 — Regras de Negócio](docs/03-regras-de-negocio.md)
- [04 — Módulos Operacionais](docs/04-modulos-operacionais.md)
- [07 — Fluxos Operacionais](docs/07-fluxos-operacionais.md)
- [Importação (SIGECOM)](docs/operacao/importacao-sigecom.md)
