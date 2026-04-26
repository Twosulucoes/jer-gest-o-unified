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
      // Get teams for this modality, which link to delegations and institutions
      const { data, error } = await supabase
        .from("teams")
        .select(`
          id,
          delegation_id,
          delegations (
            id,
            institutions (
              id,
              name
            )
          )
        `)
        .eq("sport_event_id", sportEventId!);

      if (error) throw error;
      
      // Map to a simpler structure: { team_id, school_id, school_name }
      return (data || []).map(t => ({
        team_id: t.id,
        school_id: t.delegation_id,
        school_name: (t.delegations as any)?.institutions?.name || "Sem Nome"
      }));
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
