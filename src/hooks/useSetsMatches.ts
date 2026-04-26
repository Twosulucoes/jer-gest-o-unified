import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSetsMatches(sportEventId: string | undefined) {
  return useQuery({
    queryKey: ["sets-matches", sportEventId],
    enabled: !!sportEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_matches")
        .select(`
          *,
          venues (name),
          competition_phases (name),
          competition_groups (name),
          match_entries: competition_match_entries (
            id,
            side,
            team_id,
            teams (
              id,
              name,
              delegation_id,
              delegations (
                institutions (
                  name
                )
              )
            )
          ),
          match_results: competition_match_results (
            id,
            result_status,
            score
          ),
          match_scores: match_scores (
            id,
            match_entry_id,
            score_final,
            score_detail,
            outcome
          )
        `)
        .eq("sport_event_id", sportEventId!)
        .order("match_number", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}
