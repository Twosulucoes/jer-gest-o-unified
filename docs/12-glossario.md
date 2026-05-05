# 12 — Glossário

> Atualizado em 2026-05-03 (após Fase E da Normalização).

> Para a constituição formal do domínio, consulte
> [`dominio-canonico.md`](dominio-canonico.md).

| Termo | Definição |
|-------|-----------|
| **JER** | Jogos Escolares de Roraima — evento esportivo escolar estadual |
| **JERPA** | Jogos Escolares Paradesportivos de Roraima |
| **Evento / Edição** | Uma realização do JER (ex: JER 2025, JER 2026). Tabela `events`. |
| **Etapa (Event Stage)** | Sub-evento físico de uma edição (ex: classificatória de Caracaraí, final de Boa Vista). Unidade física e operacional do JER. Tabela `event_stages`. |
| **Quadrante (Domínio Canônico)** | Uma das 4 divisões conceituais do schema: 1) Pessoas, 2) Inscrição, 3) Operação, 4) Competição. Define o escopo (sem evento / evento / etapa). |
| **Lei de Escopo** | Regra do canônico: entidades de operação e competição executiva têm `event_stage_id NOT NULL`; entidades de inscrição têm `event_id NOT NULL`; pessoas e instituições atravessam eventos. |
| **Stage-scoped** | Entidade que pertence a uma e somente uma `event_stage`. Aplica a refeições, alojamento, transporte, vouchers, fases/partidas e a junction de inscrição esportiva. |
| **Pessoa (People)** | Cadastro base de pessoa física. Atravessa eventos. Carrega cadastrais civis: CPF, nome, gênero, data de nascimento, restrições, vínculos `coach_*`/`guardian_*` etc. |
| **Pessoa Eventual** | Pessoa sem credencial oficial que recebe voucher (prestador, visitante, etc). Tabela `service_eventual_people`. |
| **Instituição** | Escola ou entidade. Cadastro mestre civil em `institutions`, agnóstico de evento. |
| **Delegação** | Representação de uma `institutions` em um `events` (ex.: "Escola X no JER 2026"). FK simples para institutions; sem mais cópia espelhada das colunas da escola desde a Fase B3. |
| **Inscrição (Participant)** | Linha em `participants` (1 por pessoa por evento). Carrega só estado de inscrição: tipo, status, presença, declarações de necessidade. |
| **Inscrição em Etapa** | Linha em `participant_event_stages` (junction). Define se a pessoa "existe" naquela etapa para fins de operação. |
| **Inscrição Esportiva** | Linha em `participant_sport_events` por (participante, prova, etapa). UNIQUE com `event_stage_id` desde a Fase F2. |
| **Enrollment Class** | `participants.enrollment_class` — `delegation` (atletas e staff vinculados a escola) ou `organization` (apoio/coordenação). Renomeado de `category` na Fase C para evitar colisão com a tabela `categories`. |
| **Participant Type** | `participants.participant_type` — enum com 19 valores: `athlete`, `coach`, `head_of_delegation`, `official`, `staff`, `motorista`, `agente_operacao`, `logistica`, `cozinheira`, `guia`, `secretaria`, `mesario`, `arbitro`, `delegado`, `fiscal`, `operador_pesquisa`, `tecnico_ti`, `terceiro`, `colaborador`. Enum desde a Fase C. |
| **Modalidade (Sport)** | Esporte praticado (futsal, atletismo, natação...). Tabela `sports`, escopo por evento. |
| **Categoria** | Faixa etária + gênero esportiva (sub-14 masculino, livre feminino...). Tabela `categories`, escopo por evento. **Não confundir com `enrollment_class`.** |
| **Prova (Sport Event)** | Combinação modalidade + categoria (Futsal Sub-14 Masc). Tabela `sport_events`. |
| **Time (Team)** | Equipe da delegação numa prova específica (`teams`). Conceitual; o mesmo time atravessa etapas. |
| **Lineup** | Escalação de jogadores **para uma partida específica**. Pode mudar entre partidas/etapas. |
| **Fase (Phase)** | `competition_phase` — bloco da disputa **dentro de uma etapa**. `event_stage_id NOT NULL` desde a Fase F3. |
| **Grupo** | Chave dentro de uma fase. |
| **Partida (Match)** | Confronto entre entries (equipes ou individuais). Stage-scoped. |
| **Entry** | Participação em uma partida (pode ser team_id OU participant_sport_event_id). |
| **Resultado** | Desfecho de uma partida (score, outcome, position, time). |
| **Boletim Oficial** | Documento formal que oficializa resultados publicados. |
| **Publicação** | Ato de tornar um resultado visível ao público (requer boletim). |
| **Governança de Resultado** | Ciclo `resultado_lancado → resultado_validado → publicado` (enum `match_result_status`). |
| **Credencial** | Documento oficial do participante no evento, com QR Code. Vale para o evento inteiro (não muda entre etapas). |
| **Credential Code** | Código alfanumérico da credencial. Formato: `JER-{timestamp_base36}-{random}`. |
| **QR Code Value** | Valor codificado no QR. Formato: `jer:{event_id}:{participant_id}:{credential_code}`. |
| **Voucher** | Instrumento de acesso temporário a um serviço. **Stage-scoped** desde a Fase F1: voucher é consumo da etapa. |
| **Check-in / Registrar presença** | Confirmar a chegada do participante ao evento. |
| **Emitir credencial** | Gerar os códigos (credential_code + qr_code_value) e ativar a credencial. |
| **Reemissão / 2ª via** | Invalidar credencial anterior e gerar nova com novos códigos. |
| **Scan** | Validação de QR Code em ponto operacional. |
| **Scan Point** | Ponto de validação (general, transporte, alimentação...). |
| **Janela de Serviço (Meal Window)** | Período de atendimento de uma refeição (ex: Almoço 11h-13h) em uma data/etapa específica. |
| **Consumo** | Registro de que um participante utilizou uma refeição (`meal_consumptions`). |
| **Trava de Presença (Alimentação)** | Conjunto de validações que só libera consumo de refeição para participante `is_active`, `needs_meals`, com `credentialed_at` preenchido e sem saída do evento registrada antes da `service_date` da janela. Aplica a QR e busca manual no PWA. |
| **Incidente de Refeição (Meal Incident)** | Registro auditável de tentativa recusada (`meal_incidents`) com tipo, instante, operador e participante. |
| **Presença Efetiva (no evento)** | Estado derivado: pessoa que credenciou e ainda não registrou saída antecipada — fonte de verdade para previsão diária e elegibilidade operacional de Alimentação. |
| **Saída Antecipada (Left Event)** | Registro formal em `participants.left_event_at` indicando que o participante deixou o evento. Encerra a elegibilidade para refeições/alojamento a partir da data informada (validado por trigger no `meal_consumptions` e por handler em `lodging_occupancies`). |
| **Substituição** | Ato regulamentar de trocar atletas em uma prova/time durante o evento. Versiona `participant_sport_events`; consumos não retroagem. (Feature futura — Fase G.) |
| **Unidade (Lodging Unit)** | Quarto ou espaço de alojamento com capacidade definida. Stage-scoped. |
| **Ocupação** | Alocação de participante em unidade de alojamento. |
| **RLS** | Row Level Security — políticas de acesso em nível de linha no PostgreSQL. |
| **OSC** | Organização da Sociedade Civil — contexto de prestação de contas. |
| **SEDUC-RR** | Secretaria de Educação de Roraima — órgão responsável pelo JER. |
| **SIGECOM** | Sistema oficial de inscrição do evento. Origem regulatória dos dados. |
| **Base Operacional** | Dados importados do SIGECOM + estado operacional no JER Gestão. |
| **Importação / Espelhamento** | Processo técnico que transforma a exportação do SIGECOM em estrutura operacional. |
| **Role / Perfil** | Papel do usuário no sistema (admin, secretaria, transporte...). Enum `app_role`. |
| **RBAC** | Role-Based Access Control — controle de acesso baseado em perfis. |
| **Documento Canônico** | `docs/dominio-canonico.md` — constituição do projeto. Toda decisão de schema/código respeita ou altera explicitamente este documento. |
| **Motor de Regras** | Sistema de parametrização por prova (família, formato, pontuação, desempate). |
| **Família (Rules Family)** | Natureza da disputa: score, sets, time, mark, combat ou ranking. |
| **Formato (Rules Format)** | Estrutura competitiva: knockout, group_stage, round_robin, heats, heats_final, combat_bracket ou ranking. |
| **Preset Esportivo** | Configuração pré-definida de regras para modalidade específica. |
| **Seed de Regras** | Geração automática de regras para todas as provas de um evento. |
| **W.O. (Walkover)** | Vitória por desistência/ausência, com placar automático. |
| **Tie-breaker** | Critério de desempate aplicado sequencialmente. |
| **Bracket** | Chave eliminatória em formato de árvore. |
| **Bye** | Folga automática quando número de participantes não é potência de 2. |
| **Cross-heat Ranking** | Ranking consolidado de atletas de todas as baterias de uma prova. |
| **Bateria / Série (Heat)** | Grupo de atletas que competem juntos em uma rodada de prova individual. |
| **combat_detail** | Campo JSONB em competition_match_results para detalhes de combate. |
| **PWA** | Progressive Web App — aplicação web instalável no celular. |
| **Ao Vivo** | PWA para mesários registrarem partidas em tempo real. |
| **System Messages** | Dicionário central de mensagens compartilhadas entre PWAs e Admin (`systemMessages.ts`). |
