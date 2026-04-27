# Menus e Status de Implementação — JER Gestão

> Fonte única de verdade: `src/config/systemMap.ts`
> Auditoria atualizada em 2026-04-28 (Correções pós-auditoria) — Fim da Etapa 7.

## Critérios de Classificação

| Status | Critérios |
|--------|-----------|
| ✅ Feito | CRUD/fluxo principal funcionando; RLS ok; filtros por event_id; estados vazios/erro/loader ok |
| 🟡 Parcial | Tela existe com alguma integração, mas falta RLS/filtros, fluxos críticos, validações ou UX operacional |
| ⛔ Não iniciado | Placeholder, rota inexistente ou mock total |

## Mapa Atual

### Preparação
| Módulo | Rota | Status |
|--------|------|--------|
| Eventos | `/admin/eventos` | ✅ Feito |
| Instituições | `/admin/instituicoes` | ✅ Feito |
| Delegações | `/admin/delegacoes` | ✅ Feito |
| Importação (SIGECOM) | `/admin/importacao` | ✅ Feito |
| Participantes | `/admin/participantes` | ✅ Feito |

### Credenciamento
| Módulo | Rota | Status |
|--------|------|--------|
| Credenciamento | `/admin/credenciamento` | ✅ Feito |
| Modelos de Credencial | `/admin/credenciais/modelos` | ✅ Feito |
| Validação QR | `/admin/validacao-qr` | ✅ Feito |

### Competição
| Módulo | Rota | Status |
|--------|------|--------|
| Painel da Competição | `/admin/competicao/painel` | ✅ Feito |
| Painel Score (Modalidade) | `/admin/competicao/painel-score/:id` | ✅ Feito |
| Painel Sets (Modalidade) | `/admin/competicao/painel-sets/:id` | ✅ Feito |
| Painel Combat (Modalidade) | `/admin/competicao/painel-combat/:id` | ✅ Feito |
| Painel Time/Mark (Modalidade) | `/admin/competicao/painel-time-mark/:id` | ✅ Feito |
| Pré-validação | `/admin/competicao/pre-validacao` | ✅ Feito |
| Central da Competição | `/admin/competicao/central` | ✅ Feito |
| Modalidades | `/admin/modalidades` | ✅ Feito |
| Categorias | `/admin/categorias` | ✅ Feito |
| Fases | `/admin/competicao/fases` | 🟡 Parcial |
| Grupos | `/admin/competicao/grupos` | 🟡 Parcial |
| Equipes | `/admin/competicao/equipes` | 🟡 Parcial |
| Partidas | `/admin/competicao/partidas` | 🟡 Parcial |
| Agenda | `/admin/competicao/agenda` | 🟡 Parcial |
| Resultados | `/admin/competicao/resultados` | 🟡 Parcial |
| Lançamento Score | `/admin/competicao/painel-score/:id/confronto/:matchId/resultado` | ✅ Feito |
| Lançamento Sets | `/admin/competicao/painel-sets/:id/confronto/:matchId/resultado` | ✅ Feito |
| Lançamento Combat | `/admin/competicao/painel-combat/:id/confronto/:matchId/resultado` | ✅ Feito |
| Regras por Prova | `/admin/competicao/regras` | ✅ Feito |
| Regras em Lote | `/admin/competicao/regras/lote` | ✅ Feito |
| Diagnóstico | `/admin/diagnostico-competicao` | ✅ Feito |

### Logística › Transporte
| Módulo | Rota | Status |
|--------|------|--------|
| Veículos | `/admin/transporte/veiculos` | 🟡 Parcial |
| Rotas | `/admin/transporte/rotas` | 🟡 Parcial |
| Viagens | `/admin/transporte/viagens` | 🟡 Parcial |

### Logística › Alimentação
| Módulo | Rota | Status |
|--------|------|--------|
| Refeições | `/admin/alimentacao/tipos` | ✅ Feito |
| Janelas | `/admin/alimentacao/janelas` | ✅ Feito |
| Consumo | `/admin/alimentacao/consumo` | 🟡 Parcial |

### Logística › Alojamento
| Módulo | Rota | Status |
|--------|------|--------|
| Locais de Alojamento | `/admin/alojamento/locais` | ✅ Feito |
| Unidades | `/admin/alojamento/unidades` | ✅ Feito |
| Ocupação | `/admin/alojamento/ocupacao` | 🟡 Parcial |

### Cadastros
| Módulo | Rota | Status |
|--------|------|--------|
| Locais de Competição | `/admin/locais` | ✅ Feito |

### Acessos
| Módulo | Rota | Status |
|--------|------|--------|
| Gestão de Usuários | `/admin/acessos/usuarios` | ✅ Feito |
| Vínculos Delegação | `/admin/acessos/delegacoes` | 🟡 Parcial |

### Configurações
| Módulo | Rota | Status |
|--------|------|--------|
| Parâmetros do Evento | `/admin/parametros-evento` | ✅ Feito |
| Irregularidades | `/admin/irregularidades` | ✅ Feito |
| Normalização de Provas | `/admin/normalizacao-provas` | ✅ Feito |
| Validador de Estrutura | `/admin/schema/validador` | ✅ Feito |
| Mapa do Sistema | `/admin/mapa` | ✅ Feito |

### Extras
| Módulo | Rota | Status |
|--------|------|--------|
| Boletins Oficiais | `/admin/boletins` | 🟡 Parcial |
| Central de Dados | `/admin/dados` | ✅ Feito |
| Demo Seeds | `/admin/demo` | ✅ Feito |
| Email Templates | `/admin/auth/email-templates` | ✅ Feito |
| Pesquisa (Dashboard) | `/admin/pesquisa` | 🟡 Parcial |
| Links | `/admin/links` | ✅ Feito |
| Relatórios | `/admin/relatorios` | 🟡 Parcial |
| QR Atleta | `/admin/atletas/qrcode` | ✅ Feito |

## Resumo

- **Total de rotas admin**: 38
- **✅ Feitas**: 23
- **🟡 Parciais**: 15
- **⛔ Não iniciadas**: 0

### PWA (28 rotas)
- Alojamento: 7 telas
- Transporte: 5 telas
- Alimentação: 5 telas
- Coordenação: 6 telas
- Delegação: 5 telas
- Pesquisa: 4 telas (auth por PIN)
- Ao Vivo: 3 telas (lazy loaded)
- Diagnóstico: 1 tela
- Auth: 3 telas (login, recover, set-password)
