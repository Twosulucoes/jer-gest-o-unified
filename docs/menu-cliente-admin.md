# Menu do Cliente Admin — Estrutura Completa

Última atualização: 2026-04-17 (Refatoração Global vs Etapa)

## Princípio fundamental

O sistema separa rigidamente dois contextos:

- **GLOBAL (`/admin`)** — preparação, configuração, acessos, relatórios consolidados. **Nunca** contém módulos operacionais de etapa.
- **ETAPA (`/admin/etapa/:stageId/...`)** — credenciamento, competição, logística, ocorrências, pesquisa, relatórios da etapa. **Nunca** contém itens do Global.

A ponte entre os dois é feita por **um único botão**:
- No Global: **"Entrar na Etapa"** → vai para `/admin/etapas` (seletor).
- Na Etapa: **"Sair da Etapa"** → volta para `/admin`.

---

## Menu Global (`/admin`)

### Dashboard
- `/admin` — Home com KPIs do evento ativo

### Preparação (FolderOpen)
| Item | Rota | Perfis |
|------|------|--------|
| Eventos | `/admin/eventos` | admin, secretaria, coord. técnica |
| Delegações (Escolas) | `/admin/delegacoes` | admin, secretaria, coord. técnica |
| Participantes | `/admin/participantes` | admin, secretaria, coord. técnica |
| Importação | `/admin/importacao` | admin, secretaria |
| Normalização | `/admin/normalizacao-provas` | admin, secretaria, coord. técnica |
| Irregularidades | `/admin/irregularidades` | admin, secretaria, coord. técnica |
| Etapas | `/admin/etapas` | admin, secretaria, coord. técnica |

### Relatórios Globais (FileBarChart)
| Item | Rota | Perfis |
|------|------|--------|
| Central de Relatórios | `/admin/relatorios` | admin, secretaria, coord. técnica |

> Relatórios operacionais (Transporte, Alimentação, Alojamento, Competição) ficam **dentro da Etapa**.

### Acessos (Users)
| Item | Rota | Perfis |
|------|------|--------|
| Usuários Operacionais | `/admin/acessos/usuarios` | admin, secretaria |
| Links Externos | `/admin/links` | admin, secretaria |
| Vínculos Delegação | `/admin/acessos/delegacoes` | admin, secretaria |

### Configurações (Settings)
| Item | Rota | Perfis |
|------|------|--------|
| Parâmetros do Evento | `/admin/parametros-evento` | admin, secretaria, coord. técnica |
| Locais de Competição | `/admin/locais` | admin, secretaria, coord. técnica |
| Modalidades | `/admin/modalidades` | admin, secretaria, coord. técnica |
| Categorias | `/admin/categorias` | admin, secretaria, coord. técnica |
| Modelos de Credencial | `/admin/credenciais/modelos` | admin, secretaria, coord. técnica |

### Sistema (Cog)
| Item | Rota | Perfis |
|------|------|--------|
| Diagnóstico do Sistema | `/admin/sistema/diagnostico` | admin, secretaria, coord. técnica |
| Demo/Seeds | `/admin/demo` | admin, coord. técnica |

### CTA dedicada
**"Entrar na Etapa"** (botão destacado no topo da sidebar) → leva ao seletor `/admin/etapas`.

---

## Menu Etapa (`/admin/etapa/:stageId/...`)

Banner fixo no topo identifica a etapa ativa. Botão **"Sair da Etapa"** no header retorna ao Global.

| Módulo | Rota | Perfis |
|--------|------|--------|
| Visão Geral | `/admin/etapa/:stageId` | admin, secretaria, coord. técnica |
| Credenciamento | `/admin/etapa/:stageId/credenciamento` | admin, secretaria, coord. técnica |
| Validação QR | `/admin/etapa/:stageId/validacao-qr` | admin, secretaria, coord. técnica, transporte, alimentação |
| Competição → Painel | `/admin/etapa/:stageId/competicao/painel` | admin, secretaria, coord. técnica |
| Competição → Pré-validação | `/admin/etapa/:stageId/competicao/pre-validacao` | admin, secretaria, coord. técnica |
| Competição → Central | `/admin/etapa/:stageId/competicao/central` | admin, secretaria, coord. técnica |
| Competição → Partidas e Agenda | `/admin/etapa/:stageId/competicao/partidas-agenda` | admin, secretaria, coord. técnica |
| Competição → Regras por Prova | `/admin/etapa/:stageId/competicao/regras` | admin, secretaria, coord. técnica |
| Competição → Resultados | `/admin/etapa/:stageId/competicao/resultados` | admin, secretaria, coord. técnica |
| Competição → Boletins | `/admin/etapa/:stageId/boletins` | admin, secretaria, coord. técnica |
| Transporte → Veículos / Rotas / Viagens | `/admin/etapa/:stageId/transporte/*` | admin, secretaria, coord. técnica, transporte |
| Alimentação → Tipos / Janelas / Consumo / Dashboard | `/admin/etapa/:stageId/alimentacao/*` | admin, secretaria, coord. técnica, alimentação |
| Alojamento → Locais / Unidades / Ocupação | `/admin/etapa/:stageId/alojamento/*` | admin, secretaria, coord. técnica |
| Ocorrências | `/admin/etapa/:stageId/ocorrencias` | admin, secretaria, coord. técnica |
| Pesquisa | `/admin/etapa/:stageId/pesquisa` | admin, secretaria |
| Relatórios da Etapa | `/admin/etapa/:stageId/relatorios` | admin, secretaria, coord. técnica |

---

## Redirecionamento de URLs legadas

Acessos a rotas antigas (sem `etapa/:stageId`) caem no componente `RedirectToEtapas`:

1. Se houver `jer_last_active_stage_id` no `localStorage` → redireciona para a versão escopada (`/admin/etapa/<id>/<modulo>`).
2. Caso contrário → redireciona para `/admin/etapas` com toast "Selecione uma etapa primeiro".

URLs cobertas: `/admin/credenciamento`, `/admin/competicao/*`, `/admin/transporte/*`, `/admin/alimentacao/*`, `/admin/alojamento/*`, `/admin/ocorrencias`, `/admin/boletins`.

---

## Auditoria

A entrada e saída do contexto de Etapa registra eventos em `public.audit_events`:

| Action | Quando | Payload |
|--------|--------|---------|
| `stage_enter` | Mount do `StageLayout` | `{ event_id, stage_name, stage_kind }` |
| `stage_exit` | Unmount do `StageLayout` | `{ event_id, stage_name, stage_kind }` |

---

## Mapa de perfis com acesso à Etapa

- **admin**, **secretaria**, **coordenacao_tecnica** — acesso total.
- **transporte**, **alimentacao** — acesso aos seus módulos dentro da Etapa.
- **coordenador_modalidade** — Competição filtrada por suas modalidades.
- **delegacao** — **NÃO** acessa Web. Usa exclusivamente o PWA.
- **mesario / arbitragem** — apenas `/aovivo`.
