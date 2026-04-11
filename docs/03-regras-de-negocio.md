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
