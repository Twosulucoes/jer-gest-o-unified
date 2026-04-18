# Importação (SIGECOM) — Espelhamento Operacional

## 1. Base Normativa (Regulamento)

As inscrições nos Jogos Escolares de Roraima (JER e JERPA) devem ser feitas **exclusivamente por meio do sistema oficial de inscrições do evento (SIGECOM)**, conforme Regulamento Geral 2026, Art. 58–60.

- Endereço: https://sigecom.mms.inf.br/login
- Responsabilidade: escolas e delegações, sob supervisão da SEDUC-RR.

**O JER Gestão NÃO é o sistema de inscrição.** Ele não cria, altera ou valida inscrições oficiais.

---

## 2. Papel do JER Gestão

O JER Gestão **importa/espelha** os dados exportados do SIGECOM para montar a **base operacional do evento**, que permite:

- Credenciamento (check-in, emissão de credenciais, QR Code)
- Logística (transporte, alimentação, alojamento)
- Competição (fases, partidas, resultados)
- Apuração interna e publicação de resultados
- Registro de evidências (prestação de contas / OSC)

---

## 3. Fluxo de Dados

```
SIGECOM (sistema oficial)
  ↓ exportação manual (CSV/XLSX)
Planilha de inscrições
  ↓ upload pelo operador (Admin/Secretaria)
Edge Function import-inscricoes (pré-processamento)
  ↓ chamada RPC
import_inscricoes_batch (PL/pgSQL — SECURITY DEFINER)
  ↓ materializa estrutura operacional
Tabelas no Supabase:
  people, institutions, delegations, sports, categories,
  sport_events, participants, participant_sport_events
  ↓ registra auditoria
import_logs + import_row_errors
```

### O que é externo (SIGECOM)
- Dados de inscrição (nome, CPF, escola, modalidade, categoria)
- Aprovação e homologação de inscrições
- Regulamento e prazos

### O que é controlado no JER Gestão
- Materialização da base operacional (tabelas acima)
- Credenciamento e estado da credencial
- Consumo de refeição, alocação de alojamento, embarque
- Competição, placar, resultado
- Auditoria e rastreabilidade operacional

---

## 4. Regras do Módulo de Importação (Espelhamento)

1. **Origem dos dados**: exportação do sistema oficial de inscrição (SIGECOM). O JER Gestão consome essa exportação.
2. **Finalidade**: preparar base operacional para execução (credenciamento, logística, competição, apuração interna, evidências).
3. **Idempotência**: reimportar a mesma planilha não duplica dados. Pessoas (por CPF), instituições (por slug), delegações, modalidades e categorias são reutilizadas se já existirem.
4. **Tolerância a falhas por linha (Padrão A)**: o lote pode ser parcialmente aplicado; falhas individuais ficam registradas e podem ser corrigidas com reimportação.
5. **Registro de erros**: `import_row_errors` (detalhes por linha) e `import_logs` (resumo do lote).
6. **Tipos de participante**: mapeados conforme coluna da planilha — `athlete`, `coach`, `head_of_delegation`, `staff`.
7. **Unicidade operacional no JER Gestão**:
   - Pessoa/participante por evento: constraint `(person_id, event_id)`
   - Entrada por prova: constraint `(participant_id, sport_event_id)`
8. **Limites técnicos**: até 10.000 linhas por importação. Processamento da planilha XLSX ocorre no navegador (client-side) para evitar limites de memória na Edge Function.
9. **Retorno e UX**: resumo do lote (criados, reutilizados, falhas), banner de aviso quando há falhas parciais, CTA para nova importação.

---

## 5. O que a Importação NÃO faz

- **Não cria inscrição oficial** — inscrição é feita exclusivamente no SIGECOM.
- **Não altera o SIGECOM** — fluxo unidirecional (SIGECOM → JER Gestão).
- **Não valida aprovação do Comitê Organizador** — isso é responsabilidade do processo oficial/externo.
- **Não substitui documentação regulatória** — apenas prepara dados para operação de campo.

---

## 6. O que a Importação PRECISA fazer

- Garantir integridade mínima para o evento rodar (pessoas, delegações, provas).
- Bloquear duplicidades operacionais (constraints de unicidade).
- Permitir reexecução para completar pendências (idempotência + tolerância a falhas).
- Registrar auditoria completa (quem importou, quando, quantos registros, quais erros).

---

## 7. Perfis de Acesso

| Perfil | Permissão |
|--------|-----------|
| **Admin** | Acesso total à importação |
| **Secretaria** | Pode importar e visualizar logs |
| **Coordenação Técnica** | Pode visualizar logs (somente leitura) |
| **Demais perfis** | Sem acesso ao módulo de importação |
