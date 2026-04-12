# 03 — Regras de Negócio

## Regras Permanentes

### 1. Base Operacional do Evento
A inscrição oficial é realizada no sistema oficial (SIGECOM), conforme Regulamento. O JER Gestão **importa/espelha** os dados exportados do SIGECOM para montar a **base operacional do evento**, materializando automaticamente instituições, delegações, modalidades, categorias e provas. Essa base não tem valor regulatório de inscrição — serve exclusivamente para execução de campo.

### 2. Credencial é Central
- Toda operação logística e esportiva exige credencial ativa
- QR Code é o meio de validação em todos os pontos operacionais
- Formato oficial: `jer:{event_id}:{participant_id}:{credential_code}`

### 3. Participante Regular
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
O sistema fornece presets pré-configurados por modalidade (Futsal, Futebol, Handebol, Basquete, Karatê Kata, Karatê Kumite) que preenchem automaticamente as regras conforme regulamento. Presets podem ser sobrescritos por edição manual.

### 13. Seed Automático de Regras
Ao preparar um evento, o sistema pode gerar regras automaticamente para todas as provas usando heurísticas baseadas no nome da modalidade. Suporta modos:
- **missing_only** — cria regras apenas para provas sem configuração
- **overwrite** — sobrescreve regras existentes (requer perfil admin)
- **dry_run** — simula a operação sem persistir, retornando relatório
