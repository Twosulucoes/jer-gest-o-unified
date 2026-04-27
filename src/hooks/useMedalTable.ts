
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MedalRow {
  delegation_id: string;
  name: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

export function useMedalTable(eventId: string) {
  return useQuery({
    queryKey: ["medal-table", eventId],
    queryFn: async () => {
      // Fetch all published results for this event
      // This is a complex query because results are linked to matches which are linked to sport_events
      // We need to count position 1, 2, 3
      
      const { data: results, error } = await supabase
        .from("competition_match_results")
        .select(`
          position,
          match_entry_id,
          competition_match_entries!inner(
            team_id,
            participant_sport_event_id,
            teams(delegation_id, delegations(school_name)),
            participant_sport_events(participants(delegation_id, delegations(school_name)))
          ),
          competition_matches!inner(event_id)
        `)
        .eq("competition_matches.event_id", eventId)
        .eq("result_status", "publicado")
        .in("position", [1, 2, 3]);

      if (error) throw error;

      const medalMap = new Map<string, MedalRow>();

      results.forEach((r: any) => {
        const entry = r.competition_match_entries;
        const delegationId = entry.teams?.delegation_id || entry.participant_sport_events?.participants?.delegation_id;
        const delegationName = entry.teams?.delegations?.school_name || entry.participant_sport_events?.participants?.delegations?.school_name || "Outros";

        if (!delegationId) return;

        if (!medalMap.has(delegationId)) {
          medalMap.set(delegationId, {
            delegation_id: delegationId,
            name: delegationName,
            gold: 0,
            silver: 0,
            bronze: 0,
            total: 0
          });
        }

        const row = medalMap.get(delegationId)!;
        if (r.position === 1) row.gold++;
        else if (r.position === 2) row.silver++;
        else if (r.position === 3) row.bronze++;
        row.total++;
      });

      return Array.from(medalMap.values()).sort((a, b) => {
        if (b.gold !== a.gold) return b.gold - a.gold;
        if (b.silver !== a.silver) return b.silver - a.silver;
        if (b.bronze !== a.bronze) return b.bronze - a.bronze;
        return a.name.localeCompare(b.name);
      });
    },
    enabled: !!eventId,
  });
}
