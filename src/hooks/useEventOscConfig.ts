import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EventOscConfig {
  id?: string;
  event_id: string;
  grantor_name: string | null;
  contract_number: string | null;
  contract_year: string | null;
  osc_name: string | null;
  osc_cnpj: string | null;
  osc_address: string | null;
  validity_start: string | null;
  validity_end: string | null;
  responsible_name: string | null;
  summary_model: string | null;
}

export const OSC_DEFAULTS = {
  grantor_name: "Governo do Estado de Roraima",
  osc_name: "IDR - Instituto de Desporto de Roraima",
  osc_cnpj: "00.000.000/0001-00",
  osc_address: "Rua Exemplo, 123, Boa Vista - RR",
  responsible_name: "Responsável Técnico JER",
};

export function useEventOscConfig(eventId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["event-osc-config", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_osc_configs")
        .select("*")
        .eq("event_id", eventId!)
        .maybeSingle();

      if (error) throw error;
      
      // Retorna dados existentes ou estrutura vazia para preenchimento com defaults no componente
      return data as EventOscConfig | null;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (config: Partial<EventOscConfig>) => {
      if (!eventId) throw new Error("Event ID is required");

      const { data, error } = await supabase
        .from("event_osc_configs")
        .upsert({
          ...config,
          event_id: eventId,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-osc-config", eventId] });
      toast.success("Configuração do convênio salva com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao salvar configuração OSC:", error);
      toast.error("Erro ao salvar configuração do convênio.");
    },
  });

  return {
    ...query,
    upsertMutation,
    defaults: OSC_DEFAULTS,
  };
}
