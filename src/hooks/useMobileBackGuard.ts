import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getModuleKey, getModuleFallbackPath } from "@/hooks/useNavigationHistory";

/**
 * Mobile/browser back-gesture guard.
 *
 * Goal: when the user uses the system back gesture (popstate) and would
 * "escape" the current module unexpectedly (e.g. land on /admin while still
 * deep inside an /admin/etapa/:id flow), gently redirect them to the module
 * home instead of dumping them at the global dashboard.
 *
 * We only intervene when:
 *  - The previous location was inside a non-root module
 *  - The new location is the global root /admin
 *  - The navigation came from a popstate (back/forward), not a click
 */
export function useMobileBackGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const prevPathRef = useRef<string>(location.pathname);
  const isPopRef = useRef<boolean>(false);

  useEffect(() => {
    const onPop = () => {
      isPopRef.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const prevPath = prevPathRef.current;
    const nextPath = location.pathname;
    const wasPop = isPopRef.current;
    isPopRef.current = false;
    prevPathRef.current = nextPath;

    if (!wasPop) return;
    if (prevPath === nextPath) return;

    const prevModule = getModuleKey(prevPath);
    const nextModule = getModuleKey(nextPath);

    // Only intervene when leaving a real module (etapa:* or named module)
    // and landing at the bare /admin root.
    const wasInsideModule =
      prevModule !== "_root" &&
      (prevModule.startsWith("etapa:") || prevModule !== nextModule);

    if (wasInsideModule && nextPath === "/admin") {
      const home = getModuleFallbackPath(prevModule);
      if (home && home !== "/admin") {
        navigate(home, { replace: true });
      }
    }
  }, [location.pathname, navigate]);
}
