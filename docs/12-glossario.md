# 12 — Glossário

| Termo | Definição |
|-------|-----------|
| **JER** | Jogos Escolares de Roraima — evento esportivo escolar estadual |
| **Evento / Edição** | Uma realização do JER (ex: JER 2025, JER 2026) |
| **Instituição** | Escola ou entidade participante |
| **Delegação** | Representação de uma instituição em um evento específico |
| **Participante** | Pessoa inscrita em um evento (atleta, técnico, dirigente, comissão) |
| **Pessoa (People)** | Cadastro base de pessoa física (pode participar de múltiplos eventos) |
| **Modalidade (Sport)** | Esporte praticado (futsal, atletismo, natação...) |
| **Categoria** | Divisão por idade/gênero (sub-14 masculino, livre feminino...) |
| **Prova (Sport Event)** | Combinação modalidade + categoria (Futsal Sub-14 Masc) |
| **Credencial** | Documento oficial do participante no evento, com QR Code |
| **Credential Code** | Código alfanumérico da credencial. Formato: `JER-{timestamp_base36}-{random}` |
| **QR Code Value** | Valor codificado no QR. Formato: `jer:{event_id}:{participant_id}:{credential_code}` |
| **Check-in / Registrar presença** | Confirmar a chegada do participante ao evento |
| **Emitir credencial** | Gerar os códigos (credential_code + qr_code_value) e ativar a credencial |
| **Reemissão / 2ª via** | Invalidar credencial anterior e gerar nova com novos códigos |
| **Scan** | Validação de QR Code em ponto operacional |
| **Scan Point** | Ponto de validação (general, transporte, alimentação...) |
| **Fase (Phase)** | Etapa da competição (fase de grupos, eliminatórias, final) |
| **Grupo** | Chave dentro de uma fase |
| **Partida (Match)** | Confronto entre entries (equipes ou individuais) |
| **Entry** | Participação em uma partida (pode ser team_id ou participant_sport_event_id) |
| **Lineup** | Escalação de jogadores para uma partida |
| **Resultado** | Desfecho de uma partida (score, outcome, position, time) |
| **Publicação** | Ato de tornar um resultado visível ao público |
| **Janela de Serviço (Meal Window)** | Período de atendimento de uma refeição (ex: Almoço 11h-13h) |
| **Consumo** | Registro de que um participante utilizou uma refeição |
| **Unidade (Lodging Unit)** | Quarto ou espaço de alojamento com capacidade definida |
| **Ocupação** | Alocação de participante em unidade de alojamento |
| **RLS** | Row Level Security — políticas de acesso em nível de linha no PostgreSQL |
| **OSC** | Organização da Sociedade Civil — contexto de prestação de contas |
| **SEDUC-RR** | Secretaria de Educação de Roraima — órgão responsável pelo JER |
| **SIGECOM** | Sistema oficial de inscrição do evento (https://sigecom.mms.inf.br). Origem regulatória dos dados de inscrição |
| **Base Operacional** | Dados importados do SIGECOM + estado operacional no JER Gestão (credenciais, QR, consumo, partidas, regras, logs) |
| **Importação / Espelhamento** | Processo técnico que transforma a exportação do SIGECOM em estrutura operacional no JER Gestão. Não constitui inscrição oficial |
| **Role / Perfil** | Papel do usuário no sistema (admin, secretaria, transporte...) |
| **RBAC** | Role-Based Access Control — controle de acesso baseado em perfis |
| **Motor de Regras** | Sistema de parametrização por prova que define família, formato, pontuação, desempate e políticas operacionais da competição |
| **Família (Rules Family)** | Natureza da disputa: score (placar), sets (best-of), time (tempo), mark (marca/distância), combat (luta) ou ranking (sem confronto direto) |
| **Formato (Rules Format)** | Estrutura competitiva da prova: knockout, group_stage, round_robin, heats, heats_final, combat_bracket ou ranking |
| **Preset Esportivo** | Configuração pré-definida de regras para modalidade específica (ex: FUTSAL, BASQUETE, KARATE_KUMITE), incluindo pontuação de grupo, W.O. e desempate |
| **Seed de Regras** | Geração automática de regras para todas as provas de um evento, usando heurísticas baseadas em nomes de modalidades |
| **W.O. (Walkover)** | Vitória por desistência/ausência do adversário, com placar automático definido nas regras (ex: 5×0 no futsal) |
| **Tie-breaker** | Critério de desempate aplicado sequencialmente (confronto direto, saldo de gols, gols pró, etc.) |
| **Bracket** | Chave eliminatória visualizada em formato de árvore de confrontos |
| **Bye** | Folga automática atribuída quando o número de participantes não é potência de 2 |
