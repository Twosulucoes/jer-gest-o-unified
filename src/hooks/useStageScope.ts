import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useCompetitionContext } from "@/contexts/CompetitionContext";

interface UseStageScopeOptions {
  includeMatchIds?: boolean;
}

const FILTER_CHUNK_SIZE = 200;
const PAGE_SIZE = 1000;

function chunkArray<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

/**
 * Pagina uma query Supabase em lotes de PAGE_SIZE até esgotar os resultados.
 * Evita o cap silencioso de 1000 linhas do PostgREST.
 */
async function paginateAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const acc: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    acc.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return acc;
}

/**
 * Hook unificado de escopo por etapa.
 *
 * Prioridade de detecção:
 *  1. `useParams().stageId` — quando a página está dentro de `/admin/etapa/:stageId/...` (StageLayout)
 *  2. `?stage=` na URL — fallback para compatibilidade com links legados/banner
 *
 * Retorna o `Set<string>` de `participant_id` vinculados à etapa via:
 *  - Fonte 1 (principal): `participant_event_stages` (vínculo explícito)
 *  - Fonte 2 (fallback/backfill): `participant_sport_events.event_stage_id`
 *
 * Os IDs são sanitizados contra `participants.event_id` para evitar vínculos
 * legados inconsistentes. Quando `includeMatchIds` estiver ativo, também
 * calcula o conjunto de partidas sem gerar URLs gigantes no PostgREST.
 */
export function useStageScope(options: UseStageScopeOptions = {}) {
  const { includeMatchIds = false } = options;
  const eventId = useActiveEventId();
  const params = useParams<{ stageId?: string }>();
  const [searchParams] = useSearchParams();
  const stageId = params.stageId ?? searchParams.get("stage") ?? null;

  const { data: stage } = useQuery({
    queryKey: ["event_stage_meta", stageId, eventId],
    enabled: !!stageId && !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("event_stages" as never) as any)
        .select("id,name,slug,kind,status")
        .eq("id", stageId)
        .eq("event_id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        name: string;
        slug: string;
        kind: string;
        status: string;
      } | null;
    },
  });

  const { data: participantIds, isLoading, error: participantsError } = useQuery({
    queryKey: ["stage_participant_ids", stageId, eventId],
    enabled: !!stageId && !!eventId,
    queryFn: async () => {
      const [pesRows, pseRows] = await Promise.all([
        paginateAll<{ participant_id: string }>((from, to) =>
          (supabase.from("participant_event_stages" as never) as any)
            .select("participant_id")
            .eq("event_stage_id", stageId)
            .eq("event_id", eventId)
            .order("participant_id", { ascending: true })
            .range(from, to),
        ).catch((err) => {
          console.error("[useStageScope] Falha ao carregar participant_event_stages.", err);
          throw err;
        }),
        paginateAll<{ participant_id: string }>((from, to) =>
          supabase
            .from("participant_sport_events")
            .select("participant_id")
            .eq("event_stage_id", stageId)
            .order("participant_id", { ascending: true })
            .range(from, to),
        ).catch((err) => {
          console.error("[useStageScope] Falha ao carregar participant_sport_events por etapa.", err);
          throw err;
        }),
      ]);

      return new Set<string>([
        ...pesRows.map((row) => row?.participant_id).filter(Boolean),
        ...pseRows.map((row) => row?.participant_id).filter(Boolean),
      ] as string[]);
    },
  });

  const { data: matchIds, error: matchesError } = useQuery({
    queryKey: ["stage_match_ids", stageId, includeMatchIds, participantIds?.size ?? 0],
    enabled: !!stageId && !!participantIds && includeMatchIds,
    queryFn: async () => {
      const ids = Array.from(participantIds!);
      if (ids.length === 0) return new Set<string>();

      const participantChunks = chunkArray(ids, FILTER_CHUNK_SIZE);
      const participantSportEventIds: string[] = [];
      const teamIdSet = new Set<string>();
      const matchSet = new Set<string>();

      for (const chunk of participantChunks) {
        const [{ data: pse, error: pseErr }, { data: teamMembers, error: teamErr }] = await Promise.all([
          supabase.from("participant_sport_events").select("id").in("participant_id", chunk),
          supabase.from("team_members").select("team_id").in("participant_id", chunk),
        ]);

        if (pseErr) throw pseErr;
        if (teamErr) throw teamErr;

        (pse ?? []).forEach((row: any) => participantSportEventIds.push(row.id as string));
        (teamMembers ?? []).forEach((row: any) => {
          if (row.team_id) teamIdSet.add(row.team_id as string);
        });
      }

      for (const chunk of chunkArray(participantSportEventIds, FILTER_CHUNK_SIZE)) {
        const { data, error } = await supabase
          .from("competition_match_entries")
          .select("match_id")
          .in("participant_sport_event_id", chunk);
        if (error) throw error;
        (data ?? []).forEach((row: any) => matchSet.add(row.match_id));
      }

      for (const chunk of chunkArray(Array.from(teamIdSet), FILTER_CHUNK_SIZE)) {
        const { data, error } = await supabase
          .from("competition_match_entries")
          .select("match_id")
          .in("team_id", chunk);
        if (error) throw error;
        (data ?? []).forEach((row: any) => matchSet.add(row.match_id));
      }

      return matchSet;
    },
  });

  return {
    stageId,
    stage: stage ?? null,
    participantIds: participantIds ?? null,
    matchIds: matchIds ?? null,
    isStageScoped: !!stageId,
    isLoading,
    error: (participantsError ?? matchesError) as Error | null,
  };
}
