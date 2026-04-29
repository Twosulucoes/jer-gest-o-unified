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
