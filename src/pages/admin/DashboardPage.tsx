import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";
import {
  Users, UserCheck, ShieldCheck, Bus, UtensilsCrossed, Building, Trophy,
  CheckCircle2, AlertTriangle, Clock, TrendingUp,
  Upload, UsersRound, ScanLine, Navigation, ClipboardList, CalendarDays, KeyRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppKPI } from "@/components/app/AppKPI";
import { AppPageHeader } from "@/components/app/AppPageHeader";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";

type AppRole = Database["public"]["Enums"]["app_role"];

interface QuickAction {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles: AppRole[];
  group: string;
}

const ADMIN_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica"];
const TRANSPORT_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica", "transporte"];
const FOOD_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica", "alimentacao"];

const quickActions: QuickAction[] = [
  { label: "Importação", to: "/admin/importacao", icon: <Upload className="h-5 w-5" />, roles: ["admin", "secretaria"], group: "Preparação" },
  { label: "Participantes", to: "/admin/participantes", icon: <UsersRound className="h-5 w-5" />, roles: ADMIN_ROLES, group: "Preparação" },
  { label: "Credenciamento", to: "/admin/credenciamento", icon: <UserCheck className="h-5 w-5" />, roles: ADMIN_ROLES, group: "Credenciamento" },
  { label: "Validação QR", to: "/admin/validacao-qr", icon: <ScanLine className="h-5 w-5" />, roles: ["admin", "secretaria", "coordenacao_tecnica", "transporte", "alimentacao"], group: "Credenciamento" },
  { label: "Viagens", to: "/admin/transporte/viagens", icon: <Navigation className="h-5 w-5" />, roles: TRANSPORT_ROLES, group: "Logística" },
  { label: "Consumo", to: "/admin/alimentacao/consumo", icon: <ClipboardList className="h-5 w-5" />, roles: FOOD_ROLES, group: "Logística" },
  { label: "Ocupação", to: "/admin/alojamento/ocupacao", icon: <KeyRound className="h-5 w-5" />, roles: ADMIN_ROLES, group: "Logística" },
  { label: "Agenda", to: "/admin/competicao/partidas-agenda", icon: <CalendarDays className="h-5 w-5" />, roles: ADMIN_ROLES, group: "Competição" },
  { label: "Resultados", to: "/admin/competicao/resultados", icon: <ClipboardList className="h-5 w-5" />, roles: ADMIN_ROLES, group: "Competição" },
];

const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    admin: "Administrador", secretaria: "Secretaria", transporte: "Transporte",
    alimentacao: "Alimentação", coordenacao_tecnica: "Coordenação Técnica", delegacao: "Delegação",
  };
  return labels[role] || role;
};

export default function DashboardPage() {
  const { profile, roles, hasRole } = useAuth();
  const selectedEventId = useActiveEventId();
  const { activeEvent } = useEventContext();

  const visibleActions = quickActions.filter((a) => a.roles.some((r) => hasRole(r)));
  const eventId = selectedEventId;

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: participantsCount = 0, isLoading: pLoading } = useQuery({
    queryKey: ["dash-participants", eventId],
    queryFn: async () => {
      const { count, error } = await supabase.from("participants").select("id", { count: "exact", head: true }).eq("event_id", eventId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!eventId,
  });

  const { data: credentialedCount = 0 } = useQuery({
    queryKey: ["dash-credentialed", eventId],
    queryFn: async () => {
      const { count, error } = await supabase.from("participants").select("id", { count: "exact", head: true }).eq("event_id", eventId).not("credentialed_at", "is", null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!eventId,
  });

  const { data: credentialsData = { active: 0, total: 0 } } = useQuery({
    queryKey: ["dash-credentials", eventId],
    queryFn: async () => {
      const { count: total, error: e1 } = await supabase.from("participant_credentials").select("id", { count: "exact", head: true }).eq("event_id", eventId);
      if (e1) throw e1;
      const { count: active, error: e2 } = await supabase.from("participant_credentials").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "active");
      if (e2) throw e2;
      return { active: active ?? 0, total: total ?? 0 };
    },
    enabled: !!eventId,
  });

  const { data: transportData = { trips: 0, passengers: 0 } } = useQuery({
    queryKey: ["dash-transport", eventId],
    queryFn: async () => {
      const { count: trips, error: e1 } = await supabase.from("transport_trips").select("id", { count: "exact", head: true }).eq("event_id", eventId);
      if (e1) throw e1;
      const { data: tripIds, error: e2 } = await supabase.from("transport_trips").select("id").eq("event_id", eventId);
      if (e2) throw e2;
      if (!tripIds?.length) return { trips: trips ?? 0, passengers: 0 };
      const { count: passengers, error: e3 } = await supabase.from("transport_passengers").select("id", { count: "exact", head: true }).in("trip_id", tripIds.map(t => t.id)).eq("status", "boarded");
      if (e3) throw e3;
      return { trips: trips ?? 0, passengers: passengers ?? 0 };
    },
    enabled: !!eventId,
  });

  const { data: mealsData = { windows: 0, consumptions: 0 } } = useQuery({
    queryKey: ["dash-meals", eventId],
    queryFn: async () => {
      const { count: windows, error: e1 } = await supabase.from("meal_windows").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("is_active", true);
      if (e1) throw e1;
      const { data: windowIds, error: e2 } = await supabase.from("meal_windows").select("id").eq("event_id", eventId);
      if (e2) throw e2;
      if (!windowIds?.length) return { windows: windows ?? 0, consumptions: 0 };
      const { count: consumptions, error: e3 } = await supabase.from("meal_consumptions").select("id", { count: "exact", head: true }).in("meal_window_id", windowIds.map(w => w.id));
      if (e3) throw e3;
      return { windows: windows ?? 0, consumptions: consumptions ?? 0 };
    },
    enabled: !!eventId,
  });

  const { data: lodgingData = { units: 0, capacity: 0, occupied: 0 } } = useQuery({
    queryKey: ["dash-lodging", eventId],
    queryFn: async () => {
      const { data: units, error: e1 } = await supabase.from("lodging_units").select("id, capacity").eq("event_id", eventId).eq("is_active", true);
      if (e1) throw e1;
      const totalCap = (units ?? []).reduce((s, u) => s + u.capacity, 0);
      const { count: occupied, error: e2 } = await supabase.from("lodging_occupancies").select("id", { count: "exact", head: true }).eq("event_id", eventId).in("status", ["allocated", "checked_in"]);
      if (e2) throw e2;
      return { units: units?.length ?? 0, capacity: totalCap, occupied: occupied ?? 0 };
    },
    enabled: !!eventId,
  });

  const { data: compData = { matches: 0, results: 0, validated: 0, published: 0 } } = useQuery({
    queryKey: ["dash-competition", eventId],
    queryFn: async () => {
      const { count: matches, error: e1 } = await supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("event_id", eventId);
      if (e1) throw e1;
      const { data: matchIds, error: e1b } = await supabase.from("competition_matches").select("id").eq("event_id", eventId);
      if (e1b) throw e1b;
      if (!matchIds?.length) return { matches: matches ?? 0, results: 0, validated: 0, published: 0 };
      const ids = matchIds.map(m => m.id);
      const { count: results, error: e2 } = await supabase.from("competition_match_results").select("id", { count: "exact", head: true }).in("match_id", ids);
      if (e2) throw e2;
      const { count: validated, error: e3 } = await supabase.from("competition_match_results").select("id", { count: "exact", head: true }).in("match_id", ids).not("validated_at", "is", null);
      if (e3) throw e3;
      const { count: published, error: e4 } = await supabase.from("competition_match_results").select("id", { count: "exact", head: true }).in("match_id", ids).eq("result_status", "publicado");
      if (e4) throw e4;
      return { matches: matches ?? 0, results: results ?? 0, validated: validated ?? 0, published: published ?? 0 };
    },
    enabled: !!eventId,
  });

  const selectedEvent = events.find(e => e.id === eventId);
  const isLoading = pLoading;

  return (
    <div className="animate-fade-in space-y-6">
      <AppPageHeader
        title="Painel Operacional"
        description={`Bem-vindo, ${profile?.full_name || "Usuário"} — ${roles.map(getRoleLabel).join(", ") || "Sem perfil"}`}
      >
        {selectedEvent && (
          <Badge variant={selectedEvent.status === "active" ? "success" : "outline"} className="text-xs">
            {selectedEvent.status === "active" ? "Ativo" : selectedEvent.status === "draft" ? "Rascunho" : selectedEvent.status}
          </Badge>
        )}
      </AppPageHeader>

      {/* Quick Actions */}
      {visibleActions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Acesso Rápido
          </h2>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visibleActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all duration-150 hover:shadow-app-md hover:border-primary/30 active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {action.icon}
                </div>
                <span className="text-xs font-medium text-foreground">{action.label}</span>
                <span className="text-[10px] text-muted-foreground/60">{action.group}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="space-y-6">
        {/* Credenciamento */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <UserCheck className="h-3.5 w-3.5" /> Credenciamento
          </h2>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <AppKPI label="Participantes" value={participantsCount} icon={Users} loading={isLoading} />
            <AppKPI
              label="Credenciados" value={credentialedCount} icon={UserCheck} loading={isLoading}
              sub={participantsCount > 0 ? `${Math.round((credentialedCount / participantsCount) * 100)}%` : undefined}
            />
            <AppKPI label="Credenciais emitidas" value={credentialsData.total} icon={ShieldCheck} loading={isLoading} />
            <AppKPI
              label="Credenciais ativas" value={credentialsData.active} icon={CheckCircle2} loading={isLoading}
              alert={credentialsData.total > 0 && credentialsData.active < credentialsData.total * 0.5}
              sub={credentialsData.total > 0 ? `${Math.round((credentialsData.active / credentialsData.total) * 100)}% do total` : undefined}
            />
          </div>
        </section>

        {/* Transporte */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Bus className="h-3.5 w-3.5" /> Transporte
          </h2>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <AppKPI label="Viagens" value={transportData.trips} icon={Bus} loading={isLoading} />
            <AppKPI label="Embarcados" value={transportData.passengers} icon={Users} loading={isLoading} />
          </div>
        </section>

        {/* Alimentação */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <UtensilsCrossed className="h-3.5 w-3.5" /> Alimentação
          </h2>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <AppKPI label="Janelas ativas" value={mealsData.windows} icon={Clock} loading={isLoading} />
            <AppKPI label="Consumos" value={mealsData.consumptions} icon={UtensilsCrossed} loading={isLoading} />
          </div>
        </section>

        {/* Alojamento */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Building className="h-3.5 w-3.5" /> Alojamento
          </h2>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <AppKPI label="Unidades ativas" value={lodgingData.units} icon={Building} loading={isLoading} />
            <AppKPI label="Capacidade total" value={lodgingData.capacity} icon={Users} loading={isLoading} />
            <AppKPI label="Ocupados" value={lodgingData.occupied} icon={CheckCircle2} loading={isLoading} />
            <AppKPI
              label="Vagas livres"
              value={Math.max(0, lodgingData.capacity - lodgingData.occupied)}
              icon={AlertTriangle}
              loading={isLoading}
              alert={lodgingData.capacity > 0 && lodgingData.occupied >= lodgingData.capacity * 0.9}
              sub={lodgingData.capacity > 0 ? `${Math.round(((lodgingData.capacity - lodgingData.occupied) / lodgingData.capacity) * 100)}% disponível` : undefined}
            />
          </div>
        </section>

        {/* Competição */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5" /> Competição
          </h2>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <AppKPI label="Partidas" value={compData.matches} icon={Trophy} loading={isLoading} />
            <AppKPI label="Resultados" value={compData.results} icon={CheckCircle2} loading={isLoading} />
            <AppKPI label="Validados" value={compData.validated} icon={ShieldCheck} loading={isLoading} />
            <AppKPI
              label="Publicados" value={compData.published} icon={TrendingUp} loading={isLoading}
              sub={compData.results > 0 ? `${Math.round((compData.published / compData.results) * 100)}% dos resultados` : undefined}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
