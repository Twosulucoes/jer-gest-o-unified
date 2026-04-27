import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface GenerateKnockoutParams {
  eventId: string;
  sportEventId: string;
  phaseId: string;
  participants: {
    participant_id: string;
    seed: number;
    label: string;
    participant_type: "team" | "participant";
  }[];
  seedingMode?: string;
  force?: boolean;
  withBronzeMatch?: boolean;
}

export function useGenerateKnockout() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: GenerateKnockoutParams) => {
      const { data, error } = await supabase.rpc("rpc_generate_matches_knockout", {
        p_event_id: params.eventId,
        p_sport_event_id: params.sportEventId,
        p_phase_id: params.phaseId,
        p_participants: params.participants as any,
        p_seeding_mode: params.seedingMode ?? "manual",
        p_force: params.force ?? false,
        p_with_bronze_match: params.withBronzeMatch ?? true,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      toast({
        title: `Chave gerada: ${data.matches_created} partida(s), ${data.byes} bye(s)`,
      });
      qc.invalidateQueries({ queryKey: ["knockout-bracket"] });
      qc.invalidateQueries({ queryKey: ["central-matches"] });
      qc.invalidateQueries({ queryKey: ["competition-summary"] });
    },
    onError: (e: any) => {
      const msg = e.message?.includes("MATCHES_ALREADY_EXIST")
        ? "Já existem partidas para esta fase. Use 'Regenerar' para substituir."
        : e.message;
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });
}
