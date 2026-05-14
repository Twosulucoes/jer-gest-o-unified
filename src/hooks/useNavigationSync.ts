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
  const { setContextLocked } = useStageContext();

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

  // NOTE: O bloco de "Synchronize stage ID into URL" foi removido porque as rotas do PWA
  // não usam :stageId como segmento de URL — a etapa ativa é gerenciada pelo StageContext
  // via localStorage. Injetar o UUID na URL produzia /pwa/configuracao/<uuid> e criava
  // um loop infinito entre o PwaNotFoundHandler e o efeito.

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
