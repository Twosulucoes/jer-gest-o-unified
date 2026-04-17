import { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";

export interface EventStage {
  id: string;
  event_id: string;
  name: string;
  slug: string;
  kind: string;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
}

interface StageContextValue {
  stages: EventStage[];
  stagesLoading: boolean;
  activeStageId: string | null;
  activeStage: EventStage | null;
}

const StageContext = createContext<StageContextValue | undefined>(undefined);

export function StageProvider({ children }: { children: React.ReactNode }) {
  const eventId = useActiveEventId();
  const { stageId } = useParams<{ stageId?: string }>();

  const { data: stages = [], isLoading: stagesLoading } = useQuery({
    queryKey: ["event_stages", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("event_stages" as never) as any)
        .select("*")
        .eq("event_id", eventId)
        .eq("status", "active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventStage[];
    },
  });

  const value = useMemo<StageContextValue>(() => {
    const activeStage = stageId ? stages.find((s) => s.id === stageId) ?? null : null;
    return {
      stages,
      stagesLoading,
      activeStageId: stageId ?? null,
      activeStage,
    };
  }, [stages, stagesLoading, stageId]);

  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}

export function useStageContext() {
  const ctx = useContext(StageContext);
  if (!ctx) throw new Error("useStageContext must be used within StageProvider");
  return ctx;
}
