# 10 — Publicação e Resultados

> Auditoria atualizada em 2026-04-14

## Ciclo de Vida do Resultado

```
resultado_lancado → resultado_validado → publicado
```

| Status | Visível para | Quem pode alterar |
|--------|-------------|-------------------|
| `resultado_lancado` | admin, secretaria, coord_tecnica | coord_tecnica, secretaria, mesário |
| `resultado_validado` | admin, secretaria, coord_tecnica | admin (reverter), coordenacao_tecnica (homologar) |
| `publicado` | **todos** (incluindo público anon) | admin (reverter), secretaria (publicar) |

## Strings Canônicas (Fonte de Verdade)

Arquivo: `src/lib/resultStatus.ts`

```typescript
RESULT_STATUS = {
  LAUNCHED: "resultado_lancado",
  VALIDATED: "resultado_validado",
  PUBLISHED: "publicado",
}
```

Todas as RPCs, filtros de frontend e RLS policies usam estas strings.

## RPCs de Governança

| RPC | Permissão | Descrição |
|-----|-----------|-----------|
| `rpc_launch_match_result` | authenticated | Grava resultados com status `resultado_lancado`, marca partida como `finished` |
| `rpc_homologate_match_result` | admin, coord_tecnica | Homologa resultado lançado (exige verificação prévia de senha via Edge Function), status → `resultado_validado` |
| `rpc_publish_match_result` | admin, secretaria | Publica resultado validado (individual ou lote), status → `publicado` |
| `rpc_revert_match_result_status` | admin | Reverte status de resultado (justificativa obrigatória) |
| `rpc_sync_match_scores_to_results` | authenticated | Sincroniza match_scores → competition_match_results |

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
| `updated_at` / `updated_by` | Quem alterou por último |
| `validated_at` / `validated_by` | Quem validou |
| `published_at` / `published_by` | Quem publicou |
| `published_bulletin_id` | Boletim oficial vinculado |
| `combat_detail` | JSONB com detalhes (incluindo placar por períodos e shootout) |

## Fluxos de Lançamento

### Fluxo A — Wizard (CentralResultsTab)
- Usa `rpc_launch_match_result` via `LaunchResultDialog`
- Auto-finish da partida incluído na RPC

### Fluxo B — Página da Partida
- Upsert direto em `competition_match_results`
- Auto-finish da partida no `onSuccess`
- Publicação exige seleção de boletim oficial

### Sincronização match_scores → resultado oficial
- Botão "Sincronizar para Resultado Oficial" no card de placar coletivo
- Usa `rpc_sync_match_scores_to_results`

## Modalidades de Combate

Campo `combat_detail` (JSONB) em `competition_match_results`:

```json
{
  "modality": "JUDO|KARATE_KUMITE|KARATE_KATA|TAEKWONDO|WRESTLING",
  "method": "ippon|waza_ari|points|pin|tech_fall|decision|dsq|wo|kata_score",
  "round": 1,
  "time_sec": 120,
  "scores": {},
  "penalties": { "home": [], "away": [] },
  "notes": "texto livre"
}
```

Componente: `CombatResultForm` (renderizado quando `family='combat'`)

## Tabelas de Auditoria
- `audit_events`: registra ações relevantes de governança.
- `match_results_history`: registra snapshots completos do payload a cada salvamento em modalidades Score.

## Segurança e Autenticação

- **Validação Real de Senha**: A homologação não utiliza apenas um campo de texto; a senha é conferida contra o hash real do usuário no Supabase Auth através da Edge Function `verify-current-user-password`.
- **Auditoria de Falhas**: Tentativas de homologação com senha incorreta são registradas na tabela `audit_events` com ação `password_verification_failed`.
- **Isolamento de Senha**: A senha nunca é passada para a RPC SQL, permanecendo apenas no contexto da Edge Function durante a verificação.

## Dados Reais (2026-04-14)

- 17 resultados lançados
- 4 boletins oficiais cadastrados
- 0 registros em audit_events

## Status Atual

- ✅ RPCs padronizadas com strings canônicas
- ✅ RLS anon configurado
- ✅ Workflow completo no frontend (lançar → validar → publicar)
- ✅ Publicação exige boletim oficial
- ✅ Auto-finish da partida em ambos os fluxos
- ✅ Sincronização match_scores → resultado oficial
- ✅ Base para combate (combat_detail + CombatResultForm)
- 🟡 CombatResultForm não integrado automaticamente na página da partida (requer detecção de family)
- ⛔ Sem portal público para consulta externa
- ⛔ Sem geração de boletins oficiais em PDF
- ⛔ Sem quadro de medalhas
