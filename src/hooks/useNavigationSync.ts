import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStageContext } from "@/contexts/StageContext";

const LAST_PATH_KEY = "jer_last_pwa_path";
const RESTORED_FLAG = "jer_pwa_path_restored";

/**
 * Unified hook for navigation persistence and stage synchronization.
 * Consolidates logic from AppStatePreserver and Stage sync.
 */
export function useNavigationSync() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeStageId, stages, setContextLocked } = useStageContext();

  // 1. Persist current path
  useEffect(() => {
    const fullPath = location.pathname + location.search + location.hash;
    if (
      (fullPath.startsWith("/pwa") || fullPath.startsWith("/admin") || fullPath.startsWith("/super")) &&
      !fullPath.includes("/login")
    ) {
      localStorage.setItem(LAST_PATH_KEY, fullPath);
    }
  }, [location]);

  // 2. Synchronize stage ID into URL for PWA routes
  useEffect(() => {
    const isPwaModule = location.pathname.startsWith("/pwa/");
    const hasStageIdInPath = /\/pwa\/[^/]+\/([^/]+)/.test(location.pathname);
    
    if (isPwaModule && !hasStageIdInPath && activeStageId && stages.length > 0) {
      const stage = stages.find(s => s.id === activeStageId);
      if (stage) {
        const pathParts = location.pathname.split("/").filter(Boolean);
        if (pathParts.length === 2) { // e.g., ["pwa", "alojamento"]
          const newPath = `/${pathParts[0]}/${pathParts[1]}/${activeStageId}${location.search}${location.hash}`;
          setContextLocked(true);
          navigate(newPath, { replace: true });
          setTimeout(() => setContextLocked(false), 300);
        }
      }
    }
  }, [location.pathname, activeStageId, stages, navigate, location.search, location.hash, setContextLocked]);

  // 3. Restore last path on entry points
  useEffect(() => {
    const savedPath = localStorage.getItem(LAST_PATH_KEY);
    const currentPath = window.location.pathname;
    const isAtEntryPoints = currentPath === "/" || currentPath === "/login";
    
    if (savedPath && isAtEntryPoints && !sessionStorage.getItem(RESTORED_FLAG)) {
      if (savedPath !== "/" && savedPath !== "/login") {
        sessionStorage.setItem(RESTORED_FLAG, "true");
        setContextLocked(true);
        navigate(savedPath, { replace: true });
        setTimeout(() => setContextLocked(false), 300);
      } else {
        sessionStorage.setItem(RESTORED_FLAG, "true");
      }
    }
  }, [navigate, setContextLocked]);
}
