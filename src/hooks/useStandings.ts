import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StandingEntry {
  rank: number;
  participant_id: string;
  participant_label: string;
  points_table: number;
  played: number;
  wins: number;
  draws?: number;
  losses: number;
  points_for: number;
  points_against: number;
  goal_diff?: number;
  goal_average?: number;
  sets_for?: number;
  sets_against?: number;
  sets_diff?: number;
  sets_quotient?: number;
  pts_for?: number;
  pts_against?: number;
  pts_quotient?: number;
  wo_for: number;
  wo_against: number;
  tie_unresolved: boolean;
  // time/mark/ranking
  time_ms?: number;
  distance_cm?: number;
  points?: number;
  result_text?: string;
}

export interface StandingsResult {
  sport_event_id: string;
  phase_id: string | null;
  group_id: string | null;
  family: string;
  standings: StandingEntry[];
  meta: {
    matches_count?: number;
    matches_finalized_count?: number;
    results_count?: number;
    generated_at: string;
    ignored_rules?: string[];
    note?: string;
    tie_breakers_configured?: string[];
  };
}

export function useStandings(
  eventId: string | undefined,
  sportEventId: string | null,
  family: string | null,
  phaseId?: string | null,
  groupId?: string | null
) {
  return useQuery({
    queryKey: ["standings", eventId, sportEventId, family, phaseId, groupId],
    queryFn: async (): Promise<StandingsResult> => {
      let rpcName: string;
      let params: Record<string, unknown>;

      if (family === "sets") {
        rpcName = "rpc_compute_standings_sets";
        params = {
          p_event_id: eventId!,
          p_sport_event_id: sportEventId!,
          p_phase_id: phaseId ?? null,
          p_group_id: groupId ?? null,
        };
      } else if (family === "score") {
        rpcName = "rpc_compute_standings_score";
        params = {
          p_event_id: eventId!,
          p_sport_event_id: sportEventId!,
          p_phase_id: phaseId ?? null,
          p_group_id: groupId ?? null,
        };
      } else {
        rpcName = "rpc_compute_ranking_simple";
        params = {
          p_event_id: eventId!,
          p_sport_event_id: sportEventId!,
          p_phase_id: phaseId ?? null,
        };
      }

      const { data, error } = await supabase.rpc(rpcName as any, params as any);
      if (error) throw error;
      return data as unknown as StandingsResult;
    },
    enabled: !!eventId && !!sportEventId && !!family,
    refetchInterval: 30000,
  });
}
