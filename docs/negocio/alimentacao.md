# Módulo de Alimentação - JER Gestão

## Visão Geral
O módulo de Alimentação gerencia o ciclo completo de nutrição dos participantes, desde a previsão de demanda para a cozinha até o controle de acesso nos refeitórios via PWA.

## Regras de Negócio Operacionais

### 1. Janelas de Serviço
- As refeições são organizadas em **Janelas** (ex: Café da Manhã, Almoço, Jantar).
- Cada janela possui: Data, Horário de Início/Fim, Local (Refeitório) e Capacidade.
- Um participante só pode registrar **um consumo por janela**.

### 2. Elegibilidade e Segurança (Trava de Presença)
Para consumir uma refeição, o participante deve:
1.  **Estar Ativo**: O registro no evento deve estar com `is_active = true`.
2.  **Possuir Credencial**: O participante deve ter passado pelo fluxo de credenciamento (`credentialed_at` preenchido).
3.  **Necessitar Alimentação**: O campo `needs_meals` deve ser verdadeiro (configurado na inscrição).
4.  **Estar em Vigência**: Não é permitido consumo após o registro de Checkout da etapa/evento.

### 3. Métodos de Registro
- **QR Code**: Leitura da credencial física do atleta.
- **Voucher**: Uso de códigos de uso único ou múltiplo para convidados/staff.
- **Manual**: Busca por CPF/Nome (usado em contingência).

### 4. Contingência Offline
- O PWA suporta registros offline que são sincronizados automaticamente quando a conexão é restabelecida.
- **Atenção**: Validações de duplicidade em janelas são limitadas no modo offline.

## Perfis de Acesso
- **Admin**: Configuração de janelas, tipos de refeição e dashboard consolidado.
- **Alimentação**: Operação de scanner no PWA e visualização de janelas do dia.
- **Delegação**: Consulta de extrato de consumo dos seus atletas (em desenvolvimento).

## Auditoria
Todas as tentativas de consumo inválidas (duplicidade, sem credencial, voucher expirado) são registradas na tabela `meal_incidents` para conferência posterior.
