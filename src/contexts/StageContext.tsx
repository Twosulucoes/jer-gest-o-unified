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
import { getModuleByPath } from "@/constants/modules";
import { isStageOpenToday } from "@/lib/stageDateUtils";

export const ACTIVE_STAGE_STORAGE_KEY = "jer_active_stage_id";
const MODULE_ACTIVE_STAGE_STORAGE_KEY = "jer_active_module";

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
  /** Whether the context is currently transitioning or syncing (locking UI) */
  isContextLocked: boolean;
  /** Manually trigger or release a context lock */
  setContextLocked: (locked: boolean) => void;
}

const StageContext = createContext<StageContextValue | undefined>(undefined);

export function StageProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const eventId = useActiveEventId();
  const { stageId: routeStageId } = useParams<{ stageId?: string }>();
  const location = useLocation();
  const [isContextLocked, setContextLocked] = useState(false);
  
  // Identify current module based on path using central mapping
  const currentModule = useMemo(() => {
    return getModuleByPath(location.pathname);
  }, [location.pathname]);

  const [persistedStageId, setPersistedStageId] = useState<string | null>(() => {
    try {
      const lastStageId = localStorage.getItem(ACTIVE_STAGE_STORAGE_KEY);
      return lastStageId;
    } catch {
      return null;
    }
  });

  // Track module changes and sync context
  useEffect(() => {
    const lastModule = localStorage.getItem(MODULE_ACTIVE_STAGE_STORAGE_KEY);
    if (lastModule && lastModule !== currentModule && currentModule !== "other") {
      console.log(`[StageContext] Module changed from ${lastModule} to ${currentModule}. Syncing context and locking...`);
      setContextLocked(true);
      
      // Clear filters and invalidate queries
      handleContextChange(queryClient);
      
      // Auto-release lock after a short delay to allow React state to settle
      const timer = setTimeout(() => {
        setContextLocked(false);
      }, 500);
      return () => clearTimeout(timer);
    }
    
    if (currentModule !== "other") {
      localStorage.setItem(MODULE_ACTIVE_STAGE_STORAGE_KEY, currentModule);
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
      setContextLocked(true);
      handleContextChange(queryClient);
      
      // Release lock after a short delay
      setTimeout(() => setContextLocked(false), 300);
    }
    
    setPersistedStageId(finalId);
    if (finalId) {
      localStorage.setItem(ACTIVE_STAGE_STORAGE_KEY, finalId);
    } else {
      localStorage.removeItem(ACTIVE_STAGE_STORAGE_KEY);
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

  // Default stage selection: auto-pick a etapa única SE estiver vigente hoje.
  // Se houver várias mas só uma estiver aberta hoje, também auto-seleciona —
  // evita que o operador precise escolher quando o sistema sabe a resposta.
  useEffect(() => {
    if (activeStageId) return;
    const openStages = stages.filter((s) => isStageOpenToday(s));
    if (openStages.length === 1) {
      setActiveStageId(openStages[0].id);
    } else if (openStages.length === 0 && stages.length === 1) {
      // Único caminho: só uma etapa cadastrada e nem ela está vigente.
      // Mantém o auto-pick para o admin não ficar sem contexto, mas a UI
      // dos seletores ainda vai sinalizar que está fora da janela.
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
      isContextLocked,
      setContextLocked,
    };
  }, [stages, stagesLoading, activeStageId, setActiveStageId, isContextLocked]);

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
