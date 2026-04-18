import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SportEventRulesResponse, SportEventRulesV1 } from "@/types/sportEventRules";
import { toast } from "sonner";

export function useSportEventRules(eventId: string | undefined, sportEventId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["sport-event-rules", sportEventId],
    queryFn: async (): Promise<SportEventRulesResponse> => {
      const { data, error } = await supabase.rpc("rpc_get_sport_event_rules", {
        p_sport_event_id: sportEventId!,
        p_event_id: eventId ?? null,
      });
      if (error) throw error;
      return data as unknown as SportEventRulesResponse;
    },
    enabled: !!sportEventId,
  });

  const upsertMutation = useMutation({
    mutationFn: async ({
      rules,
      isActive = true,
    }: {
      rules: SportEventRulesV1;
      isActive?: boolean;
    }) => {
      const { error } = await supabase.rpc("rpc_upsert_sport_event_rules", {
        p_sport_event_id: sportEventId!,
        p_event_id: eventId ?? null,
        p_rules: rules as unknown as Record<string, never>,
        p_is_active: isActive,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sport-event-rules", sportEventId] });
      toast.success("Regras salvas com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar regras: " + err.message);
    },
  });

  return {
    rulesData: query.data,
    rules: query.data?.rules ?? null,
    source: query.data?.source ?? null,
    isLoading: query.isLoading,
    error: query.error,
    upsertRules: upsertMutation.mutate,
    isSaving: upsertMutation.isPending,
  };
}
