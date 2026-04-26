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

export function useModalityPhases(sportEventId: string | undefined) {
  return useQuery({
    queryKey: ["modality-phases", sportEventId],
    enabled: !!sportEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_phases")
        .select("*")
        .eq("sport_event_id", sportEventId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useModalityGroups(sportEventId: string | undefined) {
  return useQuery({
    queryKey: ["modality-groups", sportEventId],
    enabled: !!sportEventId,
    queryFn: async () => {
      const { data: se } = await supabase.from("sport_events").select("event_id").eq("id", sportEventId!).single();
      if (!se) return [];
      
      const { data, error } = await supabase
        .from("competition_groups")
        .select("*")
        .eq("event_id", se.event_id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useModalitySchools(sportEventId: string | undefined) {
  return useQuery({
    queryKey: ["modality-schools", sportEventId],
    enabled: !!sportEventId,
    queryFn: async () => {
      const { data: pse } = await supabase
        .from("participant_sport_events")
        .select("participant_id")
        .eq("sport_event_id", sportEventId!);
      
      if (!pse || pse.length === 0) return [];

      const { data: p } = await supabase
        .from("participants")
        .select("delegation_id")
        .in("id", pse.map(x => x.participant_id));

      if (!p || p.length === 0) return [];

      const { data, error } = await supabase
        .from("delegations")
        .select("id, name")
        .in("id", [...new Set(p.map(x => x.delegation_id))].filter(Boolean) as string[]);

      if (error) throw error;
      return data;
    },
  });
}

export function useModalityReferees(sportId: string | undefined) {
  return useQuery({
    queryKey: ["modality-referees", sportId],
    enabled: !!sportId,
    queryFn: async () => {
      const { data: usl } = await supabase
        .from("user_sport_links")
        .select("user_id")
        .eq("sport_id", sportId!);
      
      if (!usl || usl.length === 0) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("id", usl.map(x => x.user_id));

      if (error) throw error;
      return data;
    },
  });
}
