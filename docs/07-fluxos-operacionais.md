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

## 7. Competição (Operação por Família)

### 7.1 Famílias "Score", "Sets" e "Combat" (Novos Painéis)
```
Coordenação opera modalidades "score", "sets" ou "combat"
  → Painel da Competição (/admin/competicao/painel)
  → Seleciona modalidade (Card Score, Sets ou Combat) → Abre Painel correspondente

FLUXO COMBAT:
  → Seleciona Categoria de Peso no topo do painel
  → Aba Pesagem: Registra peso oficial e marca status (Conferido / Fora do Peso)
  → Aba Chave: Quando pesagem concluída, clica em "Montar Chave"
  → Sistema gera bracket eliminatório (BYE automático) e confrontos da 1ª fase
  → Aba Lutas: Visualiza grade densa com agenda e status das lutas
  → Editar Luta (Drawer): Define data/hora/local e designa arbitragem por modalidade
  → Pós-Luta: Lança resultado no detalhe da partida (vencedor avança automaticamente e bracket atualiza visualmente)

FLUXO SCORE/SETS:
  → Grade de confrontos: filtra por fase/grupo/status
  → Visualização Sets: mostra placar (ex: 3×1) e parciais (ex: 25-18 / ...) na grade
  → "Novo Confronto" ou "Editar" (Drawer):
     - Seleciona Fase/Grupo
     - Seleciona Escola A e B (lista filtrada por inscritos)
     - Define Data/Hora/Local
     - Define equipe de arbitragem (filtrada por modalidade)
     - Referência: formulário exibe formato de sets (melhor de X) das regras
  → Salvar: Cria confronto + entries + assignments
  → Lançar Resultado (Novo):
     - Botão "Troféu" na grade → Abre rota dedicada full-screen
     - Placar por Período: soma automática para o placar total
     - W.O.: ativa toggle → seleciona vencedor → aplica placar automático das regras
     - Cartões: registro individual por atleta com tipo e minuto
     - Pênaltis: em caso de empate em eliminatórias, registra cobranças individuais
     - Auditoria: snapshot completo do payload gravado no histórico a cada salvamento
      - Vencedor: identificado automaticamente pela RPC com base no placar consolidado
      - Homologação: após lançamento, coordenador valida com senha → status "Validado"
```

### 7.2 Homologação e Publicação (Governança)
```
Resultado Lançado (Mesário/Coordenador)
  → Tela de Lançamento (/admin/competicao/painel-score/.../resultado)
  → Coordenador clica "Homologar Resultado"
  → Diálogo de confirmação → Digita senha do coordenador
  → RPC rpc_homologate_match_result → Status: "resultado_validado"
  → Bloqueia edição para todos exceto Admin

Publicação (Secretaria)
  → Central de Publicação (/admin/competicao/publicacao)
  → Filtra resultados em status "Aguardando Publicação" (Validados)
  → Seleciona uma ou mais partidas → "Publicar Selecionados"
  → RPC rpc_publish_match_result → Status: "publicado"
  → Resultado visível instantaneamente no Portal Público

Reversão (Admin - Exceção)
  → Admin acessa tela de lançamento ou central de publicação
  → Clica em "Reverter Status" → Digita justificativa obrigatória
  → RPC rpc_revert_match_result_status → Volta para status anterior
  → Registra auditoria completa do motivo da reversão
```

### 7.2 Outras Famílias (Central Legada)
```
Coordenação monta chaves/fases por prova (Individuais, Combate)
  → Central da Competição (/admin/competicao/central)
  → Seleciona prova → sistema carrega regras (sport_event_rules)
  → Wizard adapta labels conforme família/formato
  → Cria partidas com entries (equipes ou individuais)
  → Mesmos fluxos de resultado e publicação
```

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
