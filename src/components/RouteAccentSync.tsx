import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getModuleAccentForPath } from "@/theme/moduleAccent";

export function RouteAccentSync() {
  const location = useLocation();

  useEffect(() => {
    const accent = getModuleAccentForPath(location.pathname);
    document.documentElement.style.setProperty("--module-accent", accent);
  }, [location.pathname]);

  return null;
}
