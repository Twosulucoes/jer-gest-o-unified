## Plano de Implementação — Credenciais Visuais

### O que será reaproveitado
- `participant_credentials` (QR code, credential_code já existem)
- `participants` + `people` + `delegations` + `institutions` (dados dinâmicos)
- Fluxo de credenciamento já funcional
- `participant_sport_events` + `sport_events` (modalidade/prova)

### 1. Migration — Tabela + Storage
**Tabela `credential_templates`:**
- `id`, `event_id`, `name`, `is_active`, `notes`
- `background_url` (URL do arquivo no Storage)
- `width`, `height` (dimensões do modelo em px)
- `field_config` (JSONB) — posição de cada campo dinâmico
- `created_at`, `updated_at`

**Storage bucket:** `credential-templates` (público para leitura da imagem base)

**RLS:** admin, secretaria, coordenacao_tecnica podem gerenciar

### 2. Campos dinâmicos suportados (JSONB `field_config`)
Cada campo terá: `{ x, y, width, height, fontSize, fontColor, align, visible }`
- `full_name` — nome completo
- `institution` — instituição/delegação
- `participant_type` — tipo (atleta, técnico, etc.)
- `sport_event` — modalidade/prova
- `credential_code` — código serial
- `qr_code` — QR Code (posição e tamanho)
- `photo` — foto do participante (se houver)

### 3. Telas administrativas
- `/admin/credenciais/modelos` — CRUD de modelos de credencial
  - Upload do arquivo base
  - Formulário com config de campos (inputs numéricos simples)
  - Preview com dados fictícios
- Botão "Gerar Credencial Visual" na tela de credenciamento (para participantes já com credencial emitida)

### 4. Geração da credencial (client-side Canvas)
- Carregar imagem base
- Sobrepor textos e QR Code via Canvas API
- Gerar QR Code com biblioteca `qrcode` (npm)
- Exibir preview em modal
- Botão para download PNG / impressão

### 5. Fora desta etapa
- Editor visual drag-and-drop
- Geração em lote (batch)
- Foto do participante (campo preparado mas sem upload agora)
- Portal público de verificação de credencial
- Geração server-side (PDF via edge function)

### Dependências npm necessárias
- `qrcode` — geração de QR Code no browser

### Arquivos a criar/modificar
1. Migration SQL (tabela + storage + RLS)
2. `src/pages/admin/CredencialModelosPage.tsx` — gestão de modelos
3. `src/components/admin/CredentialTemplateFormDialog.tsx` — formulário
4. `src/components/admin/CredentialPreview.tsx` — preview/geração Canvas
5. Atualizar `AdminLayout.tsx` e `App.tsx` com nova rota
6. Integração na tela de credenciamento existente
