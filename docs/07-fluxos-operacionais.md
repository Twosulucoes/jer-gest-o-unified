# 07 — Fluxos Operacionais

## 1. Importação de Inscrições

```
Planilha CSV (sistema externo)
  → Upload na página /admin/importacao
  → Edge Function import-inscricoes (pré-processamento)
  → RPC import_inscricoes_batch (SECURITY DEFINER)
  → Materializa: people, institutions, delegations, sports, categories, sport_events, participants, participant_sport_events
  → Registra import_logs
```

**Cenário real**: A secretaria recebe a planilha oficial da SEDUC-RR, faz upload, e o sistema cria automaticamente toda a estrutura necessária.

## 2. Credenciamento

```
Participante chega ao evento
  → Operador busca na /admin/credenciamento (por nome, CPF, delegação)
  → Verifica status (confirmed ✓ / pending ⚠)
  → "Registrar presença" (check-in) — marca credentialed_at
  → "Emitir credencial" — gera credential_code + qr_code_value
  → Preview da credencial visual (Canvas)
  → Imprime etiqueta / credencial
```

**Cenário real**: Atleta da escola X chega, operador busca pelo nome, registra presença e emite credencial com QR Code.

## 3. Validação de QR Code

```
Participante apresenta credencial em ponto operacional
  → Operador usa /admin/validacao-qr (câmera do dispositivo)
  → QR Code lido → Edge Function validate-qr
  → Busca credential por qr_code_value
  → Valida: status ativo? mesmo evento? não revogada?
  → Retorna dados do participante (nome, foto, instituição, tipo)
  → Registra scan em credential_scans
```

**Cenário real**: Participante vai almoçar, apresenta credencial, operador valida QR e confirma identidade.

## 4. Reemissão (2ª Via)

```
Credencial perdida/danificada
  → Operador acessa página do participante → aba Credencial
  → "Reemitir credencial"
  → Credencial anterior: status → 'reissued', revoked_at → now()
  → Nova credencial: novos credential_code + qr_code_value
  → Preview e impressão da nova credencial
```

## 5. Registro de Refeição

```
Janela de serviço aberta (ex: Almoço 11h-13h)
  → Participante apresenta credencial
  → Operador valida QR
  → Sistema verifica: já consumiu nesta janela?
  → Se não → registra meal_consumption
  → Se sim → bloqueia (anti-duplicidade)
```

## 6. Competição e Resultado

```
Coordenação monta chaves/fases por prova
  → Cria partidas com entries (equipes ou individuais)
  → No dia: registra lineups, eventos de jogo, placar
  → Pós-jogo: lança resultado (resultado_lancado)
  → Coordenação valida → validado
  → Secretaria publica → publicado (visível ao público)
```
