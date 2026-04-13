import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeCrossHeatRanking, type CrossHeatEntry } from "@/lib/individualRanking";
import type { IndividualConfig } from "@/components/admin/IndividualConfigEditor";

interface HeatData {
  matchId: string;
  heatName: string;
  entries: any[];
  results: any[];
  attempts: any[];
}

interface UseCrossHeatRankingResult {
  ranking: CrossHeatEntry[];
  heats: HeatData[];
  totalAthletes: number;
  heatsWithResults: number;
  totalHeats: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCrossHeatRanking(
  eventId: string | undefined,
  sportEventId: string | null | undefined,
  family: "time" | "mark" | null,
  config: IndividualConfig | null,
  currentMatchId?: string,
  enabled = true
): UseCrossHeatRankingResult {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["cross-heat-ranking", eventId, sportEventId, currentMatchId],
    queryFn: async () => {
      // 1. Find the heats phase for this sport_event
      const { data: phases, error: phErr } = await supabase
        .from("competition_phases")
        .select("id, name")
        .eq("event_id", eventId!)
        .eq("sport_event_id", sportEventId!)
        .eq("phase_type", "heats");
      if (phErr) throw phErr;
      if (!phases?.length) return { heats: [], ranking: [] };

      const phaseIds = phases.map((p) => p.id);

      // 2. Get all matches in those phases
      const { data: matches, error: mErr } = await supabase
        .from("competition_matches")
        .select("id, match_number, notes, phase_id")
        .in("phase_id", phaseIds)
        .order("match_number");
      if (mErr) throw mErr;
      if (!matches?.length) return { heats: [], ranking: [] };

      const matchIds = matches.map((m) => m.id);

      // 3. Batch fetch entries, results, attempts
      const [entriesRes, resultsRes, attemptsRes] = await Promise.all([
        supabase
          .from("competition_match_entries")
          .select("*")
          .in("match_id", matchIds),
        supabase
          .from("competition_match_results")
          .select("*")
          .in("match_id", matchIds),
        supabase
          .from("match_attempts")
          .select("*")
          .in("match_id", matchIds)
          .order("attempt_number"),
      ]);
      if (entriesRes.error) throw entriesRes.error;
      if (resultsRes.error) throw resultsRes.error;
      if (attemptsRes.error) throw attemptsRes.error;

      const allEntries = entriesRes.data ?? [];
      const allResults = resultsRes.data ?? [];
      const allAttempts = (attemptsRes.data as any[]) ?? [];

      // 4. Fetch participant names (PSE -> participant -> person)
      const pseIds = [...new Set(allEntries.map((e) => e.participant_sport_event_id).filter(Boolean))];
      let pseMap = new Map<string, any>();
      let participantsMap = new Map<string, any>();
      let peopleMap = new Map<string, any>();
      let delegationsMap = new Map<string, any>();

      if (pseIds.length > 0) {
        const { data: pses } = await supabase
          .from("participant_sport_events")
          .select("id, participant_id")
          .in("id", pseIds);
        pseMap = new Map((pses ?? []).map((p) => [p.id, p]));

        const participantIds = [...new Set((pses ?? []).map((p) => p.participant_id))];
        if (participantIds.length > 0) {
          const { data: parts } = await supabase
            .from("participants")
            .select("id, person_id, delegation_id")
            .in("id", participantIds);
          participantsMap = new Map((parts ?? []).map((p) => [p.id, p]));

          const personIds = [...new Set((parts ?? []).map((p) => p.person_id))];
          const delegationIds = [...new Set((parts ?? []).map((p) => p.delegation_id).filter(Boolean))];

          const [peopleRes, delsRes] = await Promise.all([
            personIds.length > 0
              ? supabase.from("people").select("id, full_name").in("id", personIds)
              : { data: [] },
            delegationIds.length > 0
              ? supabase.from("delegations").select("id, institution_id").in("id", delegationIds)
              : { data: [] },
          ]);
          peopleMap = new Map(((peopleRes as any).data ?? []).map((p: any) => [p.id, p]));
          delegationsMap = new Map(((delsRes as any).data ?? []).map((d: any) => [d.id, d]));

          // Fetch institution names
          const instIds = [...new Set([...(delegationsMap.values() as any)].map((d: any) => d.institution_id).filter(Boolean))];
          if (instIds.length > 0) {
            const { data: insts } = await supabase
              .from("institutions")
              .select("id, name")
              .in("id", instIds);
            const instsMap = new Map((insts ?? []).map((i) => [i.id, i]));
            // Enrich delegationsMap with institution name
            for (const [, del] of delegationsMap) {
              const inst = instsMap.get(del.institution_id);
              del._institutionName = inst?.name ?? "";
            }
          }
        }
      }

      const getEntryLabel = (entry: any) => {
        const pse = pseMap.get(entry.participant_sport_event_id);
        if (!pse) return "—";
        const part = participantsMap.get(pse.participant_id);
        if (!part) return "—";
        const person = peopleMap.get(part.person_id);
        return person?.full_name ?? "—";
      };

      const getDelegationName = (entry: any) => {
        const pse = pseMap.get(entry.participant_sport_event_id);
        if (!pse) return "";
        const part = participantsMap.get(pse.participant_id);
        if (!part) return "";
        const del = delegationsMap.get(part.delegation_id);
        return del?._institutionName ?? "";
      };

      // 5. Build heats array
      const heats: HeatData[] = matches.map((m) => ({
        matchId: m.id,
        heatName: m.notes ?? `Bateria ${m.match_number ?? "?"}`,
        entries: allEntries.filter((e) => e.match_id === m.id),
        results: allResults.filter((r) => r.match_id === m.id),
        attempts: allAttempts.filter((a) => a.match_id === m.id),
      }));

      // 6. Compute consolidated ranking
      const ranking = computeCrossHeatRanking(
        heats,
        family!,
        config,
        getEntryLabel,
        getDelegationName,
        currentMatchId
      );

      return { heats, ranking };
    },
    enabled: enabled && !!eventId && !!sportEventId && (family === "time" || family === "mark"),
    refetchInterval: 30000,
  });

  const heats = data?.heats ?? [];
  const ranking = data?.ranking ?? [];
  const heatsWithResults = heats.filter((h) => h.results.length > 0).length;

  return {
    ranking,
    heats,
    totalAthletes: ranking.length,
    heatsWithResults,
    totalHeats: heats.length,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
