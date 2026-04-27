# 06 — Storage e Evidências

## Buckets Existentes

| Bucket | Público | Uso atual |
|--------|---------|-----------|
| `credential-templates` | Sim | Imagens de fundo dos modelos de credencial |
| `match-attachments` | Sim | Anexos de partidas (súmulas, fotos, documentos) — Legado |
| `operational-evidence` | Não | Evidências OSC unificadas (fotos, documentos, relatórios) |
| `bulletins` | Não | Boletins Oficiais gerados pelo sistema (PDF) |

## Observações de Segurança

- `credential-templates` público é aceitável — são templates genéricos sem dados sensíveis
- `match-attachments` público pode ser um risco se conter documentos sensíveis → **avaliar tornar privado** com policies por perfil

## Evidências / OSC — Modelo Unificado

**✅ Infraestrutura implementada (Abril 2026).**

### Estrutura de Dados
- Tabela `operational_evidence`: Centraliza todos os anexos operacionais para prestação de contas.
- Colunas principais: `module`, `evidence_type`, `reference_table`, `reference_id`, `status` (pending/approved/rejected).

### Armazenamento (Bucket `operational-evidence`)
- **Privado**: Acesso restrito via RLS policies.
- **Organização**: `{event_id}/{module}/{ano-mes}/{uuid_arquivo}.{ext}`.
- **Políticas**:
  - Admin/Secretaria: Acesso total.
  - Perfis Operacionais: Upload e visualização restritos ao próprio módulo (`alimentacao`, `alojamento`, `transporte`, `competicao`).

### Integração com Módulos
- **Alimentação**: Fotos de buffet, listas de presença, notas fiscais.
- **Alojamento**: Fotos de vistorias, checklists de entrada/saída.
- **Transporte**: Relatórios de viagem, diários de bordo.
- **Competição**: Súmulas assinadas, quadros de resultados.
