import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStageContext } from "@/contexts/StageContext";

const LAST_PATH_KEY = "jer_last_pwa_path";
const RESTORED_FLAG = "jer_pwa_path_restored";

/**
 * Component that preserves the current route in localStorage.
 * On mount, if we are at the root or login and have a saved path, it restores it.
 * This ensures users don't lose context during PWA updates or browser refreshes.
 */
export function AppStatePreserver() {
  const location = useLocation();
  const navigate = useNavigate();
  const hasRestored = useRef(false);
  const { activeStageId, stages, setContextLocked } = useStageContext();

  // Save current path on every change
  useEffect(() => {
    const fullPath = location.pathname + location.search + location.hash;
    
    // Only save PWA or Admin routes, avoid infinite loops on / or /login
    // Also avoid saving "transient" pages like success confirmations if desired
    if (
      (fullPath.startsWith("/pwa") || fullPath.startsWith("/admin") || fullPath.startsWith("/super")) &&
      !fullPath.includes("/login")
    ) {
      localStorage.setItem(LAST_PATH_KEY, fullPath);
    }
  }, [location]);

  // Sync stage ID into URL if missing in PWA routes
  useEffect(() => {
    const isPwaModule = location.pathname.startsWith("/pwa/");
    const hasStageIdInPath = /\/pwa\/[^/]+\/([^/]+)/.test(location.pathname);
    
    if (isPwaModule && !hasStageIdInPath && activeStageId && stages.length > 0) {
      const stage = stages.find(s => s.id === activeStageId);
      if (stage) {
        // Construct the new path with stage ID: /pwa/module -> /pwa/module/stageId
        const pathParts = location.pathname.split("/").filter(Boolean);
        if (pathParts.length === 2) { // e.g., ["pwa", "alojamento"]
          const newPath = `/${pathParts[0]}/${pathParts[1]}/${activeStageId}${location.search}${location.hash}`;
          console.log("[AppStatePreserver] Syncing stage to URL:", newPath);
          setContextLocked(true);
          navigate(newPath, { replace: true });
          setTimeout(() => setContextLocked(false), 500);
        }
      }
    }
  }, [location.pathname, activeStageId, stages, navigate, location.search, location.hash]);

  // Restore path on initial mount
  useEffect(() => {
    if (hasRestored.current) return;
    
    const savedPath = localStorage.getItem(LAST_PATH_KEY);
    const currentPath = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    
    // Explicit escape hatch to stop restoration
    if (searchParams.has("no-restore")) {
      console.log("[AppStatePreserver] Restoration skipped by query param");
      localStorage.removeItem(LAST_PATH_KEY);
      sessionStorage.setItem(RESTORED_FLAG, "true");
      hasRestored.current = true;
      return;
    }

    // We only want to auto-restore if the user landed on the root or login page
    // and we haven't already restored in this session
    const isAtEntryPoints = currentPath === "/" || currentPath === "/login";
    
    if (savedPath && isAtEntryPoints && !sessionStorage.getItem(RESTORED_FLAG)) {
      // If we are at root, but the saved path is also root, do nothing
      if (savedPath === "/" || savedPath === "/login") {
        sessionStorage.setItem(RESTORED_FLAG, "true");
        hasRestored.current = true;
        return;
      }

      console.log("[AppStatePreserver] Restoring last path:", savedPath);
      
      sessionStorage.setItem(RESTORED_FLAG, "true");
      hasRestored.current = true;
      
      const timer = setTimeout(() => {
        // Double check we are still at the entry point before redirecting
        if (window.location.pathname === "/" || window.location.pathname === "/login") {
          setContextLocked(true);
          navigate(savedPath, { replace: true });
          setTimeout(() => setContextLocked(false), 500);
        }
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [navigate]);

  return null;
}
