import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { logPwaEvent } from "@/utils/pwaTelemetry";
import { useEventContext } from "@/contexts/EventContext";
import { useStageContext } from "@/contexts/StageContext";
import { Loader2 } from "lucide-react";

const KNOWN_PWA_MODULES = [
  "alojamento",
  "alimentacao",
  "transporte",
  "coordenacao-tecnica",
  "delegacao",
  "credenciamento",
  "resultados",
  "registros",
  "arbitragem",
  "diagnostico",
];

/**
 * Component to handle and log non-existent PWA routes.
 */
export default function PwaNotFoundHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeEventId } = useEventContext();
  const { activeStageId } = useStageContext();

  useEffect(() => {
    console.warn("[PwaNotFoundHandler] rota PWA inexistente:", location.pathname);

    // Defensive recovery: if path is /pwa/<known-module>/<garbage>, fall back
    // to the module home rather than the global PWA landing.
    const segments = location.pathname.split("/").filter(Boolean);
    let target = "/pwa";
    if (segments[0] === "pwa" && segments[1] && KNOWN_PWA_MODULES.includes(segments[1])) {
      target = `/pwa/${segments[1]}`;
      console.warn(`[PwaNotFoundHandler] recuperando para a home do módulo: ${target}`);
    }

    logPwaEvent({
      action: "route_not_found",
      path: location.pathname,
      target_path: target,
      reason: "PWA Route does not exist",
      event_id: activeEventId,
      stage_id: activeStageId
    });

    const timer = setTimeout(() => {
      navigate(target, { replace: true });
    }, 1500);

    return () => clearTimeout(timer);
  }, [location.pathname, navigate, activeEventId, activeStageId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Página não encontrada</h2>
        <p className="text-muted-foreground">
          A rota <span className="font-mono text-xs bg-muted px-1 rounded">{location.pathname}</span> não existe no PWA.
        </p>
        <p className="text-sm text-muted-foreground animate-pulse">
          Redirecionando...
        </p>
      </div>
    </div>
  );
}
