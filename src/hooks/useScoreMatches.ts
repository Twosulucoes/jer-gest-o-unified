import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useScoreMatches(sportEventId: string | undefined) {
  return useQuery({
    queryKey: ["score-matches", sportEventId],
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
              delegations (name)
            )
          ),
          match_results: competition_match_results (
            id,
            result_status,
            score
          )
        `)
        .eq("sport_event_id", sportEventId!)
        .order("match_number", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export function useModalityDetails(sportEventId: string | undefined) {
  return useQuery({
    queryKey: ["sport-event-details", sportEventId],
    enabled: !!sportEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_events")
        .select(`
          *,
          sports (id, name, slug),
          categories (name)
        `)
        .eq("id", sportEventId!)
        .single();

      if (error) throw error;
      return data;
    },
  });
}
