# Dívida Técnica — JER Gestão

## Unificação de Camada Offline (Pós-Evento)

**Data de Registro:** 28 de abril de 2026
**Contexto:** Fase 3 da Reformulação da Navegação.

### Situação Atual
O sistema possui três mecanismos de sincronização offline que agora possuem **paridade de comportamento** (Auto-sync, Retry com contador, Status explícito), mas continuam com implementações técnicas separadas:
1. `useAlojamentoOffline.ts`: Exclusivo para o módulo de Alojamento.
2. `offlineQueue.ts`: Utilizado por Alimentação e Transporte.
3. `voucherOffline.ts`: Utilizado pelo motor transversal de Vouchers.

### Por que foi adiado?
A unificação em uma camada única (ex: um `OfflineManager` central baseado em IndexedDB) envolveria a refatoração completa de módulos já fechados para operação e validados em campo. Durante a janela operacional, o risco de regressão em fluxos críticos de persistência superava o benefício técnico da limpeza de código.

### O que envolve a unificação futura?
- Criar um provedor central de `OfflineQueue` baseado em Context API ou Store.
- Padronizar o esquema de persistência (hoje variando entre LocalStorage e estruturas de dados levemente diferentes).
- Unificar o controle de concorrência e o loop de auto-sync em um único worker ou hook global.
- Padronizar a interface de resolução de conflitos para todos os módulos.
