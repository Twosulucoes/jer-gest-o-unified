# 10 — Publicação e Resultados

## Ciclo de Vida do Resultado

```
resultado_lancado → validado → publicado
```

| Status | Visível para | Quem pode alterar |
|--------|-------------|-------------------|
| `resultado_lancado` | admin, secretaria, coord_tecnica | coord_tecnica, secretaria |
| `validado` | admin, secretaria, coord_tecnica | secretaria |
| `publicado` | **todos** (incluindo público anon) | admin |

## RLS para Público

```sql
CREATE POLICY "Public can read published results"
  ON public.competition_match_results
  FOR SELECT TO anon
  USING (result_status = 'publicado');
```

## Campos de Rastreabilidade

| Campo | Descrição |
|-------|-----------|
| `recorded_at` / `recorded_by` | Quem lançou o resultado |
| `validated_at` / `validated_by` | Quem validou |
| `published_at` / `published_by` | Quem publicou |

## Status Atual

- ✅ Tabela `competition_match_results` com campos completos
- ✅ RLS anon configurado
- 🟡 Falta workflow explícito no frontend (botões validar → publicar)
- ⛔ Sem portal público para consulta externa
- ⛔ Sem geração de boletins oficiais em PDF
