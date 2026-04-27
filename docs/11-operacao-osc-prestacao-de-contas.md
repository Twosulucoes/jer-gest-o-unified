# 11 — Operação OSC / Prestação de Contas

## Contexto

O JER é financiado via recursos públicos e requer prestação de contas formal (OSC — Organização da Sociedade Civil ou equivalente). Evidências operacionais precisam ser vinculadas ao contexto correto para servir como comprovação.

## Status Atual: ✅ Infraestrutura Implementada

### O que já existe
- **Tabela `operational_evidence`**: Centraliza evidências de todos os módulos.
- **Bucket `operational-evidence`**: Storage privado com políticas de acesso segmentadas por perfil operacional.
- **Assinatura HMAC de QR Code**: Garante a integridade das credenciais validadas no campo.
- **Rastreabilidade**: `credential_scans` agora identifica formatos legados (`legacy_format`).
- **Controle de Gênero**: Validação via trigger no banco para ocupação de alojamentos.
- **Elegibilidade de Refeições**: Controle fino de quem pode consumir em cada janela.

### Modelo de Dados Unificado (Tabela `operational_evidence`)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `module` | text | credenciamento, alimentacao, alojamento, transporte, competicao, geral |
| `evidence_type` | text | photo, document, list, report, other |
| `reference_table` | text | Nome da tabela vinculada (opcional) |
| `reference_id` | uuid | ID do registro vinculado (opcional) |
| `status` | text | pending, approved, rejected |
| `period_start/end`| date | Período de referência para prestação de contas |

### Cenários de Uso Implementados

1. **Transporte**: Relatórios de viagem e fotos de embarque vinculados ao módulo.
2. **Alimentação**: Listas de presença e fotos de buffet vinculadas à janela de serviço via `reference_id`.
3. **Alojamento**: Fotos de vistorias e ocupação.
4. **Competição**: Súmulas assinadas e boletins oficiais gerados automaticamente (vínculo com `bulletin_documents`).
5. **Geral**: Documentos administrativos do evento.

## Gestão de Evidências (✅ Pronto)

A interface administrativa em `/admin/evidencias-osc` permite:
- **Upload Centralizado**: Operadores de todos os módulos podem subir provas operacionais.
- **Filtros Avançados**: Busca por módulo, tipo, status e período.
- **Fluxo de Governança**: Admin/Secretaria revisam e aprovam cada evidência, preenchendo `reviewed_by` e `review_notes`.
- **Auditoria**: Cada upload é rastreado pelo `uploaded_by` (auth.users).

## Próximos Passos

- Dashboard visual de conformidade OSC (KPIs de cobertura por módulo).
- Exportação de pacotes (ZIP) de evidências por período/módulo para envio formal.
