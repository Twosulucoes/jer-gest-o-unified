/**
 * Stage Context Management for JER Gestão.
 * Handles the selection and persistence of event stages (fases/etapas).
 * Supports automatic stage selection from URL parameters or localStorage.
 */
import { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { handleContextChange } from "@/lib/context-manager";

const STORAGE_KEY = "jer_active_stage_id";
const MODULE_STORAGE_KEY = "jer_active_module";

/** Detailed stage information from the database */
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

/** Interface for the Stage context value */
interface StageContextValue {
  /** All available stages for the active event */
  stages: EventStage[];
  /** Loading state for the stages query */
  stagesLoading: boolean;
  /** ID of the currently selected stage */
  activeStageId: string | null;
  /** Full data of the active stage */
  activeStage: EventStage | null;
  /** Function to manually update the active stage */
  setActiveStageId: (id: string | null) => void;
}

const StageContext = createContext<StageContextValue | undefined>(undefined);

export function StageProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const eventId = useActiveEventId();
  const { stageId: routeStageId } = useParams<{ stageId?: string }>();
  const location = useLocation();
  
  // Identify current module based on path
  const currentModule = useMemo(() => {
    if (location.pathname.startsWith("/pwa/alojamento")) return "alojamento";
    if (location.pathname.startsWith("/pwa/alimentacao")) return "alimentacao";
    if (location.pathname.startsWith("/pwa/credenciamento")) return "credenciamento";
    if (location.pathname.startsWith("/pwa/transporte")) return "transporte";
    if (location.pathname.startsWith("/admin")) return "admin";
    return "other";
  }, [location.pathname]);

  const [persistedStageId, setPersistedStageId] = useState<string | null>(() => {
    try {
      const lastModule = localStorage.getItem(MODULE_STORAGE_KEY);
      const lastStageId = localStorage.getItem(STORAGE_KEY);
      
      // If we are changing modules, we might want to reset or validate, 
      // but for now let's just ensure we have the last known stage.
      return lastStageId;
    } catch {
      return null;
    }
  });

  // Track module changes and sync context
  useEffect(() => {
    const lastModule = localStorage.getItem(MODULE_STORAGE_KEY);
    if (lastModule && lastModule !== currentModule && currentModule !== "other") {
      console.log(`[StageContext] Module changed from ${lastModule} to ${currentModule}. Syncing context...`);
      // When changing modules, we force a query invalidation to ensure data consistency
      handleContextChange(queryClient);
    }
    if (currentModule !== "other") {
      localStorage.setItem(MODULE_STORAGE_KEY, currentModule);
    }
  }, [currentModule, queryClient]);

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
