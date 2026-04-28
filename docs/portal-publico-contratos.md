# Contratos da API Pública (Portal Externo)

> Documento atualizado em 2026-04-28 — Fase 3 do Módulo de Registros concluída.

Este documento descreve os contratos de integração entre o backend do JER Gestão e o portal externo (jers.com.br).

## Endpoints

### 1. `public-events`
Retorna a lista de eventos (edições) que possuem resultados publicados.

**Requisição:**
- **URL:** `GET /functions/v1/public-events`
- **Headers:** `x-site-token: [token]`

**Resposta (Novo Formato Fase 3):**
```json
{
  "items": [
    {
      "event_id": "uuid",
      "event_name": "JER 2026",
      "event_year": 2026
    }
  ],
  "meta": {
    "total": 1,
    "generated_at": "2026-04-28T..."
  }
}
```

---

### 2. `public-results`
Retorna os resultados detalhados filtrados por evento, etapa ou modalidade.

**Requisição:**
- **URL:** `GET /functions/v1/public-results`
- **Query Params:**
  - `event_id` (Obrigatório)
  - `event_stage_id` (Opcional)
  - `sport_id` (Opcional)
  - `sport_event_id` (Opcional)
  - `bulletin_number` (Opcional - Alfanumérico, ex: BON-001)

**Resposta (Novo Formato Fase 3):**
```json
{
  "items": [
    {
      "event_id": "uuid",
      "event_name": "JER 2026",
      "sport_id": "uuid",
      "sport_name": "Futsal",
      "sport_event_name": "Futsal Masculino Juvenil",
      "category_name": "Juvenil",
      "display_name": "Escola Estadual X",
      "institution_name": "Escola X",
      "outcome": "win",
      "score": "3",
      "position": 1,
      "bulletin_number": "BON-001",
      "bulletin_title": "Boletim Diário 28/04",
      "bulletin_published_at": "2026-04-28T..."
    }
  ],
  "meta": {
    "total": 1,
    "event_id": "uuid",
    "generated_at": "2026-04-28T..."
  }
}
```

## Mudanças Importantes (Fase 3 - 2026-04-28)

1. **Padronização de Wrapper:** Todos os endpoints agora retornam um objeto com `items` (array de dados) e `meta` (metadados), eliminando retornos de array direto ou ambiguidades.
2. **Boletins Alfanuméricos:** O campo `bulletin_number` agora pode conter strings como `BON-001` ou `BON-FIN`. O portal externo deve tratar este campo como string para exibição e filtragem.
3. **Suporte a Partidas Simplificadas:** A view de resultados agora inclui partidas cadastradas via módulo de Registros (`source = simple`), garantindo que todas as etapas apareçam no portal, mesmo as que não usam a estrutura complexa de competição.
4. **Filtro de Publicação:** Resultados só aparecem na API após o boletim oficial que os contém ser **Publicado** no backend.

## Sugestão de Consumo (Frontend Portal)

O portal externo deve ser ajustado para acessar diretamente `data.items` nas requisições, eliminando verificações defensivas de tipo de array.

```typescript
// Exemplo de consumo com wrapper
const response = await fetch('/functions/v1/public-results?event_id=...');
const { items, meta } = await response.json();
setResults(items);
```
