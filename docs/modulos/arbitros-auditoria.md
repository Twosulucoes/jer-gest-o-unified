# Auditoria do Módulo de Árbitros — JER Gestão

> **Última Atualização:** 2026-04-28 (Fase 4 Concluída)
> **Estado:** ✅ PLENAMENTE IMPLEMENTADO

Este relatório consolida a implementação das cinco fases (0 a 4) da reformulação do módulo de Árbitros do sistema JER Gestão.

---

## 1. Histórico de Evolução

### Fase 0: Importação de Base Externa
- **Status:** ✅ Concluído
- **Entregas:** Importação idempotente de 168 árbitros via Excel, normalização de dados e vínculo com a entidade única de Pessoas (CPF).

### Fase 1: Cadastro Técnico e Saneamento
- **Status:** ✅ Concluído
- **Entregas:** Unificação das designações na tabela `match_user_assignments`. Bloqueio automático de designação por conflito de interesse (delegação/escola). Cadastro de modalidades habilitadas e categorias técnicos.

### Fase 2: Integração Logística Operacional
- **Status:** ✅ Concluído
- **Entregas:** Inclusão de árbitros nos fluxos de credenciamento (QR único), alimentação, transporte e alojamento. Convocação por etapa permitindo previsão de demanda logística.

### Fase 3: Apuração de Atividades para Remuneração
- **Status:** ✅ Concluído
- **Entregas:** Configuração de tipo de remuneração (Diária vs Partida) por modalidade e etapa. Apuração automática baseada em atuação comprovada no PWA Ao Vivo. Exportação de relatório consolidado para o setor financeiro.


### Fase 4: PWA Ao Vivo — Minha Agenda e Confirmação
- **Status:** ✅ Concluído
- **Entregas:** Área "Minha Agenda" no PWA para árbitros confirmarem presença ou reportarem indisponibilidade em tempo real. Alerta visual global no painel administrativo da etapa para gestão de faltas críticas.

---

## 2. Estrutura de Dados (Fase 3)

| Objeto | Descrição |
| :--- | :--- |
| `referee_remuneration_configs` | Tabela que define a regra de pagamento (diária/partida) por modalidade e etapa. |
| `vw_fulfilled_referee_assignments` | View que filtra apenas designações com atuação comprovada (placar/eventos registrados). |
| `audit_events` | Registro de exportações e alterações de configuração. |

---

## 3. Regras de Apuração

1.  **Por Partida (`per_match`)**: Conta uma unidade por designação nominal em partida que possua registro de atuação (Fulfillment).
2.  **Por Diária (`daily`)**: Conta uma unidade por dia calendário em que o árbitro teve ao menos uma designação cumprida em modalidade configurada como diária.
3.  **Fulfillment**: O cumprimento é comprovado pela existência de eventos, placares ou resultados vinculados à partida no banco de dados.

---

## 4. Permissões e Acesso

- **Configuração de Remuneração**: Restrito a `admin`.
- **Apuração e Exportação**: Disponível para `admin`, `secretaria` e `coordenacao_tecnica`.
- **Operacional**: Árbitros utilizam o PWA Ao Vivo para registrar atuações, que alimentam a apuração automaticamente.

---

## 5. Próximos Passos (Evolução Contínua)

1.  **Súmula Digital**: Gerar o PDF do espelho da súmula com os nomes dos oficiais designados e atuações registradas.
2.  **Notificações Push**: Implementar envio de notificações para o celular do árbitro quando uma nova designação for feita.
