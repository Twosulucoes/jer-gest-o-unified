import { Navigate, Link, useParams, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEventContext } from "@/contexts/EventContext";
import { useStageContext } from "@/contexts/StageContext";
import AuthLoadingScreen from "@/components/auth/AuthLoadingScreen";
import { AlertCircle, CalendarDays, Lock, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/config/accessControl";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VersionBadge } from "../VersionBadge";

interface PwaRouteGuardProps {
  children: React.ReactNode;
  /** Roles allowed to access this PWA module. If empty, any authenticated user passes. */
  allowedRoles?: AppRole[];
  /** Whether this route requires a stage (etapa) to be selected. Defaults to true. */
  requireStage?: boolean;
}

export default function PwaRouteGuard({ children, allowedRoles, requireStage = true }: PwaRouteGuardProps) {
  const { user, loading, hasRole } = useAuth();
  const { activeEventId, eventsLoading } = useEventContext();
  const { activeStageId, stagesLoading } = useStageContext();
  const { incidentId } = useParams();
  const location = useLocation();
  const [resourceValidating, setResourceValidating] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);

  useEffect(() => {
    const validateIncident = async () => {
      // Only run this specific check for the incident detail route
      if (!incidentId || !activeEventId || !location.pathname.includes("/pwa/coordenacao-tecnica/incidente/")) {
        setResourceError(null);
        return;
      }

      setResourceValidating(true);
      try {
        const { data, error } = await supabase
          .from("operational_incidents")
          .select("event_id")
          .eq("id", incidentId)
          .maybeSingle();

        if (error) {
          console.error("Error fetching incident for validation:", error);
          setResourceError("Ocorreu um erro ao validar o acesso ao incidente.");
        } else if (!data) {
          setResourceError("Incidente não encontrado.");
        } else if (data.event_id !== activeEventId) {
          setResourceError("Este incidente não pertence ao evento selecionado.");
        } else {
          setResourceError(null);
        }
      } catch (err) {
        console.error("Unexpected error validating incident:", err);
        setResourceError("Erro inesperado ao validar o incidente.");
      } finally {
        setResourceValidating(false);
      }
    };

    validateIncident();
  }, [incidentId, activeEventId, location.pathname]);

  if (loading || eventsLoading || stagesLoading || resourceValidating) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Allow the configuration fallback page to be viewed without being caught in a redirect loop
  if (location.pathname === "/pwa/configuracao") {
    return <div className="tactical-cockpit min-h-screen pb-20">{children}</div>;
  }

  // Central redirection layer for internal PWA routes
  const isPwaInternalRoute = location.pathname.startsWith("/pwa/") && 
                             location.pathname !== "/pwa/configuracao" &&
                             location.pathname !== "/pwa/install" &&
                             location.pathname !== "/pwa/set-password";

  if (isPwaInternalRoute) {
    if (!activeEventId) {
      return <Navigate to="/pwa/configuracao" state={{ from: location, reason: "missing_event" }} replace />;
    }
    if (requireStage && !activeStageId) {
      return <Navigate to="/pwa/configuracao" state={{ from: location, reason: "missing_stage" }} replace />;
    }
  }

  // If specific roles required, check. Admin/secretaria always pass.
  if (allowedRoles && allowedRoles.length > 0) {
    const authorized = hasRole("admin") || hasRole("secretaria") || allowedRoles.some((r) => hasRole(r));
    if (!authorized) {
      return <Navigate to="/acesso-negado" replace />;
    }
  }

  // Resource Ownership Check: For specific routes like incidents, ensure it belongs to the active event
  if (resourceError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
          <Lock className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight">Acesso Negado</h2>
          <p className="text-muted-foreground max-w-[280px]">
            {resourceError}
          </p>
        </div>
        <Button asChild variant="outline" className="w-full max-w-[240px]">
          <Link to="/pwa/coordenacao-tecnica/incidentes">Voltar para Incidentes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="tactical-cockpit min-h-screen pb-20">
      {children}
      <VersionBadge />
    </div>
  );
}