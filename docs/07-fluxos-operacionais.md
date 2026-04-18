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

## 6. Configuração de Regras por Prova

```
Coordenação prepara evento
  → Acessa /admin/competicao/regras/lote
  → Clica "Gerar regras (somente faltantes)"
  → RPC seed detecta modalidade por nome e aplica preset
  → Relatório: 30 criadas, 0 existentes, 2 sem preset (fallback genérico)
  → Revisão: ajusta manualmente provas específicas
  → Ou: acessa /admin/competicao/regras para editar prova individual
  → Seleciona sport_event → aplica preset ou edita form → salva
```

**Cenário real**: Antes do evento, a coordenação técnica roda o seed automático para gerar regras de todas as provas de uma vez. Depois ajusta manualmente as provas que precisam de configuração especial.

### Presets disponíveis
| Preset | Detecção por nome | Família |
|--------|-------------------|---------|
| FUTSAL | contém "futsal" | score |
| FUTEBOL_DE_CAMPO | contém "futebol" | score |
| HANDEBOL | contém "handebol" | score |
| BASQUETE | contém "basquete" ou "basquetebol" | score |
| KARATE_KATA | contém "karatê/karate" + "kata" | ranking |
| KARATE_KUMITE | contém "karatê/karate" + "kumite" | combat |
| Fallback | não encontrou match | score (genérico) |

## 7. Competição e Resultado

```
Coordenação monta chaves/fases por prova
  → Central da Competição (/admin/competicao/central)
  → Seleciona prova → sistema carrega regras (sport_event_rules)
  → Wizard adapta labels conforme família/formato:
     - score/sets → "Confrontos" / mostra Grupos
     - time/mark → "Séries/Baterias" / oculta Grupos
     - combat → "Lutas (Chave)" / oculta Grupos
     - knockout → "Chaves" / oculta Grupos
  → Cria partidas com entries (equipes ou individuais)
  → No dia: registra lineups, eventos de jogo, placar
  → Pós-jogo: lança resultado (resultado_lancado)
  → Coordenação valida → validado
  → Secretaria publica → publicado (visível ao público)
```

**Cenário real**: Na Central, ao selecionar "Futsal Sub-14 Masc", o sistema carrega as regras (W.O. 5×0, fase de grupos, pênaltis no mata-mata) e ajusta a interface automaticamente.

## 8. Consulta do Quadro de Medalhas e Classificação Geral

```
Coordenação publica resultados de partidas (result_status = 'publicado')
  → Sistema dispara recálculo do quadro (cache react-query 30s)
  → Acesso em /admin/relatorios/quadro-medalhas (admin/secretaria/coord. técnica)
  → Aplica filtros: Escopo (Geral/JER/JERPA), Tipo (Coletivas/Individuais), Modalidade
  → Aba "Quadro de Medalhas": ordenação olímpica (ouro → prata → bronze)
  → Aba "Classificação Geral": Art. 108 (1º=10..8º=1 pts) separando coletivas/individuais
  → Banner amarelo aparece se houver SE com partidas concluídas mas sem publicação
  → Exporta PDF (selo OFICIAL/PARCIAL) ou XLSX
```

**Cenário real**: Após a final do Futsal Sub-14, secretaria publica o resultado. O quadro recalcula automaticamente e a escola campeã ganha 10 pts em "Coletivas".
