# 06 — Storage e Evidências

## Buckets Existentes

| Bucket | Público | Uso atual |
|--------|---------|-----------|
| `credential-templates` | Sim | Imagens de fundo dos modelos de credencial |
| `match-attachments` | Sim | Anexos de partidas (súmulas, fotos, documentos) |

## Observações de Segurança

- `credential-templates` público é aceitável — são templates genéricos sem dados sensíveis
- `match-attachments` público pode ser um risco se conter documentos sensíveis → **avaliar tornar privado** com policies por perfil

## Evidências / OSC — Status Atual

**⛔ Módulo não iniciado.**

### O que existe
- Bucket `match-attachments` permite upload de anexos vinculados a partidas
- Tabela `match_attachments` registra metadados (file_name, file_url, uploaded_by, notes)

### O que falta
- Modelo genérico de evidências que cubra todos os módulos (não apenas competição)
- Vinculação de evidências a contexto operacional (transporte, alimentação, alojamento)
- Metadados para prestação de contas OSC (tipo de documento, período, aprovação)
- Storage policies restritivas por perfil

### Estrutura sugerida (não implementada)
```
evidencias/
├── {event_id}/
│   ├── competicao/
│   ├── transporte/
│   ├── alimentacao/
│   ├── alojamento/
│   └── geral/
```
