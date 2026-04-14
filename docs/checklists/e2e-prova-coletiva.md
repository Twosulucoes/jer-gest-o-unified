# Checklist E2E — Prova Coletiva (Futsal/Handebol/Vôlei)

## Pré-requisitos
- [ ] Evento criado e ativo em `/admin/eventos`
- [ ] Modalidade cadastrada (ex: Futsal) em `/admin/modalidades`
- [ ] Categoria cadastrada (ex: Juvenil Masculino) em `/admin/categorias`
- [ ] Delegações e participantes importados

## Passo 1: Criar Prova (sport_event)
- **Onde**: `/admin/competicao/central` → Picker de Prova
- **Ação**: Selecionar modalidade + categoria + gênero
- **Critério**: sport_event criado, wizard abre no Passo 1

## Passo 2: Inscrever Equipes
- **Onde**: Wizard Passo 1 → Aba "Equipes Inscritas"
- **Ação**: Verificar que equipes da importação aparecem. Se não, ir a `/admin/competicao/equipes`
- **Critério**: ≥2 equipes visíveis no Passo 1

## Passo 3: Estruturar Grupos
- **Onde**: Wizard Passo 2 → "Estrutura"
- **Ação**: Criar fase (ex: "Fase de Grupos"), criar grupo(s), distribuir equipes
- **Critério**: Grupos criados com equipes distribuídas, Passo 2 fica verde

## Passo 4: Gerar Partidas/Confrontos
- **Onde**: Wizard Passo 3 → "Confrontos"
- **Ação**: Usar geração automática de rodadas (round-robin)
- **Critério**: Partidas geradas com match_number sequencial, entries preenchidas

## Passo 5: Agendar
- **Onde**: Wizard Passo 4 → "Agenda"
- **Ação**: Definir data, horário e local para cada partida (individual ou lote)
- **Critério**: match_date, start_time e venue_id preenchidos

## Passo 6: Designar Oficiais
- **Onde**: `/admin/competicao/partida/:id` → Card "Oficiais"
- **Ação**: Adicionar mesário e/ou árbitro
- **Critério**: Registro em match_officials

## Passo 7: Lançar Resultado
- **Onde**: `/admin/competicao/partida/:id` → Aba "Resultado"
- **Ação**: Preencher placar (ex: 3×1) e salvar
- **Critério**: competition_match_results criado com result_status='resultado_lancado', match.status='finished'

## Passo 8: Validar Resultado
- **Onde**: Wizard Passo 6 → "Governança" ou `/admin/competicao/partida/:id`
- **Ação**: Clicar "Validar"
- **Critério**: result_status muda para 'resultado_validado', validated_by/at preenchidos

## Passo 9: Criar Boletim Oficial
- **Onde**: `/admin/boletins`
- **Ação**: Criar boletim, adicionar conteúdo, publicar
- **Critério**: official_bulletins.status='publicado'

## Passo 10: Publicar Resultado com Boletim
- **Onde**: `/admin/competicao/partida/:id` ou Governança
- **Ação**: Publicar resultado vinculando ao boletim
- **Critério**: result_status='publicado', published_bulletin_id preenchido

## Passo 11: Verificar Portal Público
- **Onde**: `/public/results`
- **Ação**: Navegar até o evento → prova → ver resultado
- **Critério**: Resultado aparece para consulta sem login

## Passo 12: Gerar PDF do Boletim
- **Onde**: `/admin/boletins` → Botão "Gerar PDF"
- **Ação**: Clicar para gerar e baixar PDF
- **Critério**: PDF baixado com cabeçalho, dados da prova, resultado e campos de assinatura
