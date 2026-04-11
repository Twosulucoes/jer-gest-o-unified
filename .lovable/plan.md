# Roadmap JER Gestão — P0 / P1 / P2

---

## 1. Roadmap Consolidado

| Fase | Épico | Entrega | Valor Operacional | Dependências | Prazo |
|------|-------|---------|-------------------|-------------|-------|
| **P0** | E0 | Anti-duplicidade alimentação | Impede fraude/erro de consumo duplicado | Nenhuma | Imediato |
| **P0** | E1 | Isolamento por event_id ativo | Segurança multi-evento; impede vazamento cruzado | Decisão técnica | Imediato |
| **P0** | E2 | RLS delegação restrita | Perfil delegacao vê apenas seus dados | E1 | Imediato |
| **P0** | E3 | Storage match-attachments privado | Anexos sensíveis protegidos | Nenhuma | Imediato |
| **P1** | E4 | Portal público de resultados | Público consulta resultados sem login | E1 | Curto prazo |
| **P1** | E5 | Workflow validação → publicação | Previne publicação acidental | Nenhuma | Curto prazo |
| **P1** | E6 | Relatórios operacionais | Visibilidade para coordenação | E0, E1 | Curto prazo |
| **P1** | E7 | Credenciamento UX | Eficiência operacional no dia do evento | Nenhuma | Curto prazo |
| **P2** | E8 | Evidências/OSC | Prestação de contas obrigatória | E1, E3 | Médio prazo |
| **P2** | E9 | Boletins oficiais PDF | Documentação oficial do evento | E5, E6 | Médio prazo |

---

## 2. Backlog Priorizado

### P0 — Bloqueadores Operacionais e Segurança

#### E0 — Anti-duplicidade Alimentação
- **US0.1**: Bloquear duplicidade de consumo por participante + janela
  - T0.1.1: Migration — UNIQUE `(participant_id, meal_window_id)` em `meal_consumptions`
  - T0.1.2: Frontend — tratar erro de constraint (23505) com mensagem amigável
  - T0.1.3: UI — feedback "Consumo já registrado para esta janela"

#### E1 — Isolamento por event_id ativo

**Decisão técnica recomendada: isolamento via frontend (Context + localStorage).**

Justificativa:
- JWT claim exigiria custom auth hook (complexo, frágil, não suportado nativamente pelo Lovable)
- `current_setting('app.event_id')` via `set_config` não funciona com connection pooling
- RLS atuais já exigem role válida; o risco é UX (ver dados de outro evento), não segurança
- **Solução pragmática**: Context `useEventContext` que filtra todas as queries + persistência localStorage

- **US1.1**: Seletor global de evento ativo
  - T1.1.1: Criar `useEventContext` (Context + Provider) com evento selecionado
  - T1.1.2: Componente seletor de evento no AdminLayout (header/sidebar)
  - T1.1.3: Persistir `event_id` no localStorage
  - T1.1.4: Auditar todas as queries para filtrar por `event_id`
  - T1.1.5: Guard — redirecionar para seleção se nenhum evento ativo

#### E2 — RLS Delegação Restrita
- **US2.1**: Perfil delegacao vê apenas sua delegação
  - T2.1.1: Migration — tabela `user_delegations (user_id, delegation_id)` + UNIQUE + RLS
  - T2.1.2: Função `get_user_delegation_ids(user_id)` (SECURITY DEFINER)
  - T2.1.3: Atualizar policies em `delegations`, `participants`, `participant_credentials`, `people`
  - T2.1.4: UI admin — tela para vincular user ↔ delegation

#### E3 — Storage match-attachments
- **US3.1**: Proteger anexos sensíveis
  - T3.1.1: Tornar bucket privado (`public = false`)
  - T3.1.2: Storage policies — SELECT/INSERT para roles autorizadas; negar anon
  - T3.1.3: Frontend — usar `createSignedUrl()` para visualização
  - T3.1.4: Ajustar `MatchAttachmentsCard`

---

### P1 — Visibilidade Operacional + Publicação

#### E4 — Portal Público de Resultados
- **US4.1**: Público consulta resultados publicados
  - T4.1.1: Rota `/resultados` (fora do `/admin`, sem ProtectedRoute)
  - T4.1.2: Página `ResultadosPublicosPage` — filtros por modalidade/categoria
  - T4.1.3: Query anon: `competition_match_results` WHERE `result_status = 'publicado'`
  - T4.1.4: Não expor CPF/nascimento — apenas nome e instituição
  - T4.1.5: RLS SELECT anon em tabelas auxiliares (`sports`, `categories`, `sport_events`, `competition_matches`, `competition_match_entries`, `teams`)

#### E5 — Workflow Validação → Publicação
- **US5.1**: Validar antes de publicar
  - T5.1.1: Botão "Validar" (→ `validado`, preenche `validated_at/by`)
  - T5.1.2: Botão "Publicar" habilitado somente se `validado`; preenche `published_at/by`
  - T5.1.3: Confirmação AlertDialog em ambas
  - T5.1.4: Botão "Despublicar" (volta para `validado`) com confirmação

#### E6 — Relatórios Operacionais
- **US6.1**: Relatório transporte (passageiros, check-ins, pendências)
- **US6.2**: Relatório alimentação (consumos por janela/tipo/delegação)
- **US6.3**: Relatório alojamento (ocupação vs capacidade)
  - T6.1: Views/queries agregadas por event_id
  - T6.2: Página `/admin/relatorios` com sub-rotas
  - T6.3: Export CSV

#### E7 — Credenciamento UX
- **US7.1**: Filtro por delegação + busca rápida
- **US7.2**: Ações batch separadas (emitir vs reemitir)

---

### P2 — Prestação de Contas e Oficialização

#### E8 — Evidências/OSC
- **US8.1**: Anexar evidências por contexto
  - T8.1.1: Tabela `evidences` (event_id, context_type, context_id, title, file_url, created_by, tags[])
  - T8.1.2: Bucket `evidences` (privado) + signed URLs
  - T8.1.3: Página `/admin/evidencias` + componente `EvidenceUploadCard`
  - T8.1.4: RLS — admin/secretaria ALL; áreas só seu context_type

#### E9 — Boletins Oficiais PDF
- **US9.1**: PDF de resultados por modalidade
- **US9.2**: PDF de relatório operacional
  - T9.1.1: Edge function `generate-bulletin`
  - T9.1.2: Storage + metadados
  - T9.1.3: Página `/admin/boletins`

---

## 3. Checklist de Migrations

### P0
| # | Migration | Intenção |
|---|-----------|---------|
| M0.1 | `add_unique_meal_consumption` | UNIQUE `(participant_id, meal_window_id)` em `meal_consumptions` |
| M0.2 | `create_user_delegations` | Tabela + função + RLS para vínculo user→delegação |
| M0.3 | `update_delegacao_rls` | Policies restritivas para `delegacao` em delegations, participants, credentials, people |
| M0.4 | `privatize_match_attachments` | Bucket privado + storage policies |

### P1
| # | Migration | Intenção |
|---|-----------|---------|
| M1.1 | `add_anon_rls_public_results` | SELECT anon em tabelas auxiliares para portal público |
| M1.2 | `create_report_views` | Views agregadas para relatórios (opcional) |

### P2
| # | Migration | Intenção |
|---|-----------|---------|
| M2.1 | `create_evidences` | Tabela `evidences` + RLS |
| M2.2 | `create_evidences_bucket` | Bucket privado + policies |
| M2.3 | `create_bulletins` | Tabela de metadados de boletins (se necessário) |

---

## 4. Checklist de Rotas/Telas Frontend

### P0
| Entrega | Tipo |
|---------|------|
| `useEventContext` + seletor de evento no AdminLayout | Componente global |
| Tela de vínculo user ↔ delegação | Admin (nova) |
| `MatchAttachmentsCard` → signed URLs | Ajuste existente |
| `AlimentacaoConsumoPage` → feedback duplicidade | Ajuste existente |

### P1
| Rota | Tipo |
|------|------|
| `/resultados` | Pública (nova) |
| `/admin/relatorios/transporte` | Admin (nova) |
| `/admin/relatorios/alimentacao` | Admin (nova) |
| `/admin/relatorios/alojamento` | Admin (nova) |
| `CompeticaoResultadosPage` → Validar/Publicar | Ajuste existente |
| `CredenciamentoPage` → filtro delegação | Ajuste existente |

### P2
| Rota | Tipo |
|------|------|
| `/admin/evidencias` | Admin (nova) |
| `/admin/boletins` | Admin (nova) |

---

## 5. Critérios de Aceite

### E0 — Anti-duplicidade
- [ ] INSERT duplicado retorna erro do banco
- [ ] Frontend exibe "Consumo já registrado para esta janela"
- [ ] Consumos legítimos continuam funcionando

### E1 — Isolamento event_id
- [ ] Seletor de evento visível no AdminLayout
- [ ] Todas as listagens filtram pelo evento selecionado
- [ ] Trocar evento atualiza queries
- [ ] Persiste entre reloads

### E2 — RLS Delegação
- [ ] User `delegacao` só vê sua(s) delegação(ões)
- [ ] Não consegue listar outras delegações
- [ ] Admin pode vincular user ↔ delegação

### E3 — Storage Privado
- [ ] Bucket não acessível por URL pública
- [ ] Upload/visualização no admin funciona via signed URL
- [ ] Anon bloqueado

### E4 — Portal Público
- [ ] Acessível sem login
- [ ] Somente resultados publicados
- [ ] Sem dados pessoais expostos

### E5 — Workflow Publicação
- [ ] Publicar exige validação prévia
- [ ] Campos validated/published preenchidos
- [ ] Confirmação AlertDialog

### E6 — Relatórios
- [ ] Dados filtrados por evento ativo
- [ ] Export CSV funcional

### E7 — Credenciamento UX
- [ ] Filtro por delegação funcional

### E8 — Evidências
- [ ] Upload vinculado a contexto
- [ ] Download via signed URL
- [ ] RLS por perfil

### E9 — Boletins PDF
- [ ] PDF gerado corretamente
- [ ] Armazenado com metadados

---

## 6. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Isolamento event_id via RLS é complexo | Alto | Usar isolamento frontend-only; RLS já exige role |
| Privatizar match-attachments quebra links | Médio | Migrar para signed URLs antes |
| Mapeamento user→delegation incompleto | Médio | UI admin para vincular; validar antes de ativar |
| Portal público expor dados pessoais | Alto | Whitelist de colunas; nunca expor CPF/birth_date |

---

## Ordem de Execução

```
E0 (duplicidade) → E1 (event context) → E3 (storage) → E2 (delegacao)
      ↓
E7 (credenciamento UX) → E5 (workflow) → E4 (portal público)
      ↓
E6 (relatórios) → E8 (evidências) → E9 (boletins)
```
