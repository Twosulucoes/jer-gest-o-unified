import { useNavigate } from "react-router-dom";
import { useEventContext } from "@/contexts/EventContext";
import { useStageContext } from "@/contexts/StageContext";
import { useCallback } from "react";

export type PwaModule = 
  | "coordenacao-tecnica" 
  | "secretaria" 
  | "comissao-tecnica" 
  | "administrativo" 
  | "configuracao";

interface PwaNavigationOptions {
  /** If true, validation for activeStageId will be skipped. Only activeEventId is required. */
  skipStageCheck?: boolean;
  /** Custom state to pass to the navigation */
  state?: any;
  /** Whether to replace the current entry in history */
  replace?: boolean;
}

/**
 * Hook to generate PWA URLs and navigate with built-in context validation.
 * Centralizes the logic to prevent navigation to protected PWA routes without event/stage context.
 */
export function usePwaNavigation() {
  const navigate = useNavigate();
  const { activeEventId } = useEventContext();
  const { activeStageId } = useStageContext();

  /**
   * Generates a PWA URL for a specific module, returning the configuration path if context is missing.
   */
  const getPwaUrl = useCallback((module: PwaModule, subPath: string = "", options: { skipStageCheck?: boolean } = {}) => {
    if (module === "configuracao") return "/pwa/configuracao";

    const hasEvent = !!activeEventId;
    const hasStage = !!activeStageId || options.skipStageCheck;

    if (!hasEvent || !hasStage) {
      return "/pwa/configuracao";
    }

    const cleanSubPath = subPath.startsWith("/") ? subPath : `/${subPath}`;
    const baseModulePath = `/pwa/${module}`;
    
    return subPath ? `${baseModulePath}${cleanSubPath}` : baseModulePath;
  }, [activeEventId, activeStageId]);

  /**
   * Navigates to a PWA module with validation.
   * If validation fails, redirects to /pwa/configuracao with the appropriate reason in state.
   */
  const navigateToPwa = useCallback((module: PwaModule, subPath: string = "", options: PwaNavigationOptions = {}) => {
    if (module === "configuracao") {
      navigate("/pwa/configuracao", { replace: options.replace, state: options.state });
      return;
    }

    const { skipStageCheck = false, state = {}, replace = false } = options;

    if (!activeEventId) {
      navigate("/pwa/configuracao", { 
        replace: true, 
        state: { ...state, reason: "missing_event", from: window.location.pathname } 
      });
      return;
    }

    if (!skipStageCheck && !activeStageId) {
      navigate("/pwa/configuracao", { 
        replace: true, 
        state: { ...state, reason: "missing_stage", from: window.location.pathname } 
      });
      return;
    }

    const url = getPwaUrl(module, subPath, { skipStageCheck });
    navigate(url, { replace, state });
  }, [navigate, activeEventId, activeStageId, getPwaUrl]);

  return {
    getPwaUrl,
    navigateToPwa,
    isValidContext: !!activeEventId && !!activeStageId,
    activeEventId,
    activeStageId
  };
}
