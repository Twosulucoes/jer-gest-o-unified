import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StageInfo {
  id: string;
  name: string;
  kind: string;
  event_id: string;
}

export function useStageInfo(stageId: string | null | undefined) {
  return useQuery({
    queryKey: ["stage_info", stageId],
    queryFn: async () => {
      if (!stageId) return null;
      const { data } = await supabase
        .from("event_stages")
        .select("id, name, kind, event_id")
        .eq("id", stageId)
        .maybeSingle();
      return data as StageInfo | null;
    },
    enabled: !!stageId,
  });
}

export function useLodgingLocations(stageId: string | null | undefined) {
  return useQuery({
    queryKey: ["lodging_locations", stageId],
    queryFn: async () => {
      if (!stageId) return [];
      const { data, error } = await (supabase.from("lodging_locations") as any)
        .select("*, units:lodging_units(id)")
        .eq("event_stage_id", stageId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!stageId,
  });
}

export function useLodgingUnits(stageId: string | null | undefined) {
  return useQuery({
    queryKey: ["lodging_units", stageId],
    queryFn: async () => {
      if (!stageId) return [];
      const { data, error } = await (supabase.from("lodging_units") as any)
        .select("*")
        .eq("event_stage_id", stageId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!stageId,
  });
}

/**
 * Alas (wings) cadastradas por alojamento. Usadas como agrupador opcional
 * dentro de `lodging_locations`; quando preenchidas, ditam o gender_default
 * herdado pelos quartos da ala (lodging_units.wing_id).
 */
export function useLodgingWings(stageId: string | null | undefined) {
  return useQuery({
    queryKey: ["lodging_wings", stageId],
    queryFn: async () => {
      if (!stageId) return [];
      const { data, error } = await (supabase.from("lodging_wings" as any) as any)
        .select("id, location_id, name, gender_default, sort_order")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!stageId,
  });
}

/**
 * @deprecated Use `useLodgingOccupancy(stageId).countsByUnit` em vez disso (Etapa 6
 * da auditoria de alojamento). Esta função retorna apenas linhas com status
 * `allocated`/`checked_in` sem agregação. O hook novo já devolve o Map<unit_id,
 * counts> pronto + totais agregados.
 */
export function useLodgingOccupancyCounts(stageId: string | null | undefined) {
  return useQuery({
    queryKey: ["lodging_occupancy_counts", stageId],
    queryFn: async () => {
      if (!stageId) return [];
      const { data, error } = await (supabase.from("lodging_occupancies") as any)
        .select("unit_id")
        .eq("event_stage_id", stageId)
        .in("status", ["allocated", "checked_in"]);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!stageId,
  });
}
