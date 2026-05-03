# Módulo de Alimentação — JER Gestão

## Visão Geral
O módulo de Alimentação gerencia o ciclo completo de nutrição dos participantes:
do planejamento de demanda para a cozinha à execução de campo via PWA, com
auditoria operacional para prestação de contas (OSC).

A modelagem evolui em direção a um controle por **refeição × dia × presença
efetiva no evento** — ou seja, só conta para previsão e operação quem
efetivamente está participando da etapa naquele dia.

## Conceitos Centrais
- **Refeição (Meal Type):** café, almoço, jantar, lanche etc., por evento.
- **Janela de Serviço (Meal Window):** instância de uma refeição em um dia
  (`service_date`), horário (`start_time/end_time`), local e capacidade,
  vinculada a uma etapa.
- **Elegibilidade:** regras (perfil, delegação ou instituição) declaradas em
  `meal_window_eligibility`. Define quem **pode** participar daquela janela.
- **Presença efetiva:** participante `is_active`, com `needs_meals = true`,
  já credenciado (`credentialed_at IS NOT NULL`) e sem saída antecipada
  registrada para o dia.
- **Inscrito × Confirmado × Credenciado:** inscrição/confirmação são estados
  administrativos. Apenas o **credenciamento** habilita consumo de refeição
  (trava de presença).

## Regras de Negócio Operacionais

### 1. Janelas
- Um participante registra **um único consumo por janela** (UNIQUE no DB).
- Janelas inativas não aparecem para o operador.
- Capacidade gera **alerta visual** quando atingida (não bloqueia consumo).

### 2. Trava de Presença (todos os caminhos de registro)
Para registrar consumo o participante deve:
1. Ter `is_active = true`.
2. Ter `needs_meals = true` (declarou consumo de refeições).
3. Ter `credentialed_at` preenchido (chegou ao evento).
4. Não ter `left_event_at` preenchido para uma data ≤ `service_date`
   da janela. O DB enforca via trigger
   `ck_meal_consumption_left_event` em `meal_consumptions`; o PWA
   replica a regra para mensagens claras.

Aplica-se a **QR de credencial**, **busca manual** e (futuro) **inserção
manual via Admin**. Vouchers seguem regras próprias do módulo de Vouchers.

### 3. Métodos de Registro
- **QR Code (credencial):** leitura da credencial física do atleta.
- **Voucher:** códigos para convidados/staff/eventuais (uso único ou múltiplo).
- **Busca Manual:** nome/CPF — usado quando não há QR. Sujeita à mesma trava
  de presença do QR.

### 4. Incidentes (Trilha de Auditoria)
Toda tentativa recusada gera linha em `meal_incidents` com:
- tipo do incidente (`DUPLICATE`, `NOT_ELIGIBLE`, `OUTSIDE_WINDOW`, `OTHER`,
  variantes de voucher e — após Etapa 1 — `NO_CREDENTIAL`,
  `PARTICIPANT_INACTIVE`, `NEEDS_MEALS_FALSE`, `LEFT_EVENT`);
- janela alvo, participante (quando identificado);
- operador, instante real, modo (online/offline) e `device_info`.

### 5. Operação Offline
- Janelas do dia ficam em `localStorage` para uso sem rede.
- Consumos offline vão para fila de sincronização.
- Validação de duplicidade no modo offline é **best effort**: o `UNIQUE` do
  banco fecha a porta no momento da sincronização e gera `DUPLICATE` na trilha.

### 6. Cenários típicos
- **Chegada tardia:** atleta credenciado no penúltimo dia só passa a contar
  para a previsão e a operação a partir do credenciamento.
- **Modalidade só no último dia:** atletas só são habilitados quando chegam
  e são credenciados, sem inflar previsão dos dias anteriores.
- **Saída antecipada:** uma vez registrada, encerra a elegibilidade; a partir
  do dia seguinte (ou do horário da saída, se a janela já passou) o
  participante é recusado em todos os caminhos.

## Perfis de Acesso (alvo)

| Ação | admin | secretaria | coord_tecnica | alimentacao | delegacao | publico |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| Configurar tipos/locais/janelas/padrões | ✅ | ✅ | 👁 | 👁 | ❌ | ❌ |
| Registrar consumo | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Ver dashboards/relatórios/divergências | ✅ | ✅ | ✅ | 👁 | 👁 (própria delegação, via `/pwa/delegacao/alimentacao`) | ❌ |
| Registrar saída antecipada | ✅ | ✅ | ❌ | ❌ | 👁 | ❌ |

## Auditoria e Prestação de Contas
- **Realizado por janela:** `meal_consumptions`.
- **Incidentes:** `meal_incidents` (recusas com motivo).
- **Ausências:** previstas por elegibilidade × presença × consumo.
- **Trilha de exportações:** `meal_forecast_exports` (cozinha/buffet).
- **Trilha de configuração:** `created_at`, `updated_at`, `registered_by` em
  todas as tabelas relevantes.

## Estado de Evolução
A auditoria operacional viva está em
[`docs/modulos/alimentacao-auditoria.md`](../modulos/alimentacao-auditoria.md),
com diagnóstico, lacunas e plano incremental por etapas.
