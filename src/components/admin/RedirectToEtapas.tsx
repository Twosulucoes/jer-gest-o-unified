import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

/**
 * Used by legacy operational routes (e.g. /admin/credenciamento, /admin/competicao/...).
 * Operational modules now live INSIDE a stage context. We force the user to pick a stage
 * before operating, to prevent acting on the wrong context.
 */
export default function RedirectToEtapas() {
  const location = useLocation();

  useEffect(() => {
    toast.info("Selecione uma etapa primeiro", {
      description: "Os módulos operacionais agora ficam dentro de uma etapa do evento.",
    });
  }, [location.pathname]);

  return <Navigate to="/admin/etapas" replace state={{ from: location.pathname }} />;
}
