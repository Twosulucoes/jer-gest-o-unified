# AUDITORIA — Estado atual do JER Gestão

> **Documento vivo.** Descreve o estado *atual* do sistema, não um retrato congelado.
> Cada seção traz a data da **última verificação** e contra o quê ela foi feita.
> Ao concluir uma tarefa do [ROADMAP](./ROADMAP.md), atualize aqui a seção afetada
> (status do achado, evidência nova, data de verificação). Regras completas em
> [`CLAUDE.md`](../CLAUDE.md#documentação-viva-obrigatório).

| Campo | Valor |
|---|---|
| Primeira auditoria | 2026-10-14 |
| Base auditada | `main` @ `8e802ac` (2026-07-23, merge do PR #296) |
| Banco verificado | Supabase **produção** `dfzjrijdcskncrwaiykr` (PG 17.6, sa-east-1), leitura ao vivo |
| Documentos irmãos | [ROADMAP.md](./ROADMAP.md) · [CHANGELOG.md](./CHANGELOG.md) · [DECISOES.md](./DECISOES.md) |

## Como ler

- **IDs de achado** (estáveis, nunca reaproveitar): `FE-` frontend, `DB-` banco, `EF-` Edge Functions,
  `SEC-` segurança da aplicação, `INF-` infraestrutura, `QA-` qualidade, `DOC-` documentação/repositório,
  `LIVE-` divergência encontrada só no banco ao vivo. A tarefa que resolve cada achado está no ROADMAP (`R-xxx`).
- **Status:** Pronto · Parcial · Pendente · Bloqueado (depende de algo externo ou de decisão).
- **Severidade:** Crítico (exposição ativa, perda de dados ou fluxo central parado) · Alto · Médio · Baixo.
- **Esforço:** P (até ½ dia) · M (1–3 dias) · G (mais de 3 dias).
- **Evidência:** `arquivo:linha` no repositório; `prod:` = consulta ao banco de produção na data indicada.
- Segredos, telefones e chaves **nunca** são copiados aqui; aparecem como `<redigido>`.

---

## 0. Resumo executivo

*Última verificação: 2026-10-14.*

### Estado geral

O sistema **rodou em produção na edição 2026** (18 etapas entre abril e julho de 2026; última refeição registrada em
2026-07-21). Os módulos de logística foram exercitados com volume real (prod: 55,8 mil vouchers, 37,3 mil
refeições + 15,3 mil avulsas, 25,7 mil leituras de credencial, 8,0 mil pessoas, 7,8 mil participantes, 43 usuários).
O módulo de **competição/resultados quase não foi usado** (prod: 32 partidas, 42 resultados, **0 publicados, 0 boletins**).
Não há commits desde 2026-07-23.

O código funciona para o fluxo operacional de campo, mas **não está pronto para uma nova edição nem para ficar
exposto como está**: há exposição ativa de dados pessoais, dezenas de funções do banco executáveis sem login,
caminhos de tomada de conta, produção não reproduzível a partir do repositório e fluxos centrais quebrados
(login de 4 perfis, painéis de competição, embarque no transporte, convite de usuários).

### Percentual de conclusão

| Indicador | Valor | Como é calculado ([D-003](./DECISOES.md#d-003)) |
|---|---|---|
| **Cobertura funcional** | **≈ 61 %** | Média dos 26 módulos da §2 (Pronto 1,0 · Pronto/Parcial 0,85 · Parcial 0,6 · Quebrado/Bloqueado 0,3 · Pendente 0,1) |
| **Prontidão para lançamento** | **0 de 28** tarefas bloqueantes (Fases 0–2 do ROADMAP) concluídas | Contagem direta no ROADMAP |
| Saúde técnica | `tsc` 65 erros · `vitest` 29/223 falhando · `eslint` 2.548 problemas · `npm audit` 3 críticas / 27 altas | §8 |

### Top 5 riscos

1. **Dados pessoais expostos publicamente.** O repositório GitHub é **público** e versiona CPF, RG, endereço e dados
   bancários de 169 árbitros (`docs/arbitros.csv`, `docs/realtorio árbitro`) e a chave da Evolution API do WhatsApp da
   CDE (no código e no histórico). → DOC-01, EF-03.
2. **Banco e Edge Functions abertos a qualquer visitante.** 207 funções `SECURITY DEFINER` executáveis pelo papel
   `anon`; várias sem checagem de papel gravam/publicam resultados, criam boletins, executam substituições ou
   devolvem PII (prod). Tabelas da CDE legíveis e graváveis por anon. Funções que enviam WhatsApp/e-mail sem
   autenticação. → DB-03, LIVE-02, SEC-04, EF-03/04/05.
3. **Escalada de privilégio e tomada de conta.** Coordenador gera link de login de qualquer conta (inclusive
   super_admin); secretaria/coordenação técnica podem se conceder super_admin; políticas confiam em
   `user_metadata` editável; usuário desativado mantém acesso pela API. → EF-01, DB-01, DB-02, SEC-02.
4. **Produção não reproduzível a partir do repositório.** Migrations com versões diferentes das aplicadas, ao menos
   3 migrations do repo **nunca aplicadas** (incluindo a RPC de embarque), 26 tabelas sem migration, 19 de 20 Edge
   Functions sem pipeline (2 com código fora do repo), `types.ts` defasado, lockfile do Bun quebrado. Toda mudança
   é um salto no escuro. → DB-10, LIVE-01, LIVE-03, INF-02, INF-05.
5. **Fluxos centrais quebrados e sem rede de segurança.** Secretaria/coordenação técnica caem em "Acesso negado",
   mesário/arbitragem caem em 404, convidados não definem senha, painéis de competição dão 404, embarque do PWA de
   transporte chama RPC inexistente; o CI não roda testes, lint nem typecheck. → FE-01..04, FE-08, LIVE-03, INF-05.

Risco seguinte (6º): **integridade de relatórios oficiais** — consumos de alimentação estimados com `random()` gravados
como leituras reais de QR e atribuídos a operadores reais (DB-04).

---

## 1. Arquitetura e stack

*Última verificação: 2026-10-14 (código @ `8e802ac`, prod ao vivo).*

| Camada | O que há | Evidência |
|---|---|---|
| Frontend | React 18 + TS 5.8 + Vite 5 + Tailwind + shadcn/ui; TanStack Query v5; React Router 6 (rota única em `src/routes/AppRoutes.tsx`, 587 linhas, 258 `<Route>`); PWA via `vite-plugin-pwa` (Workbox `generateSW`) | `package.json`, `vite.config.ts:39-80` |
| Tamanho | 764 arquivos `.ts/.tsx` em `src/`, ~188 mil linhas (14.848 de `types.ts` gerado) | contagem |
| Cliente Supabase | Único em `src/integrations/supabase/client.ts`, com fallback hardcoded para **prod** e override via `localStorage` | `client.ts:7-34` (INF-01, FE-25) |
| Backend | Supabase gerenciado: Postgres 17 + RLS + RPCs + Realtime + Storage + pg_cron + pg_net | prod |
| Schemas | `public` 166 tabelas · `alojamento` 9 · `arbitragem` 6 · `cde` 4 · `logistica` 4 · 18 views · 246 funções em `public` · 639 políticas RLS | prod |
| Edge Functions | 20 no repo (`supabase/functions/`), 20 publicadas em prod (conjuntos diferentes, ver §4) | prod `list_edge_functions` |
| Cron | `monitoring-collect` (1 min, via HTTP), `mark_expired_vouchers` (1 min), purge de `cron.job_run_details` (diário) | prod `cron.job` |
| Hospedagem | Frontend na Vercel (GitHub App); domínio do admin `adm.jers.com.br` (citado em `send-cde-notification`). Sem containers/Docker | `vercel.json`, `deploy.yml:54-56` |
| CI | GitHub Actions: `deploy.yml` (build), `validate-data.yml`, `sync-test-db.yml` | §6 |
| Integrações externas | Evolution API (WhatsApp CDE, HTTP puro), Resend (e-mail), Lovable AI Gateway, Anthropic, xAI, DeepSeek (IA), Web Push (VAPID), `api.qrserver.com` (QR) | §4, §7 |
| Mobile | Capacitor configurado, mas sem `android/`/`ios/` e apontando para preview da Lovable | `capacitor.config.ts:3-9` (INF-11) |
| Ambientes | Prod `dfzjrijdcskncrwaiykr`; teste `wiwvpokdbklathfkjmzl` (não acessível nesta auditoria); modo Vite `teste` dependente de `.env.teste.local` não versionado | INF-12 |

**Fluxo principal:** importação SIGECOM (`import-inscricoes`) → pessoas/participantes/inscrições por etapa →
credenciamento (credencial + QR) → operação de campo nos PWAs (alimentação, transporte, alojamento, material,
vouchers) com fila offline → competição (fases, partidas, lançamento, homologação) → boletim/publicação →
relatórios (consumo, OSC/prestação de contas).

---

## 2. Funcionalidades por módulo

*Última verificação: 2026-10-14 (leitura de código + volume em prod).*

| # | Módulo | Status | Peso | Evidência principal |
|---|---|---|---|---|
| 1 | Autenticação, login e roteamento por perfil | **Quebrado** | 0,3 | FE-01, FE-02, FE-03, FE-08; mapas de redirecionamento duplicados (`LoginPage.tsx:16-63` × `accessControl.ts:16-81`) |
| 2 | Admin: cadastros (eventos, etapas, modalidades, locais, instituições, delegações, pessoas, participantes) e importação | Pronto/Parcial | 0,85 | Telas reais com mutações; faltam estados de erro (FE-14); link quebrado `CategoriasPage.tsx:226` |
| 3 | Credenciamento (admin + PWA) | Parcial | 0,6 | Funcional (4,0 mil credenciais em prod); QR forjável (FE-05); vínculo no PWA sem guarda de perfil (FE-20) |
| 4 | Vouchers | Pronto/Parcial | 0,85 | RPCs canônicas P0–P4; 55,8 mil vouchers em prod; código gerado no cliente (`VouchersPage.tsx:146-151`) |
| 5 | Alimentação (admin + PWA) | Parcial | 0,6 | 37,3 mil consumos em prod; FE-22; dados estimados misturados (DB-04) |
| 6 | Transporte (admin + PWA) | **Quebrado (embarque PWA)** | 0,3 | RPC `record_transport_boarding` **não existe em prod** (LIVE-03); `TransporteRotasPage` lê tabela inexistente (FE-09); sem desembarque no PWA (DOC-P04) |
| 7 | Alojamento (admin + PWA) | Parcial | 0,6 | Overload ambíguo de `get_alojamento_kpis` confirmado em prod (QA-01); presença aberta a anon (DB-07) |
| 8 | Material (entrega de kit) | Pronto/Parcial | 0,85 | 907 entregas + 2,5 mil avulsas em prod; 10 erros de tipo em `MaterialScanPage.tsx` |
| 9 | Coordenação técnica (PWA) | Pronto/Parcial | 0,85 | 10 rotas com telas reais |
| 10 | Delegação (PWA) | Pronto/Parcial | 0,85 | 10 rotas; faltam estados de erro |
| 11 | Arbitragem / árbitros | Parcial | 0,6 | Admin ok; pós-login do perfil `arbitragem` vai para `/aovivo` (404, FE-02) |
| 12 | Competição / lançamento de resultados (admin) | **Quebrado** | 0,3 | Painéis por família dão 404 (FE-04); botões mortos em Time/Mark e Ranking (FE-16) |
| 13 | Ao Vivo / mesário | **Bloqueado** | 0,3 | Páginas prontas sem rota (FE-02) |
| 14 | Publicação de resultados / boletins | Parcial | 0,6 | 0 boletins e 0 resultados publicados em prod; tabelas `bulletin_sport_events`/`bulletin_matches` não existem (LIVE-04); `generate-bulletin` sem auth (EF-04) |
| 15 | Portal público (resultados, quadro de medalhas) | Pendente (desligado) | 0,1 | Redireciona para `/login` (`AppRoutes.tsx:566-568`, FE-06) |
| 16 | Links curtos `/go/:slug` | **Quebrado** | 0,3 | Sem rota; QR impressos levam a 404 (FE-07) |
| 17 | Pesquisa de satisfação (PWA com PIN) | Pronto | 1,0 | 706 respostas em prod; PIN fraco (SEC-08) |
| 18 | Enquete de Reconhecimento 2026 | Parcial | 0,6 | Backend sem migration (FE-10); direção por obscuridade (FE-24) |
| 19 | Super Admin | Parcial | 0,6 | Remediação simulada com `setTimeout` (FE-11) |
| 20 | Manual / Ajuda / Documentação | Pronto | 1,0 | `AjudaManualPage`, `SuperManualPage`, `ai-chat` |
| 21 | PWA / offline | Parcial | 0,6 | 3 camadas offline (DOC-P01); checagem de update desligada (FE-18); cache de API sensível (FE-19) |
| 22 | Regras JER | Parcial | 0,6 | `RegrasLotePage`/`RegrasProvaPage` órfãs |
| 23 | CDE / protestos / substituições | Parcial | 0,6 | Funciona, mas RLS aberta a anon (LIVE-02), assinatura falsificável (SEC-03), 5 telas para o mesmo fluxo (FE-17) |
| 24 | OSC / prestação de contas / registros | Parcial | 0,6 | Crash de hooks (FE-12), QR do PDF 404 e CNPJ fictício (FE-13) |
| 25 | Monitoramento e alertas | Parcial | 0,6 | Coleta funciona (258 mil métricas); **tabelas `notifications`/`alert_rules` não existem em prod** → Central de Alertas quebrada (LIVE-03); sem retenção (INF-14) |
| 26 | Relatórios (hub com 9) | Pronto/Parcial | 0,85 | OSC com bugs; demais funcionais |
| | **Média** | | **≈ 0,61** | |

---

## 3. Banco de dados

*Última verificação: 2026-10-14 (380 migrations @ `8e802ac` + prod ao vivo: `pg_policies`, `pg_proc`, advisors).*

### 3.1 Inventário

- Prod: 189 tabelas (public 166, alojamento 9, arbitragem 6, cde 4, logistica 4), 18 views, 246 funções em `public`,
  639 políticas, **0 tabelas sem RLS** em `public`/`alojamento`, 13 buckets (5 públicos: `credential-templates`,
  `match-attachments`, `report-assets`, `substitution-docs`, `cde-attachments`).
- Repositório: 163 tabelas criadas nas migrations, ~707 políticas, 236 funções, ~140 triggers, 10 enums.
- Domínios e tabelas: ver anexo A.
- Maiores tabelas (prod, linhas): `monitoring_metrics` 258 mil · `audit_events` 93 mil · `db_operation_logs` 84 mil ·
  `service_voucher_audit` 60 mil · `service_vouchers` 56 mil · `meal_audit_logs` 38 mil · `meal_consumptions` 37 mil.

### 3.2 Achados

| ID | Título | Evidência | Status | Sev. | Esf. | Dep. |
|---|---|---|---|---|---|---|
| DB-01 | Secretaria e coordenação técnica podem gravar qualquer papel em `user_roles`, inclusive `super_admin` para si | prod: política `secretaria_manage_user_roles` `FOR ALL` sem restrição de `role`; `20260430052452:22-27`; `has_role` trata `super_admin` como coringa | Pendente | Crítico | P | — |
| DB-02 | Políticas confiam em `user_metadata` (editável pelo usuário) | prod advisor `rls_references_user_metadata` em `service_voucher_batches` (2 políticas); `20260429094935:5-45`; `20260427213607:19-40` (`service_eventual_people`) | Pendente | Crítico | P | — |
| DB-03 | RPCs `SECURITY DEFINER` executáveis por anon e sem checagem de papel | prod advisor: **207** funções executáveis por `anon`; conferido em `pg_proc` + `has_function_privilege('anon')`: `rpc_launch_match_result`, `rpc_publish_results_for_sport_event`, `rpc_publish_bulletin`, `rpc_create_bulletin`, `execute_substitution`, `upsert_event_participation_rules`, `bot_get_full_context`/`bot_lookup_participant` (PII por telefone), `import_inscricoes_batch`, `rpc_reprocess_event`, `rpc_generate_matches_collective`, `pwa_search_person` (CPF), `record_meal_consumption` (aceita operador do cliente), entre outras. Só 30 das 147 revogam de `PUBLIC` no repo | Pendente | Crítico | M | inventário de RPCs públicas legítimas |
| DB-04 | Consumos de alimentação **estimados** gravados como leituras reais de QR | `20260520010000_seed_meal_consumptions_bonfim_normandia.sql:1-25,175-198` (`random()`, `method='qr_scan'`, 4 operadores reais); seed `exec_fisica_demo` roda em prod e não é filtrado por `get_osc_execucao_fisica`. prod: 36.887 `qr_scan`, 426 `manual`, 0 `seed_demo` — as linhas estimadas são indistinguíveis | Pendente | Crítico | M | decisão de negócio/jurídica |
| DB-05 | Políticas "Stage restricted access" são PERMISSIVE `FOR ALL`: quem tem etapa atribuída escreve direto em consumos, janelas, alojamento | `20260501204911:29-102`; nenhum `RESTRICTIVE` no repo | Pendente | Alto | P | testar PWAs |
| DB-06 | Portal público de substituição autentica por 4 dígitos do telefone e lista atletas menores; anon lê `substitution-docs/temp` | `20260519000001:7-33,71-197`; `20260519000000:52-81` | Pendente | Alto | M | — |
| DB-07 | `lodging_presence_logs` com SELECT/INSERT `true` para `public` (inclui anon) | prod `pg_policies`; `20260428041156:17-22` | Pendente | Alto | P | — |
| DB-08 | `notifications` aceitaria INSERT de qualquer pessoa | `20260511200000:42`. **Em prod a tabela não existe** (LIVE-03); vale quando a migration for aplicada | Pendente | Alto | P | LIVE-03 |
| DB-09 | Trilhas de auditoria forjáveis (`audit_events` INSERT `true`, `db_operation_logs`, `performance_logs` anon) | `20260413191015:37`; `20260420071000:28`; `20260430033615:21`; prod: `performance_logs` INSERT anon | Pendente | Médio | P | — |
| DB-10 | Drift repo × prod × `types.ts`: 26 tabelas e 18 funções sem migration (CDE inteira, `substitution_documents`, `event_stage_sports`, `venue_event_stages`…); `types.ts` sem 74 funções e várias tabelas | lista em anexo B; `20260430142308:7-95` aplica políticas a tabelas nunca criadas | Pendente | Alto | G | acesso CLI ao banco |
| DB-11 | Buckets públicos e documentos pessoais legíveis por qualquer autenticado | prod `storage.buckets`; `20260415013509:20-24` (`transport-passenger-docs`); `20260409212307:36-41` | Pendente | Alto | P | frontend que gera URL |
| DB-12 | Leitura `USING (true)` para autenticados em tabelas sensíveis (documentos, casos disciplinares, elegibilidade, supervisões) | `20260430142308:7-95`; `20260415164911:62`; `20260513000002:8` | Pendente | Alto | M | DB-10 |
| DB-13 | `SECURITY DEFINER` sem `SET search_path` | prod advisor: 35 funções; repo: 22 | Parcial | Médio | P | — |
| DB-14 | 5 views `SECURITY DEFINER` ignoram RLS (`public_results_view`, `vw_fulfilled_referee_assignments` com remuneração, `vw_sport_event_summary`, `vw_stage_sport_event_summary`, `v_credenciamento_externo`) | prod advisor `security_definer_view`; `20260428225807:42-44` | Pendente | Médio | P | — |
| DB-15 | Usuário edita o próprio `profiles.active`; papel alojamento atualiza qualquer coluna de participantes | `20260419192031:55-58`; `20260415033800:44` | Pendente | Médio | P | — |
| DB-16 | `GRANT ALL` a anon nos schemas `logistica`, `arbitragem`, `cde`; `GRANT` amplo a authenticated em `public` | `20260412175859:500-510`; `20260429093038:26` | Parcial | Médio | P | — |
| DB-17 | FKs ausentes/removidas (`disciplinary_cases`, `profiles`, `user_roles`, `user_stage_assignments`…) | `20260402000002:46-62`; `20260403000001:3-13` | Pendente | Médio | M | limpeza de órfãos |
| DB-18 | FKs sem índice em tabelas de alto volume | prod advisor: 222 `unindexed_foreign_keys`; repo: `credential_scans`, `lodging_occupancies`, `transport_passengers`, `service_voucher_attempts`… | Pendente | Médio | P | `CREATE INDEX CONCURRENTLY` |
| DB-19 | Índices e políticas duplicados | prod advisor: 3 índices duplicados, 546 `multiple_permissive_policies`, 623 `auth_rls_initplan` | Pendente | Baixo | P | — |
| DB-20 | Migrations destrutivas e dados fixos no histórico; `reset_all_data` disponível | `20260411153934:6-66` (DELETE sem WHERE); `20260704010000:21`; `20260411210641`; UUID/nome de pessoa real em 5 migrations | Pendente | Médio | M | — |
| DB-21 | Churn: `redeem_voucher` redefinida 8×; `check_user_stage_access` ficou quebrada por 3 versões | repo | Parcial | Baixo | M | DB-10 |
| DB-22 | 241 migrations com UUID no nome, 7 com horário inválido, 1 vazia | `20260506300000`…`20260507400000`; `20260420000002` | Pendente | Baixo | P | — |
| DB-23 | Cron chama Edge Function por HTTP com JWT anon fixo; `config.toml` só com `project_id` | `20260418172753:1-10`; prod `cron.job` | Pendente | Baixo | P | INF-06 |
| DB-24 | SQL dinâmico seguro (`%I`/`quote_ident`) | 17 `EXECUTE` revisados | **Pronto** | — | — | — |
| DB-25 | RLS ausente em `meal_consumptions_unlinked` **no repo** | `20260708232000:25`; prod: RLS **habilitada** (drift, só o repo está errado) | Parcial | Médio | P | DB-10 |
| LIVE-01 | Histórico de migrations dessincronizado: versões remotas diferem das do repo (ex.: remoto `20260402185024` × repo `20260402000000`; remoto `20260723192950` × repo `20260723000000`) — `supabase db push` não é confiável | prod `supabase_migrations.schema_migrations` | Pendente | Alto | M | DB-10 |
| LIVE-02 | Tabelas da CDE abertas: `cde_cases` SELECT `true` e INSERT `true` para anon, UPDATE/ALL `true` para authenticated; `cde_attachments`, `cde_decision_signatures` SELECT/INSERT anon; `cde_case_history` INSERT anon; `substitution_documents` SELECT `public` | prod `pg_policies` (2026-10-14) | Pendente | **Crítico** | M | SEC-03, SEC-04 |
| LIVE-03 | Migrations do repo **nunca aplicadas em prod**: `20260511200000_alerts_notifications_tables`, `20260511200001_alerts_process_function`, `20260513000009_record_transport_boarding_rpc` (prod: tabelas `notifications`/`alert_rules` e RPC `record_transport_boarding` inexistentes; cron `jer_process_alerts` ausente) | prod `to_regclass`/`pg_proc`/`cron.job` | Pendente | **Crítico** (embarque de transporte) | M | LIVE-01 |
| LIVE-04 | Objetos usados pelo front que não existem em prod: `bulletin_sport_events`, `bulletin_matches`, `athlete_public_tokens` (quebra `get_athlete_public_profile` → `/atleta/:id`), tabela `routes` | prod `to_regclass` | Pendente | Alto | M | FE-09, FE-10 |
| LIVE-05 | 4 tabelas com RLS e nenhuma política (inacessíveis): `cde_recursos`, `crachas_temp`, `event_staff_credentials`, `importacao_temp` | prod advisor `rls_enabled_no_policy` | Pendente | Baixo | P | — |
| LIVE-06 | Extensões `unaccent` e `pg_net` no schema `public`; proteção contra senha vazada (HIBP) desligada no Auth | prod advisors | Pendente | Baixo | P | — |
| LIVE-07 | Etapas já encerradas continuam com status `active` (10 de 18) | prod `event_stages` | Pendente | Baixo | P | decisão operacional |

---

## 4. Backend: Edge Functions e APIs

*Última verificação: 2026-10-14 (leitura integral das 20 funções + lista de funções publicadas em prod).*

### 4.1 Inventário

| Função | Uso | Auth no código | Observação |
|---|---|---|---|
| admin-users | gestão de usuários | `getUser` + papel (falhas por ação) | EF-01, EF-02; **publicada a partir de fonte fora do repo** |
| ai-chat | Central de Ajuda | só autenticado | EF-08; depende do Lovable AI Gateway |
| ai-resolve-pendencias | IA nas pendências de importação | só header Bearer | EF-09 (PII de menores a provedores externos) |
| generate-bulletin | boletim PDF | **nenhuma** (service role) | EF-04 |
| generate-credential-qr | assinatura HMAC | papel | sem chamador (no-op declarado) |
| generate-osc-report | relatório OSC via IA | `getUser`, papel calculado e ignorado | EF-13 |
| import-catalog | catálogo estático | nenhuma | sem chamador |
| import-inscricoes | importação SIGECOM | papel | ok |
| import-referees | importação de árbitros | papel | EF-12; `redirectTo` com host da API (FE-03) |
| monitoring-collect | coleta por minuto | **nenhuma** (service role) | EF-07 |
| monitoring-push | Web Push | service role ou super_admin | ok |
| process-alerts | alertas | **nenhuma** (service role) | EF-07; chave VAPID importada vazia (`:59`) |
| public-events / public-results | portal público | token opcional | ok; `public-events` sem chamador no front |
| send-cde-notification | WhatsApp CDE | **nenhuma** | EF-03 (chave hardcoded, HTTP puro) |
| send-cde-decision-notification | WhatsApp decisão | **nenhuma** | EF-03; **não está publicada em prod** |
| send-substitution-email | e-mail protocolo | **nenhuma** | EF-05 |
| submit-substitution-public | formulário público | intencionalmente pública (service role) | EF-06 |
| validate-qr | validação de QR | papel | EF-11; **publicada a partir de fonte fora do repo** |
| verify-current-user-password | step-up de senha | `getUser` | EF-10 |
| *(diag-vapid)* | — | `verify_jwt=false` | **existe só em prod**, não está no repo |

`verify_jwt=true` não protege nada sozinho: a anon key é pública, então toda função que não valida o usuário no próprio
código está aberta na internet. O CI publica só `send-cde-notification` (`deploy.yml:85`).

### 4.2 Achados

| ID | Título | Evidência | Status | Sev. | Esf. | Dep. |
|---|---|---|---|---|---|---|
| EF-01 | `admin-users`: perfis gestores (inclusive `coordenador_modalidade`) obtêm link de login de **qualquer** conta, inclusive super_admin (`generate_reset_link` devolve `action_link` sem checar alvo); variantes em `reset_password`, `resend_invite`, `invite_user` com e-mail existente | `admin-users/index.ts:79,240-251,492-508,510-553,555-576` | Pendente | Crítico | P | — |
| EF-02 | `admin-users`: coordenador se atribui papéis, derruba sessões, lê auditoria de qualquer usuário; `stack` no erro; `redirectTo` do header `Origin` | `:139-194,405-442,477-591,598-601` | Pendente | Alto | P | EF-01 |
| EF-03 | Chave da Evolution API, IP e telefone pessoal hardcoded; transporte HTTP; funções sem auth enviam WhatsApp com texto livre a qualquer número a partir do número oficial da CDE. Chave está no histórico → **rotacionar** | `send-cde-notification/index.ts:5-12`; `send-cde-decision-notification/index.ts:5-8` (valores `<redigido>`) | Pendente | Crítico | P + rotação | acesso ao servidor Evolution |
| EF-04 | `generate-bulletin` sem autenticação grava boletim "publicado" com título do request; homologação pulada se `trigger` ≠ publish/manual | `generate-bulletin/index.ts:15-20,79-81,297-325` | Pendente | Alto | P | trigger `fn_trigger_after_match_publish` |
| EF-05 | `send-substitution-email` sem auth, `to` livre e HTML sem escape, remetente `noreply@jer.rr.gov.br` (relay de phishing) | `send-substitution-email/index.ts:14,39-46` | Pendente | Alto | P | EF-06 |
| EF-06 | `submit-substitution-public`: caminhos de arquivo vindos do cliente manipulados com service role; prazo validado só no cliente; `getPublicUrl` em bucket privado | `index.ts:56,144,154-236`; `SubstituicaoSolicitarPage.tsx:221` | Pendente | Médio | M | — |
| EF-07 | `process-alerts`/`monitoring-collect` acionáveis por qualquer um; SSRF cego via endpoint de push | `process-alerts/index.ts:59,136`; `monitoring-collect/index.ts:14` | Pendente | Médio | P | cron com segredo |
| EF-08 | `ai-chat` sem limites e aceita `role:"system"` do cliente; `test_provider` aberto | `ai-chat/index.ts:79,101,119,160-204` | Pendente | Médio | P | — |
| EF-09 | `ai-resolve-pendencias` envia CPF, nome e nascimento de menores a Anthropic, xAI e DeepSeek | `ai-resolve-pendencias/index.ts:255-312` | Pendente | Médio (LGPD) | P | DPO |
| EF-10 | Step-up de senha só no cliente (RPC de homologação pode ser chamada direto); rate limit em memória | `verify-current-user-password/index.ts:16-41,95-98`; `CompeticaoLancamentoScorePage.tsx:299-312` | Pendente | Médio | M | RPCs de homologação |
| EF-11 | `validate-qr`: HMAC contornável por fallbacks; busca por CPF devolve PII de menores a qualquer operador | `validate-qr/index.ts:43,130-284,316-355` | Parcial | Médio | M | FE-05 |
| EF-12 | Importações reativam contas existentes e renomeiam perfis | `import-referees/index.ts:224-258` | Pendente | Baixo | P | — |
| EF-13 | Higiene: CORS `*` em todas, erros internos devolvidos, imports `esm.sh` sem versão fixa, papel calculado e ignorado em `generate-osc-report` | várias | Pendente | Baixo | M | — |
| EF-14 | Divergência repo × prod: `diag-vapid` só em prod (`verify_jwt=false`); `send-cde-decision-notification` só no repo; `validate-qr` e `admin-users` publicadas de fonte fora do repo | prod `list_edge_functions` | Pendente | Alto | P | INF-05 |

---

## 5. Frontend

*Última verificação: 2026-10-14 (código @ `8e802ac`; `vite build`, `tsc`, `eslint`, `vitest` executados).*

### 5.1 Rotas e navegação

- Fonte única: `src/routes/AppRoutes.tsx`. Grupos: público, `/super/*` (17), `/admin/*`, `/admin/etapa/:stageId/*` (~60),
  `/pwa/*`, `/pesquisa/*`, CDE/substituição públicas, `/enquete/*`.
- **Destinos que não existem** (todos levam a 404 ou loop): `/aovivo`, `/pwa/set-password`, `/go/:slug`,
  `/admin/etapa/:id/competicao/painel-*`, `/admin/etapa/:id/protestos`, `/pwa/registros`,
  `/admin/configuracoes/{identidade-visual,supabase}`, `/admin/evidencias-osc`, `/admin/participante/:id`,
  `/admin/regras-evento`, `/admin/validar-qr` (impresso no PDF de OSC).
- **~6,9 mil linhas de páginas órfãs** (sem rota), várias esperadas pelo resto do sistema: `AoVivoHomePage`,
  `AoVivoMatchPage`, `PwaSetPasswordPage`, `GoRedirectPage`, `PublicResultsPage`, `PublicMedalTablePage`,
  `EvidenciasOSCPage`, `IdentidadeVisualPage`, `PwaRegistrosPage` e outras.

### 5.2 Achados

| ID | Título | Evidência | Status | Sev. | Esf. | Dep. |
|---|---|---|---|---|---|---|
| FE-01 | Secretaria e coordenação técnica caem em "Acesso negado" em loop após o login (index de `/admin` → `/admin/cde`, que só aceita admin/super_admin/cde) | `AppRoutes.tsx:312-330`; `LoginPage.tsx:44-45`; `AccessDeniedPage.tsx:11` | Bloqueado | Crítico | P | — |
| FE-02 | Mesário e arbitragem vão para `/aovivo` (sem rota → 404); `/pwa/registros` também sem rota | `accessControl.ts:22-23`; `LoginPage.tsx:27-28`; `PwaLayout.tsx:110-111` | Bloqueado | Crítico | M | `match_user_assignments` sem tipo |
| FE-03 | Convidado nunca define senha: convite aponta para `/pwa/set-password` (sem rota); `import-referees` usa host da API | `admin-users/index.ts:223`; `import-referees/index.ts:223`; `PwaModulePage.tsx:74-77` | Bloqueado | Crítico | P | Redirect URL no Auth |
| FE-04 | "Abrir painel" do Painel da Competição na etapa dá 404 para todas as famílias (score, sets, combat, time/mark, ranking) | `CompeticaoPainelPage.tsx:191-216`; `MatchesTab.tsx:175`; `AppRoutes.tsx:459-464` | Bloqueado | Crítico | M | decisão: painéis dentro da etapa |
| FE-05 | Credencial = `J` + 5 dígitos com `Math.random`, QR sem assinatura → QR forjável digitando um número | `credentialUtils.ts:28-58` | Parcial | Crítico/Alto | M | backend + EF-11 |
| FE-06 | Portal público de resultados e quadro de medalhas desligados | `AppRoutes.tsx:566-568` | Pendente | Alto | P–M | decisão de produto, DB-14 |
| FE-07 | `/go/:slug` e QR impressos levam a 404 | `LinksPage.tsx:107,129,172,303` | Pendente | Alto | P | — |
| FE-08 | Coordenador de modalidade sempre mandado para `/pwa/resultados`; telas do admin que o listam são inalcançáveis; lógica de redirecionamento duplicada e divergente | `accessControl.ts:72-74`; `ProtectedRoute.tsx:66-69`; `LoginPage.tsx:16-30` | Pendente | Alto | P | FE-01 |
| FE-09 | PWA de transporte lê tabela `routes` (inexistente; a real é `transport_routes`) e ignora o erro → lista vazia | `TransporteRotasPage.tsx:23`; prod: `routes` não existe | Pendente | Alto | P | — |
| FE-10 | `types.ts` defasado; 21 objetos usados pelo front sem tipo; Enquete e boletins sem migration | `AutoBulletinDialog.tsx:198,203`; `TransporteScanPage.tsx:148` | Parcial | Alto | M | DB-10 |
| FE-11 | Remediação do Super Admin simulada (`setTimeout` + toast de sucesso + auditoria falsa) | `RemediationDialog.tsx:102-106` | Pendente | Alto | P | — |
| FE-12 | Prestação de Contas OSC chama `useState` depois de `return` antecipado (crash intermitente) | `PrestacaoContasOscPage.tsx:51-67` | Pendente | Alto | P | — |
| FE-13 | PDF oficial de OSC com QR para rota inexistente, token `Math.random` e CNPJ/endereço fictícios como **valor** padrão do formulário | `PrestacaoContasOscPage.tsx:112,143`; `useEventOscConfig.ts:20-26`; `ConfigOscPage.tsx:92-169` | Pendente | Alto | P–M | — |
| FE-14 | 96 de 135 páginas com consulta não mostram erro; falha de RLS/rede aparece como "Nenhum registro" | `App.tsx:34-37` + lista em anexo C | Parcial | Alto | M | — |
| FE-15 | Testes vermelhos: `appRoutesOrder.test.ts` lê `App.tsx`; 26 páginas sem `PwaRefreshButton` | `src/test/routes/appRoutesOrder.test.ts:15`; `src/test/pwa-refresh-button.test.ts` | Pendente | Alto | P | — |
| FE-16 | Botões sem ação e "Em breve" | `RegistrosPage.tsx:40,180,183`; `SeriesTab.tsx:246,316,370,371,407`; `ResultadoTab.tsx:301`; `OscAccountabilityModule.tsx:865-889`; `AlimentacaoPrevisaoPage.tsx:583` | Parcial | Médio | P–M | — |
| FE-17 | 5 telas para substituições (2 quase idênticas, 857 × 823 linhas); "Dsaasocs" visível na UI | `SubstituicoesPage.tsx:371`; `SubstituicaoAdminPage.tsx` | Pendente | Médio | M | — |
| FE-18 | Checagem de atualização do PWA desativada | `usePwaUpdateCheck.ts:4-25` | Pendente | Médio | P | — |
| FE-19 | Workbox guarda em cache toda a API Supabase (5 min) → dados de um usuário podem aparecer para outro no mesmo aparelho | `vite.config.ts:58-65` | Parcial | Médio | P | — |
| FE-20 | Rotas sensíveis do PWA sem restrição de perfil (`credenciamento/vincular`, `massa`, `debug`, `diagnostico/qr`) | `AppRoutes.tsx:544-547` | Parcial | Médio | P | — |
| FE-21 | `QueryClient` chama `window.reportError` (DOM) em vez do reporter do projeto | `App.tsx:42` | Pendente | Médio | P | — |
| FE-22 | Gerar janelas de refeição padrão mostra erro mesmo após sucesso (`.catch` no builder) | `AlimentacaoJanelasPage.tsx:270-280` | Pendente | Médio | P | — |
| FE-23 | 16 mutações sem `onError` | lista no anexo C | Parcial | Médio | P | — |
| FE-24 | Painel da direção da Enquete protegido por obscuridade; sorteio no navegador sem registro | `src/lib/enquete.ts:15-16`; `EnqueteDirecaoPage.tsx:122-140` | Parcial | Médio | P–M | — |
| FE-25 | Override do Supabase via `localStorage` sempre ativo | `client.ts:13-33` | Pendente | Médio | P | — |
| FE-26 | Protocolo de recurso CDE e código de voucher gerados no cliente com `Math.random` | `CdeRecursoPage.tsx:77-81`; `VouchersPage.tsx:146-151` | Parcial | Médio | P | — |
| FE-27 | `systemMap.ts`/`competitionFeatureCatalog.ts` apontam rotas inexistentes | `systemMap.ts:195-817` | Parcial | Médio | P | — |
| FE-28 | Itens do menu lateral que levam a 404 ou "Acesso negado" | `AdminLayout.tsx:122,123,140,149,176`; `StageHomePage.tsx:39` | Pendente | Médio | P | FE-01 |
| FE-29 | 31 arquivos com mais de 800 linhas (maior: `ProtestosFilaPage.tsx`, 2.001) | anexo C | Dívida | Médio | G | — |
| FE-30 | 65 erros de TypeScript escondidos pelo build; 1.101 `as any`, 1.016 `: any` | `tsc --noEmit -p tsconfig.app.json` | Dívida | Médio | M | FE-10 |
| FE-31 | Central de Alertas depende de tabelas inexistentes em prod | `useAlerts.ts:26-85`; `AlertasPage.tsx:66-80`; LIVE-03 | Pendente | Médio | P | LIVE-03 |
| FE-32 | ~3,2 mil linhas de componentes/hooks/libs nunca importados; 2 scanners de QR | anexo C | Dívida | Baixo | P–M | decidir órfãs a religar |
| FE-33 | Dois sistemas de toast (shadcn 25 arquivos, sonner 198) | `App.tsx:57-58` | Pendente | Baixo | P | — |
| FE-34 | Scripts soltos na raiz com anon key de prod | `check_*.ts`, `count_*.ts` | Pendente | Baixo | P | — |
| FE-35 | 22 `console.log` em produção | 10 arquivos | Pendente | Baixo | P | — |
| FE-36 | Playwright inutilizável (importa pacote da Lovable não instalado; nenhum spec) | `playwright.config.ts:1` | Bloqueado | Médio | M | INF-02 |

---

## 6. Infraestrutura

*Última verificação: 2026-10-14 (configs do repo, GitHub Actions via API, Supabase prod). Vercel **não verificada** (sem acesso).*

| ID | Título | Evidência | Status | Sev. | Esf. | Dep. |
|---|---|---|---|---|---|---|
| INF-01 | Build sem `VITE_SUPABASE_*` cai silenciosamente no banco de **produção** (fallback hardcoded); `validate:data` idem | `client.ts:7-8`; `scripts/validate-frontend-data.ts:5-6`; `ImportacaoPage.tsx:244` | Pendente | Alto | P | variáveis por ambiente na Vercel |
| INF-02 | 3 lockfiles; `bun.lock` aponta 24 pacotes para registro privado da Lovable (403 fora dela); `bun install --frozen-lockfile` e `bun install` **falham** neste ambiente; só `npm ci` funciona | `bun.lock:677,733…`; execução local 2026-10-14 | Pendente | Alto | P | — |
| INF-03 | `vercel.json` mistura `routes` com `headers` (a Vercel proíbe); catch-all devolve `index.html` para chunk inexistente; sem CSP/HSTS/XFO | `vercel.json:6-29` | Pendente | Alto | P | confirmar no painel Vercel |
| INF-04 | `public/version.json` versionado com `environment: "teste"` e ref de teste; produção se anuncia como teste; 4 fontes de versão (`VERSION` 0.4.0, `package.json` 0.0.0, `version.ts` 1.0.1, hash) | `public/version.json`; `scripts/update-version.ts:37-43` | Pendente | Alto | P | INF-01 |
| INF-05 | CI não roda lint, typecheck nem testes; sem gatilho de PR no `deploy.yml`; deploy de 1 de 20 Edge Functions; migrations em prod aplicadas fora do CI; step "Debug token" imprime prefixo do token | `deploy.yml:3,85`; `sync-test-db.yml:28-29` | Parcial | Alto | M | INF-02, FE-15 |
| INF-06 | Cron `monitoring-collect` com URL e chave de prod na migration → o BD de teste chama prod a cada minuto | `20260418172753:1-9` | Pendente | Alto | P | — |
| INF-07 | `.gitattributes` com `merge=union` em migrations (conflito vira SQL misturado sem aviso) | `.gitattributes:1-3` | Pendente | Médio | P | — |
| INF-08 | 380 migrations, nomes sem descrição, nenhum rollback (exigido pelo CONTRIBUTING) | `supabase/migrations/`; `CONTRIBUTING.md:46` | Parcial | Médio | M | LIVE-01 |
| INF-09 | `config.toml` sem `verify_jwt` por função; deploy via CLI quebraria funções públicas | `supabase/config.toml` | Pendente | Médio | P | INF-05 |
| INF-10 | Dois service workers no mesmo escopo `/` (push × Workbox) se derrubam | `pushClient.ts:30-33` | Parcial | Médio | M | — |
| INF-11 | Capacitor aponta para preview da Lovable com `cleartext`; sem pastas nativas | `capacitor.config.ts:3-9` | Pendente | Baixo | P | decisão |
| INF-12 | Ambientes e variáveis não documentados; nomes divergentes (`VITE_SUPABASE_ANON_KEY` × `_PUBLISHABLE_KEY`) | `validate-data.yml:23`; `.env.example` | Parcial | Médio | P | INF-01 |
| INF-13 | Scripts E2E de dados exigem service role e não rodam em lugar nenhum; `check-delegations.ts` usa coluna dropada | `scripts/` | Parcial | Baixo | P | — |
| INF-14 | Observabilidade: sem retenção nas tabelas de monitoramento (258 mil linhas em prod), sem monitor externo; erros pré-login se perdem | `errorReporter.ts:12-15`; prod | Parcial | Médio | M | INF-06 |
| INF-15 | Workflow `sync-test-db.yml` **falha em todo push** para `main` (0 s de execução) | GitHub Actions runs #819–826 | Pendente | Médio | P | — |
| INF-16 | `claude-cookbooks-main/` (194 MB de terceiros) versionado; todo `.md` do repo (62 do cookbook, `CLAUDE.md`, docs) embutido num chunk público via `import.meta.glob`. Os 4 docs vivos já foram excluídos em 2026-10-14 ([D-007](./DECISOES.md#d-007)) | `DocumentationPage.tsx:28-41` | Parcial | Médio | P | — |
| INF-17 | Dependência da Lovable (AI Gateway no `ai-chat`, `lovable-tagger`, `.lovable/`, `index.html`) | `ai-chat/index.ts:72-85` | Parcial | Médio | M | decisão sobre a Lovable |
| INF-18 | Sem proteção de branch nem CODEOWNERS versionados; `deploy.yml` roda em qualquer branch | `.github/` | Parcial | Médio | P | — |

**Saúde dos serviços (prod, últimas 24 h em 2026-10-14):** projeto `ACTIVE_HEALTHY`; 0 respostas HTTP 5xx; 0 erros em
`postgres_logs`/`function_logs`. O tráfego atual é basicamente o cron de monitoramento.

---

## 7. Segurança

*Última verificação: 2026-10-14 (varredura da árvore e de 150 commits do histórico; prod ao vivo).*

| ID | Título | Evidência | Status | Sev. | Esf. | Dep. |
|---|---|---|---|---|---|---|
| DOC-01 | **PII de 169 árbitros** (CPF, RG, celular, e-mail, endereço, PIS, banco/agência/conta) versionada em repositório **público** | `docs/arbitros.csv`; `docs/realtorio árbitro`; GitHub: `visibility: public` | Pendente | Crítico | P (HEAD) + G (histórico) | dono do repo / DPO |
| SEC-01 | Única credencial real exposta: chave da Evolution API (ver EF-03). Só a anon key aparece em JWTs (pública por design); nenhuma service role vazou | varredura árvore + histórico | Pendente | Crítico | P | EF-03 |
| SEC-02 | Usuário desativado mantém acesso total pela API (`has_role` ignora `profiles.active`; checagem só no `LoginPage`) | prod `has_role`; `LoginPage.tsx:127-135` | Pendente | Alto | M | — |
| SEC-03 | Assinatura de decisão da CDE falsificável: mesmo token de consulta serve para assinar, como anon, com nome/cargo livres | `CdeAssinarPage.tsx:91-100`; `ProtestosFilaPage.tsx:314-333,939-940` | Pendente | Alto | M | LIVE-02 |
| SEC-04 | Tabelas e bucket da CDE fora das migrations; **confirmado em prod** que anon lê todos os casos (LIVE-02) | `CdeRecursoPage.tsx:189-208`; prod | Pendente | Crítico | M | DB-10 |
| SEC-05 | Bucket `substitution-docs`: qualquer autenticado lê e apaga; anon lê `temp/`; bucket marcado **público** em prod | `20260519000000:52-79`; prod `storage.buckets` | Pendente | Alto | P | — |
| SEC-06 | Buckets sem limite de tamanho/MIME; validação só no cliente | prod `storage.buckets` | Parcial | Baixo/Médio | P | — |
| SEC-07 | XSS armazenado em impressão de QR do atleta (`full_name` sem escape em janela same-origin), agravado por FE-25 | `AtletaQrCodePage.tsx:118-128` (página órfã hoje) | Pendente | Médio | P | — |
| SEC-08 | PIN de pesquisa de 4 dígitos com rate limit por `device_id` escolhido pelo cliente (ignorado se nulo) | `20260704000000:40-66` | Parcial | Médio | P | — |
| SEC-09 | Filtros `.or()` com termo de busca interpolado (limitado pela RLS) | `DelegacoesPage.tsx:148,502` e outros | Pendente | Baixo | P | — |
| SEC-10 | Autorização do front é só UX; a garantia real é RLS/RPC (ver DB-03) | `ProtectedRoute.tsx:15-80` | Parcial | Info | G | DB-03 |
| SEC-11 | Sem cabeçalhos de segurança; QR da CDE gerado por terceiro (`api.qrserver.com`) com token na URL | `vercel.json`; `ProtestosFilaPage.tsx:778` | Pendente | Baixo | P | INF-03 |
| SEC-12 | Dependências: 41 vulnerabilidades (3 críticas, 27 altas); runtime: `xlsx` 0.18.5 sem correção no npm, `react-router` ≤ 6.30.2, `@capacitor` 8.0–8.3.4, `lodash` | `npm audit --omit=dev` 2026-10-14 | Pendente | Médio | M | — |

**Pontos já bem resolvidos (Pronto):** `import-inscricoes`, `import-referees`, `generate-credential-qr`, `validate-qr` e
`monitoring-push` exigem papel; SQL dinâmico seguro (DB-24); `react-markdown` sem `rehype-raw`; sem `eval`/`new Function`;
`document.write` da fila CDE e da pesquisa escapam HTML; `.env` nunca commitado.

---

## 8. Qualidade

*Última verificação: 2026-10-14 (comandos executados localmente após `npm ci`).*

| Verificação | Resultado |
|---|---|
| `vite build` | **Passa** (~40 s). Chunks > 500 kB (react-pdf 1,3 MB, exceljs 938 kB, index 866 kB); precache PWA 451 entradas / 10,9 MB |
| `tsc --noEmit -p tsconfig.app.json` | **65 erros** em 14 arquivos (o build não checa tipos) |
| `eslint .` | **2.548 problemas** (2.434 erros, 114 avisos); 2.372 `no-explicit-any`, 45 `exhaustive-deps`, 2 `rules-of-hooks` (bug real, FE-12) |
| `vitest run` | 12 arquivos, 223 testes: **29 falham** (FE-15) |
| `bun run validate:data` | Não verificável neste ambiente (rede para `*.supabase.co` bloqueada); passa no CI |
| CI em `main` | `CI/CD Pipeline` e `Data Validation` verdes; `sync-test-db.yml` vermelho em todo push (INF-15) |

| ID | Título | Evidência | Status | Sev. | Esf. | Dep. |
|---|---|---|---|---|---|---|
| QA-01 | Overload ambíguo `get_alojamento_kpis(uuid)` × `(uuid, uuid)` **confirmado em prod**; `AlojamentoOcupacaoPage` chama com 1 argumento e ignora o erro (PGRST203 → KPIs zerados) e não aplica escopo de etapa | prod `pg_proc`; `AlojamentoOcupacaoPage.tsx:66-72` | Pendente | Alto | P | — |
| QA-02 | Testes cobrem só `src/lib` (~154 casos). Nada cobre `redeem_voucher`, `voucherScan`/`voucherOffline`, credenciamento, inscrições, publicação, RLS (sem pgTAP) ou Edge Functions | `vitest.config.ts:5-18` | Parcial | Alto | G | INF-05 |
| QA-03 | TypeScript sem rigor (`strict`, `noImplicitAny`, `strictNullChecks` desligados); 38 `rpc(... as any)` | `tsconfig.app.json:16,26` | Pendente | Médio | G | FE-10 |
| QA-04 | ESLint permissivo e fora do CI; não ignora `claude-cookbooks-main`, `supabase/functions` | `eslint.config.js:8,22-23` | Parcial | Baixo/Médio | P | INF-05 |
| QA-05 | Playwright quebrado (ver FE-36) | `playwright.config.ts:1` | Bloqueado | Médio | M | INF-02 |
| QA-06 | Três camadas offline independentes (`useAlojamentoOffline`, `offlineQueue`, `voucherOffline`); só uma com teste | `docs/divida-tecnica.md`; DOC-P01 | Pendente | Médio | G | — |

---

## 9. Pendências: TODOs, fachadas, mocks e dados fictícios

*Última verificação: 2026-10-14.*

| Tipo | Ocorrências | Onde |
|---|---|---|
| `TODO` / `FIXME` / `HACK` | 1 / 0 / 0 | `computeProvaData.ts:62` (status de pesagem não implementado) |
| Fachadas (ação simulada) | 4 `setTimeout` | `RemediationDialog.tsx:104` (usado), `SuperAdminRemediation.tsx:78,89,100` (órfão) → FE-11 |
| Botões sem `onClick` / "Em breve" | ~14 | FE-16 |
| Dados fictícios como valor real | 1 | `useEventOscConfig.ts:20-26` (CNPJ 00.000.000/0001-00, "Rua Exemplo, 123") → FE-13 |
| Dados estimados gravados como reais | 1 migration | DB-04 |
| Mocks de API | 0 | Os "Mock*" de `EntregaTecnicaPage.tsx` são ilustrações do tour |
| `Math.random` em identificadores | 6 usos relevantes | credencial, voucher, protocolo CDE, token OSC, sorteio, PIN |

### 9.1 Pendências herdadas de documentos anteriores (conferidas no código)

| ID | Origem | Pendência | Status hoje |
|---|---|---|---|
| DOC-P01 | `divida-tecnica.md` | Unificar 3 camadas offline | Pendente (= QA-06) |
| DOC-P02 | `auditoria-dashboard-kpis.md` | Escopo de etapa em `get_alojamento_kpis` | Parcial (= QA-01) |
| DOC-P04 | `modulos/transporte-auditoria.md` | Desembarque no PWA | Pendente |
| DOC-P05 | idem | Alocador de passageiros em lote | Pendente |
| DOC-P06 | idem | `driver_name` livre × vínculo de usuário | Parcial |
| DOC-P07 | idem | Alerta "em trânsito" ao finalizar viagem | Pendente (dep. DOC-P04) |
| DOC-P08 | `modulos/alojamento-auditoria.md` | `/pwa/delegacao/alojamento` | Pendente |
| DOC-P12 | `modulos/arbitros-auditoria.md` | `referee_remuneration_configs` sem `has_role()` | A confirmar |
| DOC-P13 | `modulos/alimentacao-auditoria.md` | `needs_meals` na previsão | A confirmar (doc contraditório) |
| DOC-P15 | idem | Janelas legadas sem `event_stage_id` | Pendente |
| DOC-P16 | idem | Busca manual sem RPC dedicada | Pendente |
| DOC-P17 | `modulos/voucher.md` | UNIQUE contra duplo consumo (hoje só `FOR UPDATE`) | Parcial |
| DOC-P19 | idem | Perfis que validam voucher | Parcial |
| DOC-P20 | idem | "Credenciado não usa voucher" | A confirmar |
| DOC-P21 | `registros-diagnostico-atual.md` | Resumo do Dia da Coordenação; assinatura de súmula | Pendente |
| Fechadas | — | KPI de árbitros, guard do perfil de árbitro, migration `referee_profiles`, RLS `lodging_supervisions`, `batch_id`/`replaces_voucher_id`, launchers time/mark/combat/ranking | **Pronto** |

### 9.2 Documentação existente

| ID | Título | Status | Sev. |
|---|---|---|---|
| DOC-02 | Infraestrutura sem documentação (ambientes, deploy real, aplicação de migrations, runbook); os 2 `vercel-acesso-e-deploy.md` estão errados | Pendente | Médio |
| DOC-03 | Docs duplicados/obsoletos/lixo (`refinamentos-ux-ui-pwa` ×2, `vercel-acesso-e-deploy` ×2, `teste-manifest.md`, `inventario-completo-sistema.md`, `super-admin.md`, `menu-cliente-admin.md`, `modulos/voucher.md`); `README.md` e `CHANGELOG.md` raiz param em maio/2026 | Pendente | Baixo/Médio |

A partir de 2026-10-14 os documentos vivos são estes quatro em `docs/` ([D-001](./DECISOES.md#d-001)).

---

## 10. O que não foi verificado (itens explícitos)

*Atualize esta lista conforme cada item for checado.*

| Item | Por quê | Como verificar |
|---|---|---|
| Projeto Supabase de **teste** (`wiwvpokdbklathfkjmzl`) | Não acessível pela conta conectada | Conectar o projeto ao Supabase MCP ou rodar `supabase db diff` com credencial |
| Painel da **Vercel** (variáveis por ambiente, headers efetivos, domínios, logs de deploy) | Sem acesso | Painel Vercel; `curl -I` em `/index.html` e `/sw.js` de produção |
| `verify_jwt` efetivo e **código publicado** de cada Edge Function vs. repo | Só a lista foi lida; fonte de `admin-users`/`validate-qr` veio de fora do repo | `supabase functions download <nome>` e diff |
| Allow-list de Redirect URLs do Auth | Configuração de painel | Supabase › Auth › URL Configuration |
| Escopo da chave Evolution e exposição do servidor | Servidor externo | Painel da Evolution API |
| Exposição dos schemas `logistica`, `arbitragem`, `cde` no PostgREST | Configuração de painel | Supabase › API › Exposed schemas |
| Lista completa de migrations do repo não aplicadas em prod | Versões não coincidem (LIVE-01); confirmadas 3 por objeto | `supabase db diff` contra prod |
| Escopo exato de cada uma das 207 RPCs anon (quais são legitimamente públicas) | Heurística por regex + 7 leituras completas | Revisão uma a uma na tarefa R-005 |
| `validate:data` | Rede bloqueada neste ambiente | CI (verde em 2026-07-23) |
| Logs da `process-alerts` (chave VAPID vazia) | Função sem cron em prod | Logs de Edge Functions após R-0xx |
| Telas no navegador (UX real) | Auditoria por leitura de código; sem sessão de usuário | Smoke test manual/Playwright por perfil |

---

## Anexo A — Tabelas por domínio (repo)

- **Eventos/etapas:** events, event_stages, event_branding, event_edition_rules, event_rules_audit_log, event_participation_rules, event_role_catalog, event_osc_configs, sports, categories, venues, institutions, delegations, user_delegations, system_config, system_commands, system_sync_status, public_content, report_presets.
- **Pessoas/inscrições:** people, participants, participant_event_stages, participant_sport_events, sport_events, sport_event_rules, sport_event_prova_map, prova_catalog, prova_aliases, participation_irregularities, teams, team_members, substitutions, import_logs, import_row_errors, import_pendencias, import_aliases, sport_family_inferences, registros_mode_logs.
- **Credenciamento:** participant_credentials, credential_templates, credential_scans, external_credentials, credential_audit_log.
- **Vouchers:** service_vouchers, service_voucher_batches, service_voucher_uses, service_voucher_attempts, service_voucher_audit, service_eventual_people.
- **Alimentação:** meal_types, meal_windows, meal_window_patterns, meal_window_eligibility, meal_locations, meal_consumptions, meal_consumptions_unlinked, meal_incidents, meal_audit_logs, meal_forecast_exports.
- **Transporte:** transport_vehicles, transport_routes, transport_trips, transport_passengers; schema `logistica`.
- **Alojamento:** lodging_locations, lodging_units, lodging_wings, lodging_occupancies, lodging_incidents, lodging_presence_logs, lodging_audit_logs, lodging_supervisions, lodging_mattress_inventory, lodging_mattress_movements, lodging_unit_swaps; schema legado `alojamento`.
- **Competição:** competition_phases, competition_groups, competition_matches, competition_match_entries, competition_match_results, match_scores, match_lineups, match_player_stats, match_penalties, match_penalty_shots, match_attachments, match_events, match_attempts, match_discipline, match_evidences, match_results_history, group_draw_lots, official_bulletins, bulletin_documents, bulletin_generation_logs, protests, protest_attachments, protest_audit_log.
- **Árbitros:** referee_profiles, referee_remuneration_configs, referee_indisponibilities, match_officials, match_user_assignments, user_sport_links; schema `arbitragem`.
- **CDE:** disciplinary_cases; schema `cde`; e, só em prod/`types.ts`, cde_cases, cde_attachments, cde_case_history, cde_decision_signatures, cde_logs, cde_notification_logs, cde_recursos.
- **OSC:** osc_registros, osc_accountability_templates, osc_generated_reports, osc_meta_targets.
- **Material:** material_kits, material_deliveries, material_kit_eligibility, material_deliveries_unlinked.
- **Pesquisa:** pesquisa_events, pesquisa_researchers, pesquisa_sessions, pesquisa_surveys, pesquisa_login_attempts.
- **Monitoramento/auditoria:** monitoring_errors, monitoring_metrics, monitoring_events, monitoring_alert_state, push_subscriptions, audit_events, db_operation_logs, performance_logs, remediation_logs, access_logs, operational_incidents, operational_evidence, pwa_telemetry.
- **Perfis:** profiles, user_roles, user_sessions, user_stage_assignments.

## Anexo B — Objetos sem migration (existem em prod e/ou `types.ts`)

Tabelas: athlete_substitutions, bot_config, cde_attachments, cde_case_history, cde_cases, cde_decision_signatures, cde_logs,
cde_notification_logs, cde_recursos, crachas_temp, delegation_requests, disciplinary_sanctions, document_requirements,
event_staff_credentials, event_stage_sports, importacao_temp, jerpa_functional_classifications, jerpa_support_needs,
participant_documents, participant_event_roles, participant_national_eligibility, phase_qualification_rules,
rpc_idempotency_log, state_selection_callups, substitution_documents, venue_event_stages; tabelas `enq_*` da Enquete.
Funções: rpc_substitute_athlete, rpc_unpublish_results_for_sport_event, rpc_create_event_participant, rpc_import_referees,
bot_get_full_context, bot_lookup_participant, restore_meal_consumption, substituicao_buscar_delegacao_por_nome,
substituicao_buscar_delegacoes_etapa, seed_jer_2026_*, enq_votar, enq_finalizar_cadastro, enq_apuracao e outras.
View: v_credenciamento_externo.

## Anexo C — Listas de apoio do frontend

- **Mutações sem `onError`:** AlimentacaoPrevisaoPage.tsx:281, CredenciamentoPage.tsx:263, OscAccountabilityModule.tsx:119,146,160,177, ranking/ArbitragemTab.tsx:159, time-mark/ArbitragemTab.tsx:164, SuperChamadosPage.tsx:74, SuperConfigPage.tsx:67, SuperFamiliasInferidasPage.tsx:62,76 (+ 4 em páginas órfãs).
- **Arquivos > 800 linhas (top 10):** ProtestosFilaPage 2001 · AlimentacaoScanPage 1793 · CredenciamentoPage 1760 · MaterialEntregaPage 1658 · VouchersPage 1424 · VincularCredencialPage 1413 · PessoasPage 1373 · CompeticaoPartidaDetalhePage 1297 · MaterialScanPage 1265 · EntregaTecnicaPage 1205.
- **Código morto (exemplos):** MatchScoreFormDrawer (627), InstitutionFormDialog (301), useEventEditionRules (295), CrossHeatRankingTab (266), ReportCenterPage (249), SuperAdminRemediation (221), SportEventRuleDrawer (203), lib/emailTemplates (171).
- **Páginas com consulta sem estado de erro:** 96 (heurística: nenhum `isError` nem render de erro). Inclui todas as `pwa/arbitragem/*`, TransporteViagensPage, VoucherValidarPage, AlojamentoOcupacaoPage, CompeticaoPainelPage, DelegacoesPage, AuditoriaPage.
