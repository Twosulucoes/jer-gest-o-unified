import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeProvaData, type ProvaRow } from "../lib/computeProvaData";

interface UsePainelProvasArgs {
  eventId: string | null;
  stageId?: string;
  mySportIds: string[] | null;
  isCoordModalidade: boolean;
  loadingSportLinks: boolean;
}

interface UsePainelProvasResult {
  provas: ProvaRow[];
  isLoading: boolean;
  isFetching: boolean;
  lastUpdate: Date;
}

/**
 * Fetches the painel data + subscribes to relevant realtime tables with
 * a debounced invalidation to coalesce bursts. Realtime is scoped to the
 * current stage when present (avoids cross-stage noise).
 */
export function usePainelProvas({
  eventId,
  stageId,
  mySportIds,
  isCoordModalidade,
  loadingSportLinks,
}: UsePainelProvasArgs): UsePainelProvasResult {
  const qc = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState(() => new Date());
  const sportKey = (mySportIds ?? []).join(",");

  const queryKey = ["painel-competicao", eventId, stageId, sportKey] as const;

  const { data: provas = [], isLoading, isFetching } = useQuery({
    queryKey,
    enabled: !!eventId && (!isCoordModalidade || !loadingSportLinks),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      // 1. Fetch the summaries
      let summaryQuery;
      if (stageId) {
        summaryQuery = supabase
          .from("vw_stage_sport_event_summary" as any)
          .select("*")
          .eq("event_stage_id", stageId);
      } else {
        summaryQuery = supabase
          .from("vw_sport_event_summary" as any)
          .select("*")
          .eq("event_id", eventId!);
      }

      summaryQuery = summaryQuery.eq("is_active", true).order("sport_name").order("name");

      if (mySportIds && mySportIds.length > 0) {
        summaryQuery = summaryQuery.in("sport_id", mySportIds);
      } else if (isCoordModalidade && mySportIds && mySportIds.length === 0) {
        return [] as (ProvaRow & { family: string | null })[];
      }

      const { data: summaryData, error: summaryError } = await summaryQuery;
      if (summaryError) throw summaryError;

      // 2. Fetch rules to filter by family "score"
      const { data: rulesData, error: rulesError } = await supabase
        .from("sport_event_rules")
        .select("sport_event_id, rules")
        .eq("is_active", true);
      
      if (rulesError) throw rulesError;

      const rulesMap = new Map(rulesData.map(r => [r.sport_event_id, (r.rules as any)?.family]));

      return (summaryData ?? [])
        .map((row: any) => {
          const family = rulesMap.get(row.sport_event_id) || null;
          return {
            ...computeProvaData(row, family),
            family
          };
        })
        .filter(p => p.family === "score" || p.family === "sets" || p.family === "combat");
    },
  });

  // Realtime — scoped to stage when present, debounced to coalesce bursts.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!eventId) return;

    const scheduleInvalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["painel-competicao", eventId, stageId] });
        setLastUpdate(new Date());
      }, 400);
    };

    const matchFilter = stageId
      ? `event_stage_id=eq.${stageId}`
      : `event_id=eq.${eventId}`;

    const channel = supabase
      .channel(`painel-competicao-${stageId || "global"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competition_matches",
          filter: matchFilter,
        },
        scheduleInvalidate
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competition_match_results",
        },
        scheduleInvalidate
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [eventId, stageId, qc]);

  return { provas, isLoading, isFetching, lastUpdate };
}
