# 03 — Regras de Negócio

## Regras Permanentes

### 1. Base Operacional do Evento
A inscrição oficial é realizada no sistema oficial (SIGECOM), conforme Regulamento. O JER Gestão **importa/espelha** os dados exportados do SIGECOM para montar a **base operacional do evento**, materializando automaticamente instituições, delegações, modalidades, categorias e provas. Essa base não tem valor regulatório de inscrição — serve exclusivamente para execução de campo.

### 2. Credencial é Central
- Toda operação logística e esportiva exige credencial ativa.
- QR Code é o meio de validação em todos os pontos operacionais.
- Formato oficial: `jer:{event_id}:{participant_id}:{credential_code}`.

### 3. Vouchers QR (Invariante Canônico JER-VOU-02)
**Invariante:** 1 voucher = **1 evento × 1 etapa × 1 dia × 1 janela** (refeição, viagem ou diária de alojamento).

- O voucher é instrumento **exclusivo para pessoas eventuais** (prestadores, visitantes, acompanhantes).
- **Participantes credenciados nunca usam voucher**; em caso de extravio, a credencial é reemitida.
- Cada voucher é vinculado a **uma instância específica** (uma `meal_window`, uma `transport_trip` ou uma `lodging_location` + `target_date`).
- **Válido somente no dia** — `valid_from`/`valid_until` são derivados da janela‑alvo pelo trigger `derive_voucher_validity`. Voucher de alojamento exige `target_date` explícito (o trigger recusa o INSERT caso contrário). Vouchers sem `valid_until` são recusados como `missing_validity` no resgate (defesa em profundidade).
- **Uso único por (voucher × serviço × instância)** — vale para nominais e agregados (lotes anônimos). `current_uses` é incrementado e `max_uses` enforced pela RPC `redeem_voucher`.
- **Validação estrita de instância:** se o voucher tem `target_*_id` e o caller não passa `p_context_id`, a RPC retorna `wrong_instance` (não há mais "aceite silencioso").
- **Offline com clamp de relógio:** `p_offline_at` no futuro é ignorado (usa `now()`); mais velho que 24 h é recusado como `offline_too_old`. Janelas atravessando meia‑noite (`end_time < start_time`) recebem +1 dia automaticamente em `valid_until`.
- **Reemissão e Auditoria:** extravios são tratados via reemissão (invalida o original, preserva o vínculo). Reemissão pós‑janela é bloqueada cliente e servidor. Todas as operações (consumos, recusas, revogações) ficam em `service_voucher_attempts`/`service_voucher_uses`.
- Vouchers podem ser **nominais** (vinculados a `service_eventual_people`) ou **agregados** (lotes anônimos, 1 QR por pessoa).
- **Permissões:** emissão, revogação e reemissão por `admin`/`secretaria`/`super_admin`. Validação por estes + perfis operacionais (`alimentacao`/`transporte`/`alojamento`/`coordenacao_tecnica`) cada um no seu serviço.

### 4. Participante Regular
Participante só pode ser operado (transporte, alimentação, competição) se estiver com status regular na base do evento (`confirmed` ou superior).

### 4. Sem Duplicidade de Consumo
Cada participante pode consumir **uma refeição por janela de serviço**. O sistema deve impedir registros duplicados.

### 5. Resultados Pós-Publicação
Resultados passam por ciclo: `resultado_lancado` → `validado` → `publicado`. Somente após publicação ficam visíveis ao público externo.

### 6. Permissões Estritas
Cada perfil acessa somente o que lhe compete. RLS é a barreira primária — mesmo com falha no frontend, o banco protege.

### 7. Rastreabilidade
Toda ação relevante registra:
- **Quem** — `user_id` do operador
- **Quando** — timestamp da ação
- **O quê** — natureza da operação
- **Contexto** — evento, participante, ponto de operação

### 8. Capacidade de Alojamento
Trigger de banco impede alocação acima da capacidade da unidade.

### 9. Integridade por Evento
13 triggers garantem que entidades relacionadas pertencem ao mesmo evento (participante ↔ delegação, credencial ↔ participante, equipe ↔ prova, etc.).

### 10. Evidências e Prestação de Contas
Documentos e evidências operacionais devem ser vinculados ao contexto correto (evento, módulo, participante) para servir à execução contratual e prestação de contas (OSC).

### 11. Motor de Regras por Prova
Cada prova (sport_event) deve ter regras parametrizáveis que definem:
- **Família** — natureza da disputa (score, sets, time, mark, combat, ranking)
- **Formato** — estrutura competitiva (knockout, group_stage, round_robin, heats, combat_bracket, ranking)
- **Modo de participação** — individual, equipe, dupla ou revezamento
- **Pontuação** — tipo de placar (gols, pontos, tempo, distância, combate), best-of, set points
- **Desempate** — critérios ordenados (confronto direto, saldo, gols pró, etc.)
- **Políticas de W.O.** — placar automático em caso de desistência (ex: 5×0 no futsal, 20×0 no basquete)
- **Resolução de empate eliminatório** — penalidades, prorrogação, tiro de 7m

### 12. Presets Esportivos
O sistema fornece **22 presets** pré-configurados organizados em 6 categorias:
- **Coletivas** (7): Futsal, Futebol de Campo, Handebol, Basquetebol, Voleibol, Vôlei de Praia 12–14, Vôlei de Praia 15–17
- **Combate** (5): Judô, Karatê Kata, Karatê Kumite, Taekwondo, Wrestling
- **Tempo/Marca** (5): Atletismo Pista, Atletismo Campo, Atletismo Combinadas, Natação, Ciclismo
- **Sets/Confronto Técnico** (3): Badminton, Tênis de Mesa, Tiro com Arco
- **Ranking/Nota** (2): Xadrez (suíço), Ginástica Rítmica
- **Paralímpicas JERPA** (5): Atletismo Paralímpico, Natação Paralímpica, Tênis de Mesa Paralímpico, Parabadminton, Bocha Paralímpica

Cada preset inclui: família, formato, modo de participação, tipo de pontuação, critérios de desempate, política de W.O., resolução de empate eliminatório e mínimo de participantes. Presets podem ser sobrescritos por edição manual. Catálogo definido em `src/config/sportPresetCatalog.ts`.

### 13. Seed Automático de Regras
Ao preparar um evento, o sistema pode gerar regras automaticamente para todas as provas usando heurísticas baseadas no nome da modalidade. Suporta modos:
- **missing_only** — cria regras apenas para provas sem configuração
- **overwrite** — sobrescreve regras existentes (requer perfil admin)
- **dry_run** — simula a operação sem persistir, retornando relatório

### 14. Campeonato Geral — Pontuação e Desempate (Art. 108 e 111)

O sistema calcula automaticamente o ranking do Campeonato Geral em `/admin/relatorios/quadro-medalhas`:

**Tabela de pontos (Art. 108)**: 1º=10, 2º=8, 3º=6, 4º=5, 5º=4, 6º=3, 7º=2, 8º=1.

**Modalidades coletivas** (família `score` ou `sets` com equipes): a posição final da equipe no torneio gera pontos diretos.

**Modalidades individuais**: o sistema calcula o quadro de medalhas interno por modalidade (critério olímpico) e converte a posição resultante em pontos.

**Critério olímpico**: ouros → pratas → bronzes (empate total mantém mesma posição).

**Desempate Art. 111**: total de pontos → mais ouros → mais pratas → mais bronzes → melhor desempenho nas coletivas.

**Detecção JERPA**: regex sobre nome de modalidade/categoria (`paralímpic|paralimpic|\bpara\b|jerpa|parabadminton`). Filtros JER/JERPA separam os dois rankings sem alterar a base de dados.

Apenas resultados com `result_status = 'publicado'` e `position` 1–3 (medalhas) ou 1–8 (pontos) entram no cálculo. Resultados pendentes acionam banner de "Dados parciais".
