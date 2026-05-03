import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { logPwaEvent } from "@/utils/pwaTelemetry";
import { useEventContext } from "@/contexts/EventContext";
import { useStageContext } from "@/contexts/StageContext";
import { Loader2 } from "lucide-react";

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
    logPwaEvent({
      action: "route_not_found",
      path: location.pathname,
      target_path: "/pwa",
      reason: "PWA Route does not exist",
      event_id: activeEventId,
      stage_id: activeStageId
    });

    // Redirect to PWA home after a short delay
    const timer = setTimeout(() => {
      navigate("/pwa", { replace: true });
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
          Redirecionando para o menu principal...
        </p>
      </div>
    </div>
  );
}
