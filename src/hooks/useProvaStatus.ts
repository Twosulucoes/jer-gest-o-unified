import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RESULT_STATUS, BULLETIN_STATUS } from "@/lib/resultStatus";
import {
  deriveProvaStatus,
  type ProvaSignals,
  type ProvaStatus,
  PROVA_STATUS,
  PROVA_STATUS_LABEL,
} from "@/lib/competition/provaStatus";

export interface UseProvaStatusResult {
  status: ProvaStatus;
  label: string;
  signals: ProvaSignals;
  isLoading: boolean;
}

/**
 * Single Source of Truth do estado da prova.
 * Carrega os sinais necessários e deriva o status via `deriveProvaStatus`.
 *
 * Outros componentes (checklist, wizard, governance) DEVEM consumir este hook
 * em vez de calcular o estado por conta própria.
 */
export function useProvaStatus(
  eventId: string | null | undefined,
  sportEventId: string | null | undefined,
): UseProvaStatusResult {
  const { data, isLoading } = useQuery({
    queryKey: ["prova-status", eventId, sportEventId],
    enabled: !!eventId && !!sportEventId,
    queryFn: async (): Promise<ProvaSignals> => {
      // 1) Inscritos
      const { count: enrolled } = await supabase
        .from("participant_sport_events")
        .select("id", { count: "exact", head: true })
        .eq("sport_event_id", sportEventId!);

      // 2) Partidas
      const { data: matches = [], count: matchesCount } = await supabase
        .from("competition_matches")
        .select("id, status, match_date, start_time, venue_id", { count: "exact" })
        .eq("event_id", eventId!)
        .eq("sport_event_id", sportEventId!);

      const matchIds = (matches ?? []).map((m: any) => m.id);
      const scheduled = (matches ?? []).filter((m: any) => m.match_date && m.start_time && m.venue_id).length;
      const finished = (matches ?? []).filter((m: any) => m.status === "finished").length;
      const inProgress = (matches ?? []).filter((m: any) => m.status === "in_progress").length;

      // 3) Arbitragem
      let officialsCount = 0;
      let matchesWithOfficials = 0;
      if (matchIds.length > 0) {
        const { data: assigns } = await supabase
          .from("match_user_assignments")
          .select("id, match_id")
          .in("match_id", matchIds);
        officialsCount = (assigns ?? []).length;
        matchesWithOfficials = new Set((assigns ?? []).map((a: any) => a.match_id)).size;
      }

      // 4) Resultados por status
      let resultsLaunched = 0;
      let resultsValidated = 0;
      let resultsPublished = 0;
      if (matchIds.length > 0) {
        const { data: results } = await supabase
          .from("competition_match_results")
          .select("result_status")
          .in("match_id", matchIds);
        for (const r of (results ?? []) as any[]) {
          if (r.result_status === RESULT_STATUS.LAUNCHED) resultsLaunched++;
          else if (r.result_status === RESULT_STATUS.VALIDATED) resultsValidated++;
          else if (r.result_status === RESULT_STATUS.PUBLISHED) resultsPublished++;
        }
      }

      // 5) Boletim publicado disponível?
      const { count: publishedBulletins } = await supabase
        .from("official_bulletins")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId!)
        .eq("status", BULLETIN_STATUS.PUBLICADO);

      return {
        enrolled: enrolled ?? 0,
        matchesCount: matchesCount ?? 0,
        scheduled,
        finished,
        inProgress,
        officialsCount,
        matchesWithOfficials,
        resultsLaunched,
        resultsValidated,
        resultsPublished,
        hasPublishedBulletin: (publishedBulletins ?? 0) > 0,
      };
    },
  });

  const signals: ProvaSignals = data ?? {
    enrolled: 0,
    matchesCount: 0,
    scheduled: 0,
    finished: 0,
    inProgress: 0,
    officialsCount: 0,
    matchesWithOfficials: 0,
    resultsLaunched: 0,
    resultsValidated: 0,
    resultsPublished: 0,
    hasPublishedBulletin: false,
  };

  const status = data ? deriveProvaStatus(signals) : PROVA_STATUS.DRAFT;

  return {
    status,
    label: PROVA_STATUS_LABEL[status],
    signals,
    isLoading,
  };
}
