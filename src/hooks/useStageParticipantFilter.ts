import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";

/**
 * Lê ?stage= da URL e retorna o conjunto de participant_id vinculados
 * à etapa via participant_event_stages. Use para filtrar listas
 * (Participantes, Credenciamento, Delegações, Partidas) por etapa.
 */
export function useStageParticipantFilter() {
  const eventId = useActiveEventId();
  const [searchParams] = useSearchParams();
  const stageId = searchParams.get("stage");

  const { data: stage } = useQuery({
    queryKey: ["event_stage_meta", stageId, eventId],
    enabled: !!stageId && !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("event_stages" as never) as any)
        .select("id,name,slug,kind")
        .eq("id", stageId)
        .eq("event_id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string; slug: string; kind: string } | null;
    },
  });

  const { data: participantIds, isLoading } = useQuery({
    queryKey: ["stage_participant_ids", stageId],
    enabled: !!stageId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("participant_event_stages" as never) as any)
        .select("participant_id")
        .eq("event_stage_id", stageId);
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: any) => r.participant_id as string));
    },
  });

  return {
    stageId,
    stage: stage ?? null,
    participantIds: participantIds ?? null,
    isFiltering: !!stageId,
    isLoading,
  };
}
