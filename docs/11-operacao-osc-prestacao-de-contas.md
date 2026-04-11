# 11 — Operação OSC / Prestação de Contas

## Contexto

O JER é financiado via recursos públicos e requer prestação de contas formal (OSC — Organização da Sociedade Civil ou equivalente). Evidências operacionais precisam ser vinculadas ao contexto correto para servir como comprovação.

## Status Atual: ⛔ Não Iniciado

### O que já existe
- Bucket `match-attachments` permite upload de anexos vinculados a **partidas**
- `import_logs` registra histórico de importações
- `credential_scans` registra validações de QR
- Campos `*_by` e `*_at` em várias tabelas garantem rastreabilidade

### O que falta

1. **Tabela de evidências genérica** — vinculando documento a qualquer contexto operacional (evento, módulo, participante, viagem, refeição)
2. **Bucket dedicado** para evidências OSC (com policies restritivas)
3. **Metadados OSC** — tipo de documento, período de referência, status de aprovação
4. **Relatórios consolidados** — exportação para prestação de contas

## Modelo Sugerido (Não Implementado)

```
evidencias
├── id
├── event_id
├── modulo (credenciamento, transporte, alimentacao, alojamento, competicao, geral)
├── tipo_documento (lista_presenca, foto, recibo, relatorio, outro)
├── referencia_id (id do registro vinculado, ex: trip_id, meal_window_id)
├── file_url
├── file_name
├── descricao
├── periodo_inicio / periodo_fim
├── uploaded_by
├── created_at
└── status (pendente, aprovado, rejeitado)
```

## Cenários de Uso

1. **Transporte**: foto do embarque vinculada à viagem
2. **Alimentação**: lista de presença da refeição vinculada à janela de serviço
3. **Alojamento**: registro fotográfico da ocupação
4. **Competição**: súmula assinada vinculada à partida (já parcialmente coberto)
5. **Geral**: relatório consolidado do evento
