import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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

  // Restore path on initial mount
  useEffect(() => {
    if (hasRestored.current) return;
    
    const savedPath = localStorage.getItem(LAST_PATH_KEY);
    const currentPath = window.location.pathname;
    
    // We only want to auto-restore if the user landed on the root or login page
    // and we haven't already restored in this session (or if they explicitly refreshed)
    const isAtEntryPoints = currentPath === "/" || currentPath === "/login";
    
    if (savedPath && isAtEntryPoints && !sessionStorage.getItem(RESTORED_FLAG)) {
      console.log("[AppStatePreserver] Restoring last path:", savedPath);
      
      // Mark as restored for this session to avoid hijacking intentional navigations to /
      sessionStorage.setItem(RESTORED_FLAG, "true");
      hasRestored.current = true;
      
      // Small delay to let other providers initialize (Auth, etc.)
      const timer = setTimeout(() => {
        navigate(savedPath, { replace: true });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [navigate]);

  return null;
}
