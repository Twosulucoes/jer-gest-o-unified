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
import { logPwaEvent } from "@/utils/pwaTelemetry";


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
          logPwaEvent({
            action: "invalid_resource_access",
            reason: "Incident not found",
            metadata: { incidentId },
            event_id: activeEventId
          });
        } else if (data.event_id !== activeEventId) {
          setResourceError("Este incidente não pertence ao evento selecionado.");
          logPwaEvent({
            action: "invalid_resource_access",
            reason: "Incident belongs to different event",
            metadata: { incidentId, incidentEventId: data.event_id },
            event_id: activeEventId
          });
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
      logPwaEvent({
        action: "forced_config_redirect",
        target_path: "/pwa/configuracao",
        reason: "missing_event"
      });
      return <Navigate to="/pwa/configuracao" state={{ from: location, reason: "missing_event" }} replace />;
    }

    // Identifica se o caminho atual é uma "página inicial de módulo" que geralmente lista locais/etapas
    const isModuleHome = location.pathname.split('/').length === 3;
    const moduleRequireStage = requireStage && !isModuleHome;

    if (moduleRequireStage && !activeStageId) {
      logPwaEvent({
        action: "forced_config_redirect",
        target_path: "/pwa/configuracao",
        reason: "missing_stage",
        event_id: activeEventId
      });
      return <Navigate to="/pwa/configuracao" state={{ from: location, reason: "missing_stage" }} replace />;
    }
  }

  // If specific roles required, check. Admin/secretaria always pass.
  if (allowedRoles && allowedRoles.length > 0) {
    const authorized = hasRole("admin") || hasRole("super_admin") || hasRole("secretaria") || allowedRoles.some((r) => hasRole(r));
    if (!authorized) {
      logPwaEvent({
        action: "access_denied",
        reason: "User lacks required roles",
        metadata: { allowedRoles },
        event_id: activeEventId,
        stage_id: activeStageId
      });
      
      // Se não for autorizado para o sub-módulo, manda de volta para a home do PWA
      if (location.pathname !== "/pwa" && location.pathname !== "/pwa/") {
        return <Navigate to="/pwa" replace />;
      }
      
      // Se nem para a home do PWA ele é autorizado (improvável), vai para negado
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