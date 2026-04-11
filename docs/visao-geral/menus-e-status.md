# Menus e Status de Implementação — JER Gestão

> Fonte única de verdade: `src/config/systemMap.ts`
> Sempre atualizar esse arquivo ao criar ou alterar telas.

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
| Modelos de Credencial | `/admin/credenciais/modelos` | 🟡 Parcial |
| Validação QR | `/admin/validacao-qr` | ✅ Feito |

### Competição
| Módulo | Rota | Status |
|--------|------|--------|
| Modalidades | `/admin/modalidades` | ✅ Feito |
| Categorias | `/admin/categorias` | ✅ Feito |
| Fases | `/admin/competicao/fases` | 🟡 Parcial |
| Grupos | `/admin/competicao/grupos` | 🟡 Parcial |
| Equipes | `/admin/competicao/equipes` | 🟡 Parcial |
| Partidas | `/admin/competicao/partidas` | 🟡 Parcial |
| Agenda | `/admin/competicao/agenda` | 🟡 Parcial |
| Resultados | `/admin/competicao/resultados` | 🟡 Parcial |

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
| Vínculos Delegação | `/admin/acessos/delegacoes` | 🟡 Parcial |

### Configurações
| Módulo | Rota | Status |
|--------|------|--------|
| Parâmetros do Evento | `/admin/parametros-evento` | ✅ Feito |
| Irregularidades | `/admin/irregularidades` | ✅ Feito |
| Normalização de Provas | `/admin/normalizacao-provas` | ✅ Feito |
| Validador de Estrutura | `/admin/schema/validador` | ✅ Feito |
| Mapa do Sistema | `/admin/mapa` | ✅ Feito |

## Resumo

- **Total**: 30 módulos
- **✅ Feitos**: 18
- **🟡 Parciais**: 12
- **⛔ Não iniciados**: 0
