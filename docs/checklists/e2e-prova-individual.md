# Checklist E2E — Prova Individual (Atletismo Pista/Campo)

## Pré-requisitos
- [ ] Evento criado e ativo
- [ ] Modalidade "Atletismo" cadastrada com family='time' (pista) ou family='mark' (campo)
- [ ] Categoria e provas (100m, salto em distância etc.) cadastradas
- [ ] Atletas importados e inscritos em participant_sport_events

## Passo 1: Criar Prova (sport_event)
- **Onde**: `/admin/competicao/central` → Picker
- **Ação**: Selecionar Atletismo + categoria + gênero + prova específica
- **Critério**: sport_event criado, wizard carrega

## Passo 2: Configurar Regras
- **Onde**: `/admin/competicao/regras` ou via seed automático
- **Ação**: Confirmar que sport_event_rules existe com family='time' ou 'mark', format correto
- **Critério**: Regras carregam no wizard

## Passo 3: Criar Baterias (Heats)
- **Onde**: Wizard Passo 2 → "Estrutura" → Aba "Baterias/Séries"
- **Ação**: Criar fase com phase_type='heats', definir número de séries
- **Critério**: competition_phases e competition_groups criados

## Passo 4: Distribuir Atletas nas Séries
- **Onde**: Wizard Passo 2 → Distribuição automática
- **Ação**: Usar distribuição automática ou manual
- **Critério**: competition_match_entries criados com participant_sport_event_id

## Passo 5: Gerar Partidas (1 por série)
- **Onde**: Wizard Passo 3
- **Ação**: Gerar automaticamente
- **Critério**: competition_matches criadas, 1 por grupo/série

## Passo 6: Agendar Séries
- **Onde**: Wizard Passo 4 → "Agenda"
- **Ação**: Definir horários para cada série
- **Critério**: match_date e start_time preenchidos

## Passo 7: Lançar Tentativas/Tempos
- **Onde**: `/admin/competicao/partida/:id`
- **Ação**:
  - **Pista (time)**: Lançar tempo (time_ms) para cada atleta
  - **Campo (mark)**: Lançar tentativas (match_attempts) com value_cm
- **Critério**: match_attempts e/ou competition_match_results criados

## Passo 8: Verificar Ranking da Bateria
- **Onde**: `/admin/competicao/partida/:id` → IndividualRankingCard
- **Ação**: Confirmar que ranking está ordenado corretamente
- **Critério**:
  - Pista: menor tempo primeiro
  - Campo: maior marca primeiro
  - DSQ/DNS/DNF ao final

## Passo 9: Consolidar Ranking Cross-Heat
- **Onde**: Wizard Passo 5 → Aba "Classificação" → CrossHeatRankingTab
- **Ação**: Verificar consolidação de todas as séries
- **Critério**:
  - Todos os atletas de todas as séries aparecem
  - Ordenação correta (menor tempo ou maior marca)
  - Posições sem empates incorretos

## Passo 10: Lançar Resultado Oficial
- **Onde**: Wizard Passo 6 ou página da partida
- **Ação**: Gravar result_status='resultado_lancado'
- **Critério**: competition_match_results preenchidos com position

## Passo 11: Validar e Publicar
- **Onde**: Governança
- **Ação**: Validar → Criar Boletim → Publicar com boletim
- **Critério**: result_status='publicado', published_bulletin_id preenchido

## Passo 12: Verificar no Portal Público
- **Onde**: `/public/results`
- **Ação**: Navegar até a prova e ver ranking final
- **Critério**: Ranking publicado visível sem login

## Validações Adicionais
- [ ] Atleta com DSQ aparece ao final do ranking
- [ ] Atleta com DNS não tem tempo/marca
- [ ] Cross-heat ranking respeita desempate configurado
- [ ] PDF do boletim contém ranking correto
