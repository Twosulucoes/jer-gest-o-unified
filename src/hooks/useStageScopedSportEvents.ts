import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Quando a página estiver dentro de `/admin/etapa/:stageId/...`, retorna o
 * conjunto de `sport_event_id` que possuem ao menos uma inscrição vinculada
 * à etapa (`participant_sport_events.event_stage_id`).
 *
 * Fora do escopo de etapa retorna `null` — caller deve interpretar como
 * "sem filtro" e exibir todas as provas.
 */
export function useStageScopedSportEventIds() {
  const { stageId } = useParams<{ stageId?: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["stage_scoped_sport_event_ids", stageId],
    enabled: !!stageId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select("sport_event_id")
        .eq("event_stage_id", stageId!);
      if (error) {
        console.warn("[useStageScopedSportEventIds] RLS/erro — desabilitando filtro:", error);
        return null;
      }
      return new Set<string>((data ?? []).map((r: any) => r.sport_event_id));
    },
  });

  return {
    stageId: stageId ?? null,
    isStageScoped: !!stageId,
    sportEventIds: data ?? null,
    isLoading,
  };
}
