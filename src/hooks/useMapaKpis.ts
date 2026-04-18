import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";

interface KpiResult {
  count: number;
  items: any[];
}

export function useMapaKpis() {
  const eventId = useActiveEventId();

  const provasSemPartidas = useQuery({
    queryKey: ["kpi-provas-sem-partidas", eventId],
    enabled: !!eventId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<KpiResult> => {
      const { data, error } = await supabase.rpc("rpc_kpi_provas_sem_partidas", {
        p_event_id: eventId,
      });
      if (error) throw error;
      return data as unknown as KpiResult;
    },
  });

  const partidasSemResultado = useQuery({
    queryKey: ["kpi-partidas-sem-resultado", eventId],
    enabled: !!eventId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<KpiResult> => {
      const { data, error } = await supabase.rpc("rpc_kpi_partidas_sem_resultado", {
        p_event_id: eventId,
      });
      if (error) throw error;
      return data as unknown as KpiResult;
    },
  });

  return { provasSemPartidas, partidasSemResultado };
}
