# Auditoria Operacional: Módulo de Alimentação — JER Gestão
**Data:** 2026-05-03
**Status Global:** 🟡 OPERACIONAL COM RESSALVAS — evolução para controle por refeição/dia/presença em curso

> Este documento substitui as auditorias anteriores e incorpora um novo diagnóstico
> 360º do módulo de Alimentação, com o objetivo de alinhar o sistema ao modelo
> operacional real do JER (refeição × dia × presença efetiva no evento). O histórico
> das auditorias anteriores está preservado ao final.

---

## 1. Levantamento do Estado Atual

### 1.1 Telas e fluxos existentes

#### Admin (`/admin/alimentacao` e `/admin/etapa/:stageId/alimentacao`)
| Tela | Rota | Função |
|:---|:---|:---|
| Hub de Alimentação | `/alimentacao` | Painel de entrada com cards para subseções e gestão de Tipos/Janelas por etapa. |
| Tipos de Refeição | `/alimentacao/tipos` | CRUD de `meal_types` (café, almoço, jantar, lanche). |
| Locais de Refeição | `/alimentacao/locais` | CRUD de `meal_locations` (refeitórios, sedes, capacidade). |
| Padrões de Janelas | `/alimentacao/padroes` | Modelos reutilizáveis de janelas por etapa. |
| Janelas | `/alimentacao/janelas` | CRUD de `meal_windows` (data + horário + tipo + local + capacidade + elegibilidade). |
| Previsão de Demanda | `/alimentacao/previsao` | Cálculo previsto × realizado por janela; exportação XLSX/PDF para a cozinha. |
| Consumo (Consolidado) | `/alimentacao/consumo` | Consulta paginada de `meal_consumptions`, filtros por janela/método/busca. |
| Dashboard | `/alimentacao/dashboard` | Indicadores agregados de execução. |
| Relatórios | `/alimentacao/relatorios` | Exportação para buffet/prestação de contas. |
| Divergências | `/alimentacao/divergencias` | Recusas (`meal_incidents`) e ausências de consumo por janela. |

#### PWA (`/pwa/alimentacao`)
| Tela | Rota | Função |
|:---|:---|:---|
| Home | `/pwa/alimentacao` | Atalhos para escanear, buscar manual, ver janelas/consumos. |
| Scanner | `/pwa/alimentacao/scan` | Leitura de QR (credencial ou voucher) + busca manual; registro em `meal_consumptions`. |
| Busca Manual | `/pwa/alimentacao/buscar` | Pesquisa de pessoas no evento por nome/CPF (somente consulta). |
| Janelas do Dia | `/pwa/alimentacao/janelas` | Lista de janelas vigentes por etapa, com cache offline. |
| Histórico/Consumos | `/pwa/alimentacao/consumos` | Lista local de consumos efetuados pelo operador. |

#### Modelo de dados envolvido
- `meal_types(event_id, name, slug, sort_order, is_active)`
- `meal_windows(event_id, event_stage_id, meal_type_id, label, service_date, start_time, end_time, location/capacity, meal_window_location_id, is_active)`
- `meal_window_eligibility(meal_window_id, eligibility_type, participant_type_value, reference_id)` — regras por perfil/delegação/instituição.
- `meal_window_patterns` — modelos reutilizáveis por etapa.
- `meal_locations(event_id, name, capacity, is_active)`
- `meal_consumptions(meal_window_id, participant_id, consumed_at, registered_by, method)` com `UNIQUE (meal_window_id, participant_id)`.
- `meal_incidents(meal_window_id, participant_id?, incident_type, incident_at, registered_by, is_offline, device_info)` com enum `meal_incident_type` (`NOT_ELIGIBLE | OUTSIDE_WINDOW | DUPLICATE | VOUCHER_INVALID | VOUCHER_REVOKED | VOUCHER_EXPIRED | VOUCHER_ALREADY_USED | OTHER`).
- `meal_forecast_exports` — trilha de exportações da previsão.

#### Status que o sistema usa hoje para representar pessoas no evento
| Conceito | Onde mora | Significado prático |
|:---|:---|:---|
| Inscrito | `participants(status, is_active)` + `participant_event_stages` | Pessoa cadastrada no evento/etapa. |
| Confirmado | `participants.regular_attendance_confirmed` | Confirmação administrativa de participação. |
| Credenciado | `participants.credentialed_at` | Data/hora em que recebeu/ativou a credencial física. |
| Hospedado | `lodging_occupancies.checked_in_at` (sem `checked_out_at`) | Está alojado em uma unidade de hospedagem. |
| Saída registrada | `lodging_occupancies.checked_out_at` | Já fez checkout do alojamento. |
| Necessita alimentação | `participants.needs_meals` | Inscrição declarou consumo de refeições no evento. |

> **Não existe hoje** um conceito formal de "presença no evento por dia"
> independente do alojamento. A liberação atual usa apenas
> `is_active = true` + `credentialed_at IS NOT NULL` como prova de presença.

### 1.2 Como funciona hoje (operação real)
- O scanner do PWA registra consumo a partir do QR da credencial: valida `is_active` e `credentialed_at` antes de inserir em `meal_consumptions`. Se já existe consumo na janela, recusa e grava `meal_incidents.DUPLICATE`.
- O scanner também aceita **voucher** (uso único/múltiplo) e **busca manual** (nome/CPF). A busca manual atualmente **não aplica a trava de presença/credencial** — ver seção 2.
- Janelas têm capacidade opcional. Quando atingida, o PWA exibe alerta visual amarelo, **sem bloquear consumo** (alerta operacional, não trava).
- O cache offline armazena janelas do dia em `localStorage`. Consumos feitos offline vão para uma fila de sincronização.
- A previsão de demanda multiplica regras de elegibilidade pelo total de participantes do evento/etapa retornado por `get_participant_counts_by_*`. A função **não filtra por `credentialed_at`** nem por dia de presença efetiva.
- A página de Divergências calcula "ausências" comparando todos os participantes elegíveis (regras de janela) contra a tabela de consumos — sem considerar se a pessoa já chegou ao evento ou se já fez checkout.

### 1.3 Chegada tardia e saída antecipada
- **Chegada tardia:** o sistema não tem a noção de "data prevista de chegada". A pessoa só passa a poder consumir quando recebe `credentialed_at`. Antes disso, aparece como "ausência" em todas as janelas anteriores ao credenciamento, distorcendo a Divergências.
- **Saída antecipada:** o único registro de saída é `lodging_occupancies.checked_out_at` (apenas para quem está alojado). Após a saída, **nada impede** que a pessoa continue elegível ou seja registrada manualmente em refeições futuras (a trava só vale para QR/credencial).
- **Por dia × por etapa:** janelas têm `service_date`, mas a presença é avaliada como booleana (credenciado ou não). Não há controle por dia.

### 1.4 Trava de liberação (quem pode comer)
| Caminho | Verifica `is_active`? | Verifica `credentialed_at`? | Verifica `needs_meals`? | Verifica não‑checkout? |
|:---|:---:|:---:|:---:|:---:|
| QR via credencial | ✅ | ✅ | ❌ | ❌ |
| QR via voucher | n/a (voucher) | n/a | n/a | n/a |
| Busca manual no scanner | ❌ | ❌ | ❌ | ❌ |
| Inserção via Admin (consolidado) | depende de RLS | ❌ | ❌ | ❌ |

### 1.5 Relatórios existentes para prestação de contas
- **Previsão × Realizado** (`AlimentacaoPrevisaoPage`): XLSX/PDF agrupando por janela; trilha de gerações em `meal_forecast_exports`.
- **Buffet** (`AlimentacaoRelatoriosPage`): XLSX do realizado por janela.
- **Divergências** (`AlimentacaoDivergenciasPage`): XLSX consolidando recusas e ausências.
- **Trilha de incidentes** (`meal_incidents`): registrada por operador, tipo e momento.
- **Trilha de exportações** (`meal_forecast_exports`): registra autor, formato, filtros e data.

---

## 2. Lacunas e Riscos Identificados

### 2.1 Críticos — afetam diretamente prestação de contas
1. **Busca manual no PWA bypassa a trava de presença.** O fluxo de QR exige `is_active` + `credentialed_at`, mas `handleManualPick` em `AlimentacaoScanPage` insere consumo sem validação. Operador com perfil `alimentacao` consegue registrar refeição para qualquer pessoa do evento, mesmo não credenciada.
2. **Enum `meal_incident_type` não cobre os motivos usados pelo código.** O scanner registra `recordIncident("NO_CREDENTIAL", …)` e `recordIncident("PARTICIPANT_INACTIVE", …)`, mas esses valores não existem no enum. As inserções **falham silenciosamente** (apenas `console.error`), ou seja, a trilha de auditoria de bloqueios por credencial está **vazia** hoje.
3. **RLS de `meal_windows` e `meal_locations` foi aberta para todos os autenticados.** A migration `20260503022945` aplicou `USING (true) WITH CHECK (true)` nas duas tabelas. Operadores com perfis sem privilégio (ex.: `delegacao`, `transporte`) podem inserir, alterar ou deletar janelas e locais. Quebra a matriz documentada em `docs/02-modelo-de-acesso-e-perfis.md`.
4. **Previsão de Demanda super‑estima.** `calculateForecast` parte do total de `participants` por perfil/delegação/instituição. Não desconta quem ainda não chegou (`credentialed_at IS NULL`) nem quem já fez checkout. Em dias de chegada/saída a planilha enviada à cozinha é falsa por excesso.
5. **Divergências infla "ausências".** A página marca como ausência todo participante elegível sem consumo na janela do dia, sem filtrar por presença efetiva. Isso gera alarmes falsos no dia de chegada/saída e em modalidades de um único dia.
6. **`needs_meals` é ignorado em todos os caminhos.** Mesmo o QR autoriza consumo de quem declarou que não precisa de alimentação (visitantes, delegados de ônibus, etc.). Em fechamento, esses consumos contam como custo legítimo na cozinha e abrem brecha de fraude.

### 2.2 Altos — afetam confiança operacional
7. **Sem trava de saída.** Após registro de checkout do alojamento, o participante continua elegível para refeições. Não existe consulta "está em vigência hoje?" centralizada.
8. **Validação de duplicidade só existe no DB e numa contagem JS racy.** O JS faz `select count` antes do insert e o DB mantém um `UNIQUE`. No caminho offline a verificação é apenas local — duas filas offline distintas podem gerar duplicidade no momento do sync, sem incidente claro.
9. **Operador não vê na busca manual o motivo de bloqueio.** Sem badges de "sem credencial" / "não precisa alim." / "checkout efetuado", a equipe perde tempo tentando registrar pessoas que serão recusadas.
10. **Sem visão por delegação para o perfil `delegacao`.** O perfil existe nos docs ("em desenvolvimento"), mas não há tela dedicada que mostre o consumo dos próprios atletas.

### 2.3 Médios — qualidade da experiência
11. **Estados vazios e de erro inconsistentes** em algumas telas (`AlimentacaoConsumoPage` mistura skeleton + texto sem padrão claro).
12. **Filtros de etapa frágeis.** Janelas legadas sem `event_stage_id` somem do filtro etapa‑restrito (foi removido o fallback). Se houver janelas antigas do início do evento, ficam invisíveis.
13. **Performance da busca manual** decai com volumes grandes — o JOIN com `participant_event_stages` é feito em duas chamadas, sem RPC dedicada.

---

## 3. Proposta de Evolução Orientada ao Negócio

### 3.1 Modelo operacional alvo
Adotar três conceitos de primeira classe:

1. **Refeição (Meal Type)** — café, almoço, jantar, lanche etc. (já existe).
2. **Janela vigente por dia** — `meal_windows.service_date` continua sendo a fonte de verdade (já existe). A elegibilidade passa a respeitar **a presença efetiva no dia** da janela.
3. **Presença efetiva no evento** — derivada de:
   - `participants.credentialed_at IS NOT NULL` (chegou ao evento), **e**
   - sem registro de saída válido para o dia da janela (vide 3.2), **e**
   - `participants.needs_meals = true` (declarou que vai comer), **e**
   - `participants.is_active = true`.

> Atleta inscrito ou confirmado **conta para previsão preliminar** (planejamento)
> mas **não conta para previsão diária** nem habilita o registro de consumo
> enquanto não houver credenciamento. Inscrição/confirmação ≠ presença.

### 3.2 Saída do evento (novo)
Introduzir o conceito de **"saída registrada"** independente de alojamento:
- Novo campo `participants.left_event_at TIMESTAMPTZ` (ou tabela
  `participant_event_exits` com motivo). Quando preenchido, **encerra a
  elegibilidade** a partir da data informada.
- Trigger de UI no Admin (botão "Registrar saída antecipada") com motivo
  obrigatório (`desistência`, `problema de saúde`, `convocação`, `outro`).
- A trava do scanner e a previsão diária passam a respeitar
  `service_date < left_event_at::date OR left_event_at IS NULL`.

### 3.3 Liberação para consumo (novo invariante)
> Pode consumir refeição em uma janela ⇔
> participante `is_active`, `needs_meals`, `credentialed_at IS NOT NULL`,
> `(left_event_at IS NULL OR service_date < left_event_at::date)` e
> não existe `meal_consumption` para `(meal_window_id, participant_id)`.

Aplicado **no PWA (todos os caminhos)** e **no DB via trigger** em
`meal_consumptions` para fechar a porta dos fundos (Admin/Manual).

### 3.4 Cenários de operação cobertos
**a) Atleta chega no penúltimo dia.**
- Antes do credenciamento: aparece como "Ausência prevista" nos relatórios de planejamento, **não** entra na previsão diária para a cozinha.
- Após credenciamento: passa a aparecer na previsão a partir da próxima janela; o histórico anterior do dia de chegada é fechado sem ausências falsas.

**b) Modalidade só no último dia.**
- A delegação informa data de chegada via importação ou a credencial é emitida no dia. Antes desse dia, esses atletas não inflam previsão nem ausência. No dia, todas as janelas a partir do credenciamento ficam habilitadas.

**c) Saída no terceiro dia, evento até o quarto.**
- Operador da delegação registra saída antecipada no Admin. A partir do dia seguinte (ou do horário, se a saída for no meio do dia, conforme regra escolhida), o atleta:
  - some da previsão diária da cozinha;
  - é recusado pelo scanner (QR/manual/voucher) com incident `NOT_ELIGIBLE`;
  - some da Divergências como ausência (foi corretamente excluído).

### 3.5 Relatórios afetados
- **Previsão de Demanda:** passa a usar a base "presentes hoje" (RPC nova). Mantém compatibilidade XLSX/PDF.
- **Divergências/Ausências:** filtra por presentes no dia da janela.
- **Buffet/Realizado:** sem mudança estrutural — apenas ganha confiança porque o realizado bate com a previsão presencial.
- **Trilha de incidentes:** ganha tipos novos (ver 4.2) para diferenciar bloqueios.

---

## 4. Plano de Execução Incremental

### Etapa 0 — **Auditoria e ajustes mínimos de risco baixo (este PR)**
Objetivo: reduzir erro operacional imediato sem alterar contratos.
- ✅ Diagnóstico publicado (este documento).
- ✅ **Trava de presença no fluxo manual do PWA** (paridade com QR). Bloqueia inserção quando `is_active=false`, `credentialed_at IS NULL` ou `needs_meals=false`.
- ✅ Mapeamento dos motivos de bloqueio para valores válidos do enum `meal_incident_type` (`NOT_ELIGIBLE`/`OTHER`) para que a trilha de incidentes pare de falhar silenciosamente.
- ✅ Badges de status (sem credencial / não precisa alim. / inativo) na lista de busca manual da tela de Scanner e na tela Buscar.

UI: muda apenas o resultado da busca manual e a mensagem de erro do scanner. Fluxo e relatórios existentes não mudam. Risco de regressão: **mínimo** (acrescenta validação onde antes não havia).

### Etapa 1 — Estender enum de incidentes e RLS
Objetivo: separar motivos de bloqueio e fechar permissões abertas.
- Migration ADD VALUE em `meal_incident_type` (`NO_CREDENTIAL`, `PARTICIPANT_INACTIVE`, `NEEDS_MEALS_FALSE`, `LEFT_EVENT`).
- Migration ajusta RLS de `meal_windows` e `meal_locations` para padrão `admin/secretaria` (write) + `alimentacao/coordenacao_tecnica` (read), removendo `USING (true)`.
- Atualiza scanner para emitir os novos tipos.

### Etapa 2 — Saída antecipada
- Migration: `participants.left_event_at TIMESTAMPTZ`, `left_event_reason TEXT`, `left_event_by UUID`.
- Tela Admin: botão "Registrar saída antecipada" com auditoria em `participant_audit_log`.
- Trigger no DB ao inserir `meal_consumptions` que valida vigência.

### Etapa 3 — Previsão por presença
- RPC `get_present_participant_counts(p_event_id, p_stage_id, p_service_date)` que aplica o invariante 3.3.
- `AlimentacaoPrevisaoPage`: usar a nova RPC para o cálculo do dia.
- Manter a previsão "planejamento total" como segunda métrica (comparação inscritos × presentes).

### Etapa 4 — Divergências por presença
- `AlimentacaoDivergenciasPage`: ausências passam a considerar apenas presentes no dia.
- Adicionar coluna "Motivo" com diferenciação entre "não consumiu" e "fora de vigência".

### Etapa 5 — Visão por delegação
- Tela `/pwa/delegacao/alimentacao` consultando consumos dos atletas da própria delegação.
- RLS de leitura: `delegacao` vê somente `participant.delegation_id = own_delegation_id`.

### Etapa 6 — Robustez offline
- Validar duplicidade entre filas offline ao sincronizar (resolução determinística pelo timestamp original).
- Conciliação visual de conflitos (já existe parcial via `VoucherConflictCentral`).

---

## 5. Estados de Interface e Qualidade

- Telas de Alimentação devem manter padrão `loading → empty → error → success` (skeleton, ícone + mensagem, alerta destrutivo, conteúdo).
- Validações de duplicidade: além do `UNIQUE` do DB, exibir incidente `DUPLICATE` na trilha sempre que houver bloqueio.
- Toda ação de write (criar/editar janela, registrar consumo, registrar incidente, registrar saída antecipada) deve persistir autor e instante. As tabelas envolvidas já têm `registered_by`, `created_at`, `updated_at`; a etapa 2 amplia a auditoria para saída.
- O console deve ficar livre de `console.error` em fluxos de incidente — falha de inserção precisa virar toast e métrica.

---

## 6. Permissões por Perfil (alvo)

| Ação | admin | secretaria | coord_tecnica | alimentacao | delegacao | publico |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| CRUD de tipos/locais/janelas/padrões | ✅ | ✅ | 👁 | 👁 | ❌ | ❌ |
| Registrar consumo (QR/voucher/manual) | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Ver dashboard/divergências/relatórios | ✅ | ✅ | ✅ | 👁 (operacional) | 👁 (somente própria) | ❌ |
| Registrar saída antecipada | ✅ | ✅ | ❌ | ❌ | 👁 (consulta) | ❌ |

> 👁 = somente leitura. Hoje o módulo viola esta matriz nas tabelas
> `meal_windows` e `meal_locations` (etapa 1 corrige).

---

## 7. Critérios de Pronto desta Auditoria

- ✅ Diagnóstico do estado atual com lista de telas, fluxos e gaps.
- ✅ Proposta de evolução com plano incremental por etapas.
- ✅ Implementação da Etapa 0 (trava de presença na busca manual + mapeamento de incidentes válidos + badges).
- ✅ Documentação atualizada (este arquivo, `docs/negocio/alimentacao.md`, `docs/12-glossario.md`, `README.md`).

---

## 8. Roteiro Curto de Teste Operacional (Etapa 0)

1. Login como perfil **alimentacao** no PWA. Acessar `/pwa/alimentacao/scan`.
2. Selecionar uma janela ativa do dia.
3. Buscar pelo nome de um atleta **não credenciado** (cadastrado mas sem `credentialed_at`).
   - **Esperado:** o item aparece com badge **"sem credencial"**; ao clicar, o sistema **bloqueia** o registro, mostra toast vermelho ("Participante não possui credencial ativa…") e grava `meal_incidents` com `incident_type='NOT_ELIGIBLE'`.
4. Buscar por um atleta com `needs_meals = false` (visitante/staff).
   - **Esperado:** badge **"não precisa alimentação"**; clique recusado com toast e incidente `NOT_ELIGIBLE`.
5. Buscar por um atleta com `is_active = false`.
   - **Esperado:** badge **"inativo"**; clique recusado.
6. Buscar por atleta credenciado, ativo e com `needs_meals = true`.
   - **Esperado:** badge **"OK"**; clique registra consumo normalmente, toast verde e contador de ocupação incrementa.
7. Repetir o caminho 6 — segunda tentativa: **bloqueado** com toast "Já registrado" e incidente `DUPLICATE`.
8. Conferir em `/admin/alimentacao/divergencias` (mesmo dia) que os incidentes acima aparecem na aba Recusas (com nome do operador e horário).

---

## Histórico de Auditorias (Preservado)

### 2026-04-28 (Fase 2 – Conclusão)
Entrega de trilha de recusas, relatório de divergências e exportação de realizado. Status: Operacional.

### 2026-04-28 (Fase 1)
Previsão de demanda, alertas de capacidade e cache offline. Status: Operacional.

### 2026-04-28 (Diagnóstico Inicial)
Identificada necessidade de inteligência preditiva e conciliação. Status: Lacunas Críticas.
