# Refinamentos UX/UI e otimizações para módulos PWA

> Baseado na leitura das telas PWA atuais (Transporte, Alimentação, Alojamento, Coordenação Técnica, Delegação e Pesquisa).

## 1) Melhorias transversais (alto impacto)

## 1.1 Unificar shell visual das telas

Hoje há mistura de:
- `PwaHeader` em várias telas;
- headers manuais com estruturas visuais muito parecidas.

**Refinamento recomendado:** padronizar todas as telas em um único header base com:
- botão voltar;
- título + ícone;
- ações contextuais (scan, filtro, logout, sync);
- estado online/offline.

**Benefício:** consistência visual, menor curva de aprendizagem e menos código repetido.

## 1.2 Padronizar estados de loading/erro/vazio

Há uso consistente de `Skeleton` em muitas telas, mas o tratamento de erro é heterogêneo (toast em algumas, silêncio em outras).

**Refinamento recomendado:**
- componente reutilizável para `EmptyState`, `ErrorState` e `RetryState`;
- padrão único de mensagem e CTA ("Tentar novamente").

**Benefício:** UX mais previsível em campo (rede instável).

## 1.3 Normalizar guardas e redirecionamentos

Há divergência entre `/login` e `/pwa/login` em fluxos de guarda.

**Refinamento recomendado:** criar função utilitária única de redirecionamento por contexto PWA e usar em todos os guards.

**Benefício:** elimina bugs de navegação e reduz comportamento inesperado.

## 1.4 Camada de dados com cache/sincronização padronizada

Muitas telas PWA ainda fazem fetch manual com `useEffect`.

**Refinamento recomendado:** migrar gradualmente para `@tanstack/react-query` com:
- cache por módulo;
- invalidação previsível;
- retry/backoff controlado;
- stale time para listas e KPIs.

**Benefício:** menos re-render/fetch redundante e melhor performance percebida.

---

## 2) Transporte (prioridade alta)

### Pontos atuais observados
- Fluxos principais estão cobertos (home, viagens, embarque, scan, passageiros, rotas).
- Embarque já tem validação de motorista e dialogs operacionais.

### Refinamentos UX/UI
1. **Fluxo de scan contínuo**: após sucesso, reabrir scanner automaticamente (com debounce curto) para embarque em lote.
2. **Feedback sonoro + visual de status** (sucesso, duplicado, inválido) com padrão único.
3. **Atalhos na home**: "continuar última viagem" quando existir `trip_status = in_progress` para o usuário.
4. **Modo luva/movimento**: aumentar áreas clicáveis e reduzir densidade de informação no embarque.

### Otimizações
1. **Paginação virtual** na lista de passageiros para viagens longas.
2. **Pré-carregar dados de viagem** ao entrar no módulo (home → embarque mais rápido).
3. **Evitar casts `any`** em mapeamentos de `transport_*` para reduzir regressão em produção.

---

## 3) Alimentação (prioridade alta)

### Pontos atuais observados
- Módulo bem completo (scan, buscar, janelas, histórico, lista de consumos).
- Já existe alerta de duplicidade e diálogo de incidentes.

### Refinamentos UX/UI
1. **Seleção inteligente de janela**: persistir última janela usada por operador e pré-selecionar no scan.
2. **Cartão de resultado pós-scan mais rico**: nome, delegação, tipo de refeição e restrições destacadas.
3. **Ação rápida para correção** em consumo duplicado (abrir histórico filtrado do participante).
4. **Filtros salvos** na "Lista de Consumos" (janela, delegação, tipo).

### Otimizações
1. **Consulta incremental** no histórico/lista para evitar payload grande no início do turno.
2. **Indexação e projeção mínima** para telas de consumo (campos estritamente necessários).
3. **Sincronização em lote de ações offline** com barra de progresso visível ao operador.

---

## 4) Alojamento (prioridade alta)

### Pontos atuais observados
- Fluxo robusto (facility, scan, busca, ocupação, pessoa, incidentes, lista completa).
- Já possui estratégia offline específica e alertas de duplicidade.

### Refinamentos UX/UI
1. **Facility sticky/global**: deixar local selecionado sempre visível no topo das telas críticas.
2. **Check-in/check-out com confirmação contextual** (mostrar bloco/quarto/leito antes de confirmar).
3. **Página da pessoa com timeline** (check-in, transferência, checkout, ocorrência) para auditoria rápida em campo.
4. **Incidentes com severidade por cor + SLA** (tempo aberto, responsável, próxima ação).

### Otimizações
1. **Virtualização** da "Lista Completa" para grandes volumes.
2. **Pré-cálculo de KPIs de ocupação** por facility para reduzir RPCs repetitivas.
3. **Fila offline resiliente** com política de deduplicação por token/participante.

---

## 5) Coordenação Técnica (prioridade média/alta)

### Pontos atuais observados
- Telas cobrem agenda, partidas, detalhe, resultados e estatísticas.

### Refinamentos UX/UI
1. **Detalhe da partida mais operacional**: ações rápidas (iniciar, encerrar, lançar resultado) sem navegação extra.
2. **Filtro avançado em partidas** (modalidade, local, status, faixa horária).
3. **Cores de status unificadas** em todas as telas de competição.
4. **Indicadores de urgência** (partidas atrasadas, sem resultado, conflito de horário).

### Otimizações
1. **Query única agregada** para KPIs da home em vez de múltiplos `count` separados.
2. **Cache por dia/evento** em agenda/resultados.
3. **Remover `any` nos relacionamentos de fase/equipes** para evitar quebra silenciosa em campos aninhados.

---

## 6) Delegação (prioridade média)

### Pontos atuais observados
- Módulo majoritariamente informacional (participantes, agenda, logística, locais).

### Refinamentos UX/UI
1. **Home com alertas úteis**: próximos jogos, pendências de credenciamento, mudança de local.
2. **Busca unificada da delegação** (participante + logística + local) em um único campo.
3. **Cards com CTA real** no bloco de logística (hoje está mais estático/informativo).
4. **Modo impressão/compartilhamento** de agenda do dia para chefe de delegação.

### Otimizações
1. **Pré-cache do dia** (agenda + locais) para uso com internet fraca.
2. **Consultas filtradas por delegação no backend** para payload menor no cliente.

---

## 7) Pesquisa (prioridade média)

### Pontos atuais observados
- Fluxo completo com PIN, sessão, coleta multi-etapa, confirmação e sincronização offline.

### Refinamentos UX/UI
1. **PIN com UX de teclado numérico dedicado** e auto-submit no 4º dígito.
2. **Barra de progresso persistente** no questionário com rótulo de etapa clara.
3. **Auto-save visível** ("rascunho salvo") com timestamp.
4. **Confirmação com atalho contextual** para próximo entrevistado (modo quiosque e modo operador).

### Otimizações
1. **Compressão de fila offline** para respostas pendentes.
2. **Sincronização adaptativa** (wifi/celular) com janela de reenvio configurável.
3. **Métricas de falha de sync** para observabilidade do campo.

---

## 8) Roadmap sugerido de execução (30/60/90 dias)

### 0–30 dias (quick wins)
- Padronizar header e estados de empty/error/loading.
- Unificar redirecionamento de auth PWA.
- Ajustar feedback de scan contínuo (Transporte e Alimentação).

### 31–60 dias
- Migrar telas mais críticas para React Query (Transporte Embarque, Alimentação Scan, Alojamento Lista Completa).
- Virtualização em listas grandes.
- Melhorar filtros persistentes por operador.

### 61–90 dias
- Otimização de queries agregadas + observabilidade de sync offline.
- Revisão de tipagem para remover `any` das telas operacionais.
- A/B de layout touch-first para operações de alto volume.

---

## 9) Recomendação final

Se for para priorizar **impacto operacional imediato**, a ordem é:
1. Transporte (embarque contínuo + desempenho da lista),
2. Alojamento (lista completa + timeline da pessoa),
3. Alimentação (janela inteligente + resolução de duplicidade),
4. Coordenação (ações rápidas em partida),
5. Delegação e Pesquisa (refino de experiência e produtividade).
