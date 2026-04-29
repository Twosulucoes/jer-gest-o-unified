import { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { handleContextChange } from "@/lib/context-manager";

const STORAGE_KEY = "jer_active_stage_id";

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
  setActiveStageId: (id: string | null) => void;
}

const StageContext = createContext<StageContextValue | undefined>(undefined);

export function StageProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const eventId = useActiveEventId();
  const { stageId: routeStageId } = useParams<{ stageId?: string }>();
  
  const [persistedStageId, setPersistedStageId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

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

  // activeStageId priority: 1. URL param, 2. Persisted state
  const activeStageId = routeStageId || persistedStageId;

  const setActiveStageId = useCallback((id: string | null) => {
    const finalId = id === "none" ? null : id;
    if (finalId !== persistedStageId) {
      handleContextChange(queryClient);
    }
    
    setPersistedStageId(finalId);
    if (finalId) {
      localStorage.setItem(STORAGE_KEY, finalId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [queryClient, persistedStageId]);

  // If we have an activeStageId but it's not in the list of stages for the current event, clear it
  useEffect(() => {
    if (activeStageId && stages.length > 0 && !routeStageId) {
      const exists = stages.some((s) => s.id === activeStageId);
      if (!exists) {
        setActiveStageId(null);
      }
    }
  }, [activeStageId, stages, routeStageId, setActiveStageId]);

  // Default stage selection: if only one stage, auto-select it if none selected
  useEffect(() => {
    if (!activeStageId && stages.length === 1) {
      setActiveStageId(stages[0].id);
    }
  }, [activeStageId, stages, setActiveStageId]);

  const value = useMemo<StageContextValue>(() => {
    const activeStage = activeStageId ? stages.find((s) => s.id === activeStageId) ?? null : null;
    return {
      stages,
      stagesLoading,
      activeStageId: activeStageId ?? null,
      activeStage,
      setActiveStageId,
    };
  }, [stages, stagesLoading, activeStageId, setActiveStageId]);

  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}

export function useStageContext() {
  const ctx = useContext(StageContext);
  if (!ctx) throw new Error("useStageContext must be used within StageProvider");
  return ctx;
}

export function useActiveStageId(): string | null {
  const { activeStageId } = useStageContext();
  return activeStageId;
}
