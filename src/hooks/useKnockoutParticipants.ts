import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KnockoutParticipant {
  participant_id: string;
  label: string;
  participant_type: "team" | "participant";
  delegation?: string;
  seed: number;
}

export function useKnockoutParticipants(
  eventId: string,
  sportEventId: string | null,
  isCollective: boolean
) {
  return useQuery({
    queryKey: ["knockout-participants", eventId, sportEventId, isCollective],
    queryFn: async () => {
      if (!sportEventId) return [];

      if (isCollective) {
        const { data, error } = await supabase
          .from("teams")
          .select("id, name, delegation_id, delegations(institution_id, institutions(name))")
          .eq("event_id", eventId)
          .eq("sport_event_id", sportEventId)
          .order("name");
        if (error) throw error;
        return (data ?? []).map((t: any, idx: number) => ({
          participant_id: t.id,
          label: t.name,
          participant_type: "team" as const,
          delegation: t.delegations?.institutions?.name ?? "",
          seed: idx + 1,
        }));
      } else {
        const { data, error } = await supabase
          .from("participant_sport_events")
          .select(`
            id, participant_id,
            participants(person_id, delegation_id, people(full_name),
              delegations(institution_id, institutions(name)))
          `)
          .eq("sport_event_id", sportEventId);
        if (error) throw error;
        return (data ?? []).map((pse: any, idx: number) => ({
          participant_id: pse.id,
          label: (pse.participants as any)?.people?.full_name ?? "—",
          participant_type: "participant" as const,
          delegation: (pse.participants as any)?.delegations?.institutions?.name ?? "",
          seed: idx + 1,
        }));
      }
    },
    enabled: !!sportEventId,
  });
}
