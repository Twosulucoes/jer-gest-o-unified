# ROADMAP — Finalização do JER Gestão

> **Documento vivo.** Fila priorizada de tarefas derivada da [AUDITORIA](./AUDITORIA.md).
> Antes de começar qualquer tarefa: leia este arquivo e proponha o **próximo item da fila**.
> Ao concluir: atualize o status aqui, registre no [CHANGELOG](./CHANGELOG.md) e atualize a seção afetada da AUDITORIA,
> **na mesma entrega**. Nunca marque `Concluída` sem verificar (rodar, testar ou consultar) e sem citar a evidência.
> Descobriu algo novo? Abra uma nova tarefa no fim da fase adequada (próximo ID livre) e registre o achado na AUDITORIA.

*Última atualização: 2026-10-14 · criado na auditoria inicial.*

## Legenda

| Campo | Valores |
|---|---|
| **Status** | `A fazer` · `Em andamento` · `Bloqueada` (motivo na coluna Dependências) · `Concluída` (com data e evidência) · `Cancelada` (com motivo) |
| **Prioridade** | `P0` contenção imediata · `P1` bloqueia o lançamento · `P2` necessário antes do evento · `P3` melhoria/dívida |
| **Esforço** | P (até ½ dia) · M (1–3 dias) · G (mais de 3 dias) |
| **Dono** | `Usuário` = só o responsável pelo projeto pode fazer (painel, decisão, segredo). Vazio = Claude/time |
| **Critério de pronto** | Verificação objetiva que precisa passar. Sem ela, a tarefa não é concluída |

## Progresso

| Fase | Tarefas | Concluídas | % |
|---|---|---|---|
| 0 — Contenção de exposição | 9 | 0 | 0 % |
| 1 — Fundação: reprodutibilidade e rede de segurança | 8 | 0 | 0 % |
| 2 — Fluxos quebrados que bloqueiam a próxima edição | 11 | 0 | 0 % |
| **Bloqueantes de lançamento (Fases 0–2)** | **28** | **0** | **0 %** |
| 3 — Integridade de dados e conformidade | 8 | 0 | 0 % |
| 4 — Qualidade e dívida técnica | 13 | 0 | 0 % |
| 5 — Evolução de produto | 5 | 0 | 0 % |
| **Total** | **54** | **0** | **0 %** |

Cobertura funcional do sistema (método em [D-003](./DECISOES.md#d-003)): **≈ 61 %** em 2026-10-14.

## ▶ Próximo item da fila

**R-001** (dono: Usuário) — tornar o repositório privado. Em paralelo, a primeira tarefa técnica proposta é
**R-002** — remover a PII de árbitros do repositório e expurgá-la do histórico (exige aprovação para reescrever o histórico).
Depois: R-003 → R-004 → R-006 → R-005.

---

## Fase 0 — Contenção de exposição (P0)

Fecha o que está explorável hoje por qualquer pessoa na internet.

| ID | Tarefa | Achados | Status | Prior. | Esf. | Dono | Depende de | Critério de pronto |
|---|---|---|---|---|---|---|---|---|
| R-001 | Tornar o repositório GitHub privado | DOC-01, SEC-01 | A fazer | P0 | P | Usuário | — | API do GitHub retorna `visibility: private` |
| R-002 | Remover `docs/arbitros.csv` e `docs/realtorio árbitro` do HEAD e expurgar do histórico (`git filter-repo`), avaliar forks/clones e registrar comunicação ao DPO | DOC-01 | A fazer | P0 | P + G | Claude + Usuário (aprova force-push) | R-001 | Arquivos ausentes do HEAD; `git log --all -- 'docs/arbitros.csv'` vazio num clone novo; registro da decisão de comunicação em DECISOES |
| R-003 | Rotacionar a chave da Evolution API; movê-la (e URL/telefone) para secrets; HTTPS; `send-cde-*` passam a receber só `case_id`, buscar dados no banco e exigir JWT/papel na de decisão; publicar `send-cde-decision-notification` | EF-03, SEC-01 | A fazer | P0 | P | Claude + Usuário (rotação no servidor Evolution) | — | `rg` pela chave antiga = 0 no HEAD; chave antiga rejeitada pela Evolution; POST sem `case_id` válido → 400; decisão sem JWT `cde`/`admin` → 401/403 |
| R-004 | `admin-users`: checar `isProtectedTarget` + `callerMayModifyTarget` em toda ação que gera link ou altera conta; restringir geração de link a admin/super; não devolver link para usuário existente; matriz de concessão de papéis; fixar `redirectTo`; tirar `stack` | EF-01, EF-02 | A fazer | P0 | P | — | — | Teste (script ou Deno) com usuário `coordenador_modalidade`: `generate_reset_link`/`reset_password`/`resend_invite`/`invite_user` para alvo admin e super_admin → 403 e sem `action_link`; `set_roles` em si mesmo → 403 |
| R-005 | `REVOKE EXECUTE ... FROM PUBLIC, anon` em todas as funções de `public`/`alojamento`; `GRANT` explícito só às RPCs públicas legítimas (lista documentada na AUDITORIA); guarda `has_role` nas RPCs de escrita/PII; `auth.uid()` no lugar de `p_registered_by`/`p_boarded_by` | DB-03 | A fazer | P0 | M | — | inventário das RPCs chamadas como anon | Advisor `anon_security_definer_function_executable` lista apenas as RPCs públicas documentadas; chamada anon a `rpc_launch_match_result` e `bot_get_full_context` → erro 42501; PWAs públicos (pesquisa, substituição, `/atleta`) continuam funcionando (smoke) |
| R-006 | Migration de políticas: `user_roles` sem auto-concessão de admin/super (DB-01); `DROP` das 3 políticas com `user_metadata` (DB-02); `lodging_presence_logs` (DB-07); CDE e `substitution_documents` sem leitura/escrita anon direta, via RPC por token (LIVE-02); `audit_events`/`performance_logs` (DB-09) | DB-01, DB-02, DB-07, DB-09, LIVE-02 | A fazer | P0 | M | — | telas CDE públicas adaptadas a RPC | Advisor `rls_references_user_metadata` = 0; `select` anon em `cde_cases`, `cde_attachments`, `lodging_presence_logs` → 0 linhas/negado; secretaria inserindo `super_admin` em `user_roles` → erro; recurso público CDE ainda abre e consulta pelo token |
| R-007 | Autenticação nas Edge Functions abertas: `generate-bulletin` (JWT+papel ou segredo do trigger, homologação sempre), `send-substitution-email` (só `substitution_id`, HTML escapado), `process-alerts` e `monitoring-collect` (segredo de cron) | EF-04, EF-05, EF-07 | A fazer | P0 | P | — | cron atualizado para enviar segredo | Requisição só com anon key → 401 nas 4 funções; boletim só é gerado para resultados homologados; cron de monitoramento continua gravando métricas |
| R-008 | Bloquear usuário desativado no servidor (`ban_duration` no Auth ao desativar e/ou `has_role` exige `profiles.active`); impedir que o usuário altere o próprio `active`; importações não reativam contas | SEC-02, DB-15, EF-12 | A fazer | P0 | M | — | — | Usuário desativado: login via `/auth/v1/token` falha **ou** qualquer RPC protegida → 42501; `update profiles set active=true` pelo próprio usuário → negado |
| R-009 | CDE e storage: token de assinatura separado e de uso único (ou assinatura autenticada `cde`); buckets `substitution-docs`, `cde-attachments`, `transport-passenger-docs` privados com política por papel e limites de tamanho/MIME; upload anônimo por URL assinada | SEC-03, SEC-05, SEC-06, DB-06, DB-11 | A fazer | P0 | M | — | R-006 | Token de consulta não permite assinar; `storage.buckets.public = false` nos 3; anon não lista `temp/`; perfil `delegacao` não apaga documento de outra delegação |

## Fase 1 — Fundação: reprodutibilidade e rede de segurança (P1)

Sem isto, cada correção posterior é aplicada às cegas.

| ID | Tarefa | Achados | Status | Prior. | Esf. | Dono | Depende de | Critério de pronto |
|---|---|---|---|---|---|---|---|---|
| R-010 | Lockfile único: regenerar `bun.lock` contra registry.npmjs.org, remover `bun.lockb` e `package-lock.json`, `--frozen-lockfile` no CI e na Vercel | INF-02 | A fazer | P1 | P | — | — | `bun install --frozen-lockfile` passa num clone limpo fora da Lovable; `rg lovable-core-prod bun.lock` = 0 |
| R-011 | Baseline do schema: `supabase db diff` contra prod → migration de baseline versionando os objetos sem migration (CDE, Enquete, `substitution_documents`…); aplicar de forma controlada as migrations não aplicadas (alertas, `record_transport_boarding`); alinhar `schema_migrations`; regenerar `types.ts` | DB-10, LIVE-01, LIVE-03, LIVE-04, FE-10, DB-25 | A fazer | P1 | G | Claude + Usuário (janela para aplicar em prod) | R-005, R-006 | `supabase db diff` prod × migrations = vazio; `supabase migration list` sem divergência; `types.ts` regenerado sem os 21 objetos faltantes |
| R-012 | Edge Functions repo = prod: baixar o código publicado, reconciliar `admin-users`/`validate-qr`, remover `diag-vapid`, declarar `verify_jwt` por função no `config.toml`, deploy de todas as funções alteradas no CI | EF-14, INF-09 | A fazer | P1 | M | — | R-003, R-004, R-007 | `supabase functions download` de cada função == repo (diff vazio); `list_edge_functions` = conjunto do repo; CI publica as funções de `supabase/functions/**` alteradas |
| R-013 | Testes verdes e CI de PR: corrigir `appRoutesOrder.test.ts` e o teste de `PwaRefreshButton`; job de `pull_request` com `tsc --noEmit`, `vitest run` e `eslint` em modo não-regressão | FE-15, INF-05, QA-04 | A fazer | P1 | M | — | R-010 | `vitest run` 0 falhas; job de PR obrigatório e verde; PR que adiciona erro de tipo fica vermelho |
| R-014 | Ambientes: remover fallback para prod no client/scripts (falhar build sem env), variáveis por ambiente na Vercel, `version.json` gerado no build (fora do git) a partir de `VERCEL_ENV`, fonte única de versão, cron sem URL/chave hardcoded, documentar `.env` | INF-01, INF-04, INF-06, INF-12, FE-25 | A fazer | P1 | P | Claude + Usuário (variáveis na Vercel) | — | Build sem `VITE_SUPABASE_URL` falha; `/version.json` de prod mostra `environment: production` e ref de prod; BD de teste não chama prod |
| R-015 | `vercel.json` com `rewrites` (excluindo `/assets/*`) e cabeçalhos de segurança (CSP, HSTS, XFO/frame-ancestors, Referrer-Policy) | INF-03, SEC-11 | A fazer | P1 | P | — | — | `curl -I` em prod mostra os headers; asset inexistente → 404 (não `index.html`) |
| R-016 | Higiene de CI e git: remover step "Debug token", corrigir `sync-test-db.yml` (falha em todo push), remover `merge=union`, proteção de branch em `main` | INF-05, INF-07, INF-15, INF-18 | A fazer | P1 | P | Claude + Usuário (proteção de branch) | — | Último run de cada workflow verde em `main`; `.gitattributes` sem `merge=union`; `main` exige PR |
| R-017 | Fechar as lacunas de verificação da AUDITORIA §10 (projeto de teste, Vercel, Auth redirect URLs, schemas expostos, código publicado) | §10 | A fazer | P1 | P | Claude + Usuário (acessos) | — | Cada linha da §10 marcada como verificada com data e evidência, ou convertida em tarefa |

## Fase 2 — Fluxos quebrados que bloqueiam a próxima edição (P1)

| ID | Tarefa | Achados | Status | Prior. | Esf. | Dono | Depende de | Critério de pronto |
|---|---|---|---|---|---|---|---|---|
| R-018 | Roteamento por perfil: index de `/admin` calculado pelo perfil, rotas `/aovivo` e `/aovivo/partida/:matchId`, `/pwa/set-password` e `/pwa/registros`, política do coordenador de modalidade, mapa de redirecionamento único, menu sem 404, host correto em `import-referees` | FE-01, FE-02, FE-03, FE-08, FE-28 | A fazer | P1 | M | — | — | Teste automatizado: para cada um dos 14 papéis, o destino pós-login existe em `AppRoutes` e não cai em `/acesso-negado`; convite de teste define senha ponta a ponta; todos os itens do menu resolvem para rota existente |
| R-019 | Painéis de competição dentro da etapa (score, sets, combat, time/mark, ranking) e links internos (`MatchesTab`, `CentralArbitragemTab`, card Protestos) | FE-04 | A fazer | P1 | M | — | decisão registrada em DECISOES | "Abrir painel" abre a tela de lançamento para uma prova de cada família em `/admin/etapa/:id/...` (smoke manual ou e2e) |
| R-020 | Transporte: RPC `record_transport_boarding` disponível em prod; `TransporteRotasPage` lendo `transport_routes` com estado de erro; embarque PWA online e offline | LIVE-03, FE-09 | A fazer | P1 | P | — | R-011 (ou migration pontual) | `pg_proc` tem `record_transport_boarding`; embarque de teste no PWA grava em `transport_passengers`; fila offline sincroniza sem erro |
| R-021 | Alojamento: remover overload `get_alojamento_kpis(uuid)`, aplicar escopo de etapa em `AlojamentoOcupacaoPage`, tratar erro | QA-01, DOC-P02 | A fazer | P1 | P | — | — | Só uma assinatura em `pg_proc`; KPIs da página batem com `AlojamentoHomePage` para a mesma etapa |
| R-022 | Central de Alertas: criar `notifications`/`alert_rules` com RLS correta (sem INSERT aberto), cron de `process_alerts`, corrigir importação da chave VAPID | FE-31, DB-08, EF-07, LIVE-03 | A fazer | P1 | M | — | R-007, R-011 | `AlertasPage` lista e marca como lida sem erro; push de alerta chega em dispositivo de teste; anon não insere em `notifications` |
| R-023 | OSC: corrigir hooks em `PrestacaoContasOscPage`, QR de validação apontando para rota pública real com token do servidor, defaults fictícios só como placeholder | FE-12, FE-13 | A fazer | P1 | P | — | — | ESLint `rules-of-hooks` = 0; QR do PDF abre página que valida o relatório; salvar config sem editar não grava "00.000.000/0001-00" |
| R-024 | Boletins e publicação ponta a ponta: tabelas de vínculo boletim↔prova↔partida, fluxo lançar → homologar → boletim → publicar validado em uma prova real | LIVE-04, FE-10, EF-04 | A fazer | P1 | M | — | R-007, R-011 | Em homologação: 1 prova com boletim `publicado` e resultados `publicado`, vínculos gravados, sem `console.warn` de link |
| R-025 | Portal público, `/atleta/:id` e `/go/:slug`: decidir o que fica no ar; religar rotas; criar `athlete_public_tokens` ou ajustar `get_athlete_public_profile` | FE-06, FE-07, LIVE-04, DB-14 | A fazer | P1 | M | Usuário (decisão de produto) | R-024 | Decisão registrada; rotas escolhidas respondem 200 com dados publicados; QR de `/go` impresso resolve |
| R-026 | Remover fachadas: remediação simulada do Super Admin, botões sem ação, "Em breve" — implementar ou ocultar | FE-11, FE-16 | A fazer | P1 | M | — | — | `rg "setTimeout" src/components/super` sem simulação; nenhum `<Button>` sem `onClick`/`type=submit`/`asChild` nas telas listadas |
| R-027 | Bugs pontuais: `reportError` errado no QueryClient, falso erro ao gerar janelas de refeição, guardas de perfil nas rotas sensíveis do PWA | FE-21, FE-22, FE-20 | A fazer | P1 | P | — | — | Erro de mutação aparece em `monitoring_errors` com contexto; gerar janelas mostra sucesso; perfil `delegacao` em `/pwa/credenciamento/vincular` → acesso negado |
| R-028 | Estado de erro padrão (`QueryErrorState` em `src/components/shared/`) aplicado aos PWAs de campo e às mutações sem `onError` | FE-14 (PWAs), FE-23 | A fazer | P1 | M | — | — | Com rede desligada ou RLS negando, as telas dos PWAs mostram erro (não "vazio"); 0 `useMutation` sem `onError` |

## Fase 3 — Integridade de dados e conformidade (P2)

| ID | Tarefa | Achados | Status | Prior. | Esf. | Dono | Depende de | Critério de pronto |
|---|---|---|---|---|---|---|---|---|
| R-029 | Dados estimados de alimentação: identificar e marcar as linhas da migration de Bonfim/Normandia (e o seed `exec_fisica_demo`), excluí-las de `get_osc_execucao_fisica` e das views `vw_consumo_*`, avaliar retificação de relatórios já entregues | DB-04 | A fazer | P2 | M | Usuário (decisão de negócio/jurídica) | — | Linhas marcadas com método distinto; relatórios OSC recalculados sem elas; decisão registrada |
| R-030 | Credencial e QR não forjáveis (código aleatório no servidor + assinatura), fim do fallback por CPF para perfis não-credenciamento, auditoria de buscas | FE-05, EF-11 | A fazer | P2 | M | — | decisão de formato | QR montado à mão é recusado; busca por CPF restrita e auditada |
| R-031 | RLS por etapa como `RESTRICTIVE`; leitura `USING (true)` substituída por escopo; views com `security_invoker`; grants mínimos | DB-05, DB-12, DB-14, DB-16 | A fazer | P2 | M | — | R-011 | Advisor `security_definer_view` = 0; usuário de etapa A não escreve em consumo da etapa B; delegação A não lê casos da delegação B |
| R-032 | IA e LGPD: não enviar CPF/nascimento a provedores; decidir sobre DeepSeek; limites e papéis no `ai-chat` | EF-09, EF-08 | A fazer | P2 | P | Usuário (DPO) | — | Payload enviado à IA sem CPF (log); `ai-chat` rejeita `role:system` e excesso de mensagens |
| R-033 | Step-up de senha validado no servidor (token de curta duração consumido pela RPC de homologação) | EF-10 | A fazer | P2 | M | — | — | Chamar `rpc_homologate_match_result` sem token válido → erro |
| R-034 | Identificadores gerados no servidor e brute force: PIN de pesquisa (rate limit global, ≥ 6 dígitos), sorteio da enquete por RPC registrada, protocolo CDE e código de voucher por sequência | SEC-08, FE-24, FE-26 | A fazer | P2 | M | — | — | `rg "Math.random" src` só em usos não sensíveis; 6ª tentativa de PIN errado bloqueia independentemente de `device_id` |
| R-035 | Dependências: `xlsx` oficial (≥ 0.20) ou `exceljs`, `react-router` ≥ 6.30.3, `@capacitor` ≥ 8.3.5 (ou remover), `lodash`; ferramentas de build em `devDependencies` | SEC-12 | A fazer | P2 | M | — | R-010 | `npm audit --omit=dev` sem críticas/altas de runtime |
| R-036 | PWA: cache Workbox sem respostas autenticadas, checagem de atualização reativada, um único service worker (push no SW do Workbox) | FE-19, FE-18, INF-10 | A fazer | P2 | M | — | — | Cache Storage sem respostas `*.supabase.co/rest`; nova versão aparece para aba aberta; assinar push não desregistra o SW do app |

## Fase 4 — Qualidade e dívida técnica (P3)

| ID | Tarefa | Achados | Status | Prior. | Esf. | Dono | Depende de | Critério de pronto |
|---|---|---|---|---|---|---|---|---|
| R-037 | Testes dos fluxos críticos: pgTAP de `redeem_voucher` e RLS principais, testes de `voucherScan`/`voucherOffline`, smoke Playwright (login por perfil, scan de voucher, credenciamento) | QA-02, QA-05, FE-36 | A fazer | P3 | G | — | R-013 | Suites rodando no CI; cobertura de `src/lib/voucher*` > 0 |
| R-038 | Banco: `search_path` fixo, índices de FK de alto volume, índices/políticas duplicados, tabelas sem política, extensões fora de `public`, HIBP no Auth | DB-13, DB-18, DB-19, LIVE-05, LIVE-06 | A fazer | P3 | M | Claude + Usuário (HIBP) | R-011 | Advisors `function_search_path_mutable`, `duplicate_index`, `rls_enabled_no_policy` = 0 |
| R-039 | Estados de erro nas demais páginas admin | FE-14 | A fazer | P3 | M | — | R-028 | Heurística do anexo C da AUDITORIA = 0 páginas |
| R-040 | Tipagem: zerar erros do `tsc`, remover `rpc(... as any)`, `strictNullChecks` por pasta | FE-30, QA-03 | A fazer | P3 | G | — | R-011 | `tsc --noEmit` 0 erros no CI; `rg "rpc\(.*as any" src` = 0 |
| R-041 | Higiene do repositório: remover `claude-cookbooks-main/`, scripts soltos na raiz, `redeem_voucher.sql`, `branches-antes-limpeza.txt`, `.lovable/`; restringir o glob da `DocumentationPage` | INF-16, FE-34 | A fazer | P3 | P | — | — | Raiz só com config; chunk da `DocumentationPage` sem conteúdo do cookbook |
| R-042 | Duplicações e código morto: unificar telas de substituição, remover/religar órfãs, um sistema de toast, `console.log`, catálogos de rotas | FE-17, FE-32, FE-33, FE-35, FE-27 | A fazer | P3 | M | — | R-018 | 1 tela admin de substituição; "Dsaasocs" corrigido; `systemMap` sem rotas inexistentes |
| R-043 | Unificar as 3 camadas offline | QA-06, DOC-P01 | A fazer | P3 | G | — | R-037 | Uma fila offline com testes, usada pelos 17 consumidores |
| R-044 | Observabilidade: retenção das tabelas de monitoramento/auditoria, monitor externo de disponibilidade, erros pré-login | INF-14 | A fazer | P3 | M | — | R-007 | Job de retenção ativo; alerta externo dispara com o site fora |
| R-045 | Migrations: padrão de nomes daqui em diante, dados fora do histórico (seeds/scripts), `reset_all_data` revogado em prod, FKs ausentes | DB-17, DB-20, DB-22, INF-08 | A fazer | P3 | M | — | R-011 | `reset_all_data` inexistente/revogada em prod; novas migrations com descrição |
| R-046 | Documentação: runbook de infraestrutura (ambientes, deploy, migrations em prod, incidentes); consolidar/arquivar docs duplicados e obsoletos; atualizar README | DOC-02, DOC-03 | A fazer | P3 | M | — | R-014 | `docs/operacao/infraestrutura.md` existe e foi seguido num deploy; docs obsoletos com aviso ou removidos |
| R-047 | Decidir Lovable e Capacitor (manter, remover ou configurar); se sair da Lovable, trocar o AI Gateway do `ai-chat` | INF-17, INF-11 | A fazer | P3 | M | Usuário (decisão) | — | Decisão registrada em DECISOES e aplicada |
| R-048 | Higiene das Edge Functions: CORS restrito, sem erros internos na resposta, imports com versão fixa; filtros `.or()` sanitizados | EF-13, SEC-09 | A fazer | P3 | M | — | R-012 | `rg "Allow-Origin\": \"\*\"" supabase/functions` só nas públicas |
| R-049 | Arquivos gigantes: quebrar os maiores quando houver mudança funcional na área (incremental) | FE-29 | A fazer | P3 | G | — | — | Nenhum arquivo novo > 800 linhas; top 5 reduzidos |

## Fase 5 — Evolução de produto (P3)

| ID | Tarefa | Achados | Status | Prior. | Esf. | Dono | Depende de | Critério de pronto |
|---|---|---|---|---|---|---|---|---|
| R-050 | Transporte: desembarque no PWA + alerta "em trânsito" ao finalizar viagem | DOC-P04, DOC-P07 | A fazer | P3 | M | — | R-020 | Viagem de teste com embarque/desembarque e alerta de pendentes |
| R-051 | Transporte: alocador de passageiros em lote por delegação; vínculo de motorista | DOC-P05, DOC-P06 | A fazer | P3 | M | — | R-050 | Alocação de 1 delegação inteira em uma ação |
| R-052 | Alojamento na PWA da Delegação (`/pwa/delegacao/alojamento`) | DOC-P08 | A fazer | P3 | M | — | R-021 | Chefe de delegação vê ocupação da sua delegação |
| R-053 | Registros: Resumo do Dia da Coordenação; assinatura de súmula | DOC-P21 | A fazer | P3 | G | Usuário (escopo) | — | Telas entregues e validadas pelo usuário |
| R-054 | Confirmar pendências herdadas dos docs antigos e abrir tarefa para as que seguirem válidas | DOC-P12, DOC-P13, DOC-P15, DOC-P16, DOC-P17, DOC-P19, DOC-P20, LIVE-07 | A fazer | P3 | P | — | — | Cada item marcado Pronto/Cancelado ou convertido em tarefa |

---

## Concluídas

*Nenhuma ainda.* Formato: `R-xxx — AAAA-MM-DD — evidência (comando, PR, consulta)`.

## Canceladas

*Nenhuma.*
