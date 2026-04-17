# Menu do Cliente Admin — Estrutura Completa

Última atualização: 2026-04-14

## Estrutura do Menu Lateral

### Dashboard
- **Rota:** `/admin`
- **Ícone:** Home
- **Perfis:** Todos

---

### Preparação (FolderOpen)
| Item | Rota | Perfis |
|------|------|--------|
| Eventos | `/admin/eventos` | admin, secretaria, coord. técnica |
| **Delegações (Escolas)** *(unificado)* | `/admin/delegacoes` | admin, secretaria, coord. técnica |
| Participantes | `/admin/participantes` | admin, secretaria, coord. técnica |
| Importação | `/admin/importacao` | admin, secretaria |
| Normalização | `/admin/normalizacao-provas` | admin, secretaria, coord. técnica |
| Irregularidades | `/admin/irregularidades` | admin, secretaria, coord. técnica |

> **Nota:** "Instituições" foi removido do menu (Fase 1). Escola e Delegação são tratadas como uma coisa só. Página `/admin/instituicoes` permanece acessível por URL até a Fase 3 (fusão no banco).

---

### Credenciamento (BadgeCheck)
| Item | Rota | Perfis |
|------|------|--------|
| Busca e Emissão | `/admin/credenciamento` | admin, secretaria, coord. técnica |
| Validação QR | `/admin/validacao-qr` | admin, secretaria, coord. técnica, transporte, alimentação |
| Modelos de Credencial | `/admin/credenciais/modelos` | admin, secretaria, coord. técnica |

---

### Competição (Trophy)
| Item | Rota | Perfis |
|------|------|--------|
| Painel de Controle | `/admin/competicao/painel` | admin, secretaria, coord. técnica |
| Pré-validação | `/admin/competicao/pre-validacao` | admin, secretaria, coord. técnica |
| Central da Competição | `/admin/competicao/central` | admin, secretaria, coord. técnica |
| **Partidas e Agenda** *(mesclado)* | `/admin/competicao/partidas-agenda` | admin, secretaria, coord. técnica |
| Regras por Prova | `/admin/competicao/regras` | admin, secretaria, coord. técnica |
| Regras em Lote | `/admin/competicao/regras/lote` | admin, secretaria, coord. técnica |
| Resultados | `/admin/competicao/resultados` | admin, secretaria, coord. técnica |
| Boletins Oficiais | `/admin/boletins` | admin, secretaria, coord. técnica |

> **Nota:** Fases (`/admin/competicao/fases`) e Grupos (`/admin/competicao/grupos`) foram removidos do menu — são gerenciados via wizard na Central da Competição. Acessíveis via URL direto.

---

### Logística (Truck)

#### Transporte
| Item | Rota | Perfis |
|------|------|--------|
| Veículos | `/admin/transporte/veiculos` | admin, secretaria, coord. técnica, transporte |
| Rotas | `/admin/transporte/rotas` | admin, secretaria, coord. técnica, transporte |
| Viagens | `/admin/transporte/viagens` | admin, secretaria, coord. técnica, transporte |

#### Alimentação
| Item | Rota | Perfis |
|------|------|--------|
| Tipos de Refeição | `/admin/alimentacao/tipos` | admin, secretaria, coord. técnica, alimentação |
| Janelas de Serviço | `/admin/alimentacao/janelas` | admin, secretaria, coord. técnica, alimentação |
| Consumo | `/admin/alimentacao/consumo` | admin, secretaria, coord. técnica, alimentação |
| **Dashboard** *(ativado)* | `/admin/alimentacao/dashboard` | admin, secretaria, coord. técnica, alimentação |

#### Alojamento
| Item | Rota | Perfis |
|------|------|--------|
| Locais | `/admin/alojamento/locais` | admin, secretaria, coord. técnica |
| Unidades | `/admin/alojamento/unidades` | admin, secretaria, coord. técnica |
| Ocupação | `/admin/alojamento/ocupacao` | admin, secretaria, coord. técnica |

---

### Relatórios (FileBarChart) — *NOVA SEÇÃO*
| Item | Rota | Perfis |
|------|------|--------|
| Competição | `/admin/relatorios` | admin, secretaria, coord. técnica |
| **Transporte** *(ativado)* | `/admin/transporte/relatorios` | admin, secretaria, coord. técnica, transporte |
| **Alimentação** *(ativado)* | `/admin/alimentacao/relatorios` | admin, secretaria, coord. técnica, alimentação |
| **Alojamento** *(ativado)* | `/admin/alojamento/relatorios` | admin, secretaria, coord. técnica |

---

### Pesquisa de Satisfação (MessageSquare)
| Item | Rota | Perfis |
|------|------|--------|
| Dashboard | `/admin/pesquisa` | admin, secretaria |
| Eventos de Pesquisa | `/admin/pesquisa/eventos` | admin, secretaria |
| Pesquisadores | `/admin/pesquisa/pesquisadores` | admin, secretaria |

---

### Acessos (Users)
| Item | Rota | Perfis |
|------|------|--------|
| Usuários Operacionais | `/admin/acessos/usuarios` | admin, secretaria |
| Links Externos | `/admin/links` | admin, secretaria |
| Vínculos Delegação | `/admin/acessos/delegacoes` | admin, secretaria |

---

### Configurações (Settings)
| Item | Rota | Perfis |
|------|------|--------|
| Parâmetros do Evento | `/admin/parametros-evento` | admin, secretaria, coord. técnica |
| Locais de Competição | `/admin/locais` | admin, secretaria, coord. técnica |
| Modalidades | `/admin/modalidades` | admin, secretaria, coord. técnica |
| Categorias | `/admin/categorias` | admin, secretaria, coord. técnica |

---

### Sistema (Cog)
| Item | Rota | Perfis |
|------|------|--------|
| **Diagnóstico do Sistema** *(mesclado)* | `/admin/sistema/diagnostico` | admin, secretaria, coord. técnica |
| Demo/Seeds | `/admin/demo` | admin, coord. técnica |

---

## Rotas acessíveis apenas via URL (sem link no menu)

| Rota | Página | Motivo |
|------|--------|--------|
| `/admin/competicao/fases` | CompeticaoFasesPage | Gerenciado via Central |
| `/admin/competicao/grupos` | CompeticaoGruposPage | Gerenciado via Central |
| `/admin/schema/validador` | SchemaValidadorPage | Ferramenta avançada |
| `/admin/auth/email-templates` | EmailTemplatesPage | Configuração avançada |
| `/admin/atletas/qrcode` | AtletaQrCodePage | Acesso via participante |
| `/admin/competicao/sincronizar-equipes` | SincronizarEquipesPage | Acesso via Central |
| `/admin/competicao/equipes` | CompeticaoEquipesPage | Acesso via Central |
| `/admin/dados` | CentralDadosPage | Acesso via Importação |

## Changelog de mesclagens

- **Partidas + Agenda** → `CompeticaoPartidasAgendaPage` com toggle Lista/Calendário
- **Mapa do Sistema + Diagnóstico Competição** → `SistemaDiagnosticoPage` com tabs
- **4 relatórios órfãos** ativados no menu (Transporte, Alimentação, Alojamento, Competição)
- **Dashboard Alimentação** ativado no menu
- **Fases e Grupos** removidos do menu (acessíveis via wizard na Central)
