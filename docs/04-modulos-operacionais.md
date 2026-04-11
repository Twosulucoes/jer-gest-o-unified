# 04 — Módulos Operacionais

## 1. Importação (✅ Feito)
- **Página**: `/admin/importacao`
- **Backend**: Edge function `import-inscricoes` + RPC `import_inscricoes_batch`
- **Auditoria**: `import_logs`
- **Comportamento**: idempotente, cria/reutiliza entidades, suporta múltiplas provas por linha

## 2. Credenciamento (✅ Feito)
- **Página**: `/admin/credenciamento`
- **Ações**: check-in (registrar presença), emitir credencial, reemitir (2ª via), batch com confirmação
- **Labels**: "Registrar presença" (check-in), "Emitir credencial" (geração), "Registrar presença e emitir" (combinado)
- **Status visíveis**: Pendente → Confirmado → Pronto p/ emissão → Credencial ativa

## 3. Credencial + QR Code (✅ Feito)
- **Templates**: `/admin/credenciais/modelos` — CRUD com upload de imagem base e config de campos
- **Geração**: client-side Canvas com QR Code via biblioteca `qrcode`
- **Utilitário**: `credentialUtils.ts` — formato único para `credential_code` e `qr_code_value`
- **Validação**: Edge function `validate-qr` + tabela `credential_scans`
- **Reemissão**: invalida anterior (status `reissued`), gera novos códigos

## 4. Transporte (🟡 Parcial)
- **Páginas**: veículos, rotas, viagens, embarque por viagem
- **Tabelas**: `transport_vehicles`, `transport_routes`, `transport_trips`, `transport_passengers`
- **Gap**: sem controle de retorno explícito, sem relatórios

## 5. Alimentação (🟡 Parcial)
- **Páginas**: tipos de refeição, janelas de serviço, registro de consumo
- **Tabelas**: `meal_types`, `meal_windows`, `meal_consumptions`
- **Gap**: ⚠️ sem UNIQUE constraint `(meal_window_id, participant_id)` para evitar duplicidade

## 6. Alojamento (🟡 Parcial)
- **Páginas**: locais, unidades, ocupação
- **Tabelas**: `lodging_locations`, `lodging_units`, `lodging_occupancies`
- **Trigger**: `validate_lodging_capacity` impede alocação acima da capacidade
- **Gap**: sem relatório de ocupação, sem controle temporal de permanência

## 7. Competição (✅ Feito)
- **Páginas**: fases, grupos, equipes, partidas, detalhe da partida, agenda, resultados
- **Tabelas**: 13 tabelas (phases, groups, matches, entries, results, scores, lineups, events, penalties, officials, attachments, attempts, player_stats)
- **Features**: lineup de jogadores, eventos de jogo, placares por período, tentativas (atletismo), estatísticas individuais, anexos

## 8. Apuração e Resultados (🟡 Parcial)
- **Página**: `/admin/competicao/resultados`
- **Campos**: `result_status` (resultado_lancado → publicado), `validated_at`, `published_at`
- **RLS anon**: permite SELECT onde `result_status = 'publicado'`
- **Gap**: sem workflow explícito validação → publicação no frontend

## 9. Publicação Oficial (🟡 Parcial)
- **RLS**: funcional para anon
- **Gap**: sem portal público, sem boletins em PDF

## 10. Evidências / OSC (⛔ Não iniciado)
- **Existente**: bucket `match-attachments` para anexos de partidas
- **Gap**: sem modelo genérico de evidências vinculadas a contexto operacional
