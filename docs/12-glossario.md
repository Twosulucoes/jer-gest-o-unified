# 12 — Glossário

> Auditoria atualizada em 2026-04-14

| Termo | Definição |
|-------|-----------|
| **JER** | Jogos Escolares de Roraima — evento esportivo escolar estadual |
| **JERPA** | Jogos Escolares Paradesportivos de Roraima |
| **Evento / Edição** | Uma realização do JER (ex: JER 2025, JER 2026) |
| **Instituição** | Escola ou entidade participante |
| **Delegação** | Representação de uma instituição em um evento específico |
| **Participante** | Registro de uma Pessoa em um Evento específico, podendo ser de Delegação ou Organização |
| **Participante Delegação** | Atletas e Staff vinculados a uma Instituição de ensino |
| **Participante Organização** | Pessoas da equipe de coordenação e apoio (Saúde, TI, Arbitragem, etc) |
| **Pessoa (People)** | Cadastro base de pessoa física (pode participar de múltiplos eventos) |
| **Pessoa Eventual** | Pessoa sem credencial oficial que recebe voucher (prestador, visitante, etc) |
| **Modalidade (Sport)** | Esporte praticado (futsal, atletismo, natação...) |
| **Categoria** | Divisão por idade/gênero (sub-14 masculino, livre feminino...) |
| **Prova (Sport Event)** | Combinação modalidade + categoria (Futsal Sub-14 Masc) |
| **Credencial** | Documento oficial do participante no evento, com QR Code |
| **Credential Code** | Código alfanumérico da credencial. Formato: `JER-{timestamp_base36}-{random}` |
| **Voucher** | Instrumento de acesso temporário para um serviço específico, exclusivo para eventuais |
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
| **Boletim Oficial** | Documento formal que oficializa resultados publicados |
| **Publicação** | Ato de tornar um resultado visível ao público (requer boletim) |
| **Governança de Resultado** | Ciclo resultado_lancado → resultado_validado → publicado |
| **Janela de Serviço (Meal Window)** | Período de atendimento de uma refeição (ex: Almoço 11h-13h) |
| **Consumo** | Registro de que um participante utilizou uma refeição |
| **Unidade (Lodging Unit)** | Quarto ou espaço de alojamento com capacidade definida |
| **Ocupação** | Alocação de participante em unidade de alojamento |
| **RLS** | Row Level Security — políticas de acesso em nível de linha no PostgreSQL |
| **OSC** | Organização da Sociedade Civil — contexto de prestação de contas |
| **SEDUC-RR** | Secretaria de Educação de Roraima — órgão responsável pelo JER |
| **SIGECOM** | Sistema oficial de inscrição do evento. Origem regulatória dos dados |
| **Base Operacional** | Dados importados do SIGECOM + estado operacional no JER Gestão |
| **Importação / Espelhamento** | Processo técnico que transforma a exportação do SIGECOM em estrutura operacional |
| **Role / Perfil** | Papel do usuário no sistema (admin, secretaria, transporte...) |
| **RBAC** | Role-Based Access Control — controle de acesso baseado em perfis |
| **Motor de Regras** | Sistema de parametrização por prova (família, formato, pontuação, desempate) |
| **Família (Rules Family)** | Natureza da disputa: score, sets, time, mark, combat ou ranking |
| **Formato (Rules Format)** | Estrutura competitiva: knockout, group_stage, round_robin, heats, heats_final, combat_bracket ou ranking |
| **Preset Esportivo** | Configuração pré-definida de regras para modalidade específica |
| **Seed de Regras** | Geração automática de regras para todas as provas de um evento |
| **W.O. (Walkover)** | Vitória por desistência/ausência, com placar automático |
| **Tie-breaker** | Critério de desempate aplicado sequencialmente |
| **Bracket** | Chave eliminatória em formato de árvore |
| **Bye** | Folga automática quando número de participantes não é potência de 2 |
| **Cross-heat Ranking** | Ranking consolidado de atletas de todas as baterias de uma prova |
| **Bateria / Série (Heat)** | Grupo de atletas que competem juntos em uma rodada de prova individual |
| **combat_detail** | Campo JSONB em competition_match_results para detalhes de combate |
| **PWA** | Progressive Web App — aplicação web instalável no celular |
| **Ao Vivo** | PWA para mesários registrarem partidas em tempo real |
| **System Messages** | Dicionário central de mensagens compartilhadas entre PWAs e Admin (`systemMessages.ts`) |
