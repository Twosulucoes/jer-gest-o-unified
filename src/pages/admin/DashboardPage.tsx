import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useActiveEventId } from "@/contexts/EventContext";

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
  // Preparação
  { label: "Importação", to: "/admin/importacao", icon: <Upload className="h-5 w-5" />, roles: ["admin", "secretaria"], group: "Preparação" },
  { label: "Participantes", to: "/admin/participantes", icon: <UsersRound className="h-5 w-5" />, roles: ADMIN_ROLES, group: "Preparação" },
  // Credenciamento
  { label: "Credenciamento", to: "/admin/credenciamento", icon: <UserCheck className="h-5 w-5" />, roles: ADMIN_ROLES, group: "Credenciamento" },
  { label: "Validação QR", to: "/admin/validacao-qr", icon: <ScanLine className="h-5 w-5" />, roles: ["admin", "secretaria", "coordenacao_tecnica", "transporte", "alimentacao"], group: "Credenciamento" },
  // Logística
  { label: "Viagens", to: "/admin/transporte/viagens", icon: <Navigation className="h-5 w-5" />, roles: TRANSPORT_ROLES, group: "Logística" },
  { label: "Consumo", to: "/admin/alimentacao/consumo", icon: <ClipboardList className="h-5 w-5" />, roles: FOOD_ROLES, group: "Logística" },
  { label: "Ocupação", to: "/admin/alojamento/ocupacao", icon: <KeyRound className="h-5 w-5" />, roles: ADMIN_ROLES, group: "Logística" },
  // Competição
  { label: "Agenda", to: "/admin/competicao/agenda", icon: <CalendarDays className="h-5 w-5" />, roles: ADMIN_ROLES, group: "Competição" },
  { label: "Resultados", to: "/admin/competicao/resultados", icon: <ClipboardList className="h-5 w-5" />, roles: ADMIN_ROLES, group: "Competição" },
];

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  sub?: string;
  alert?: boolean;
}

function StatCard({ label, value, icon, sub, alert }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${alert ? "text-destructive" : "text-foreground"}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { profile, roles, hasRole } = useAuth();
  const selectedEventId = useActiveEventId();

  const visibleActions = quickActions.filter((a) => a.roles.some((r) => hasRole(r)));
  const actionGroups = Array.from(new Set(visibleActions.map((a) => a.group)));


  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Administrador",
      secretaria: "Secretaria",
      transporte: "Transporte",
      alimentacao: "Alimentação",
      coordenacao_tecnica: "Coordenação Técnica",
      delegacao: "Delegação",
    };
    return labels[role] || role;
  };

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Auto-select first event
  const eventId = selectedEventId;

  // --- Participants & Credentials ---
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

  // --- Transport ---
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

  // --- Meals ---
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

  // --- Lodging ---
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

  // --- Competition ---
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

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Painel Operacional
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bem-vindo, {profile?.full_name || "Usuário"} — {roles.map(getRoleLabel).join(", ") || "Sem perfil"}
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Select value={eventId} onValueChange={() => {}}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o evento" />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Actions */}
      {visibleActions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Acesso Rápido
          </h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visibleActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <div className="text-muted-foreground group-hover:text-primary transition-colors">
                  {action.icon}
                </div>
                <span className="text-sm font-medium text-foreground">{action.label}</span>
                <span className="text-[10px] text-muted-foreground">{action.group}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {!eventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento para ver os indicadores</p>
        </div>
      ) : pLoading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <>
          {/* Event header */}
          {selectedEvent && (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                {selectedEvent.status === "active" ? "Ativo" : selectedEvent.status === "draft" ? "Rascunho" : selectedEvent.status}
              </Badge>
              {selectedEvent.start_date && selectedEvent.end_date && (
                <span className="text-xs text-muted-foreground">
                  {new Date(selectedEvent.start_date + "T00:00:00").toLocaleDateString("pt-BR")} — {new Date(selectedEvent.end_date + "T00:00:00").toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          )}

          {/* Section: Credenciamento */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <UserCheck className="h-4 w-4" /> Credenciamento
            </h2>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <StatCard label="Participantes" value={participantsCount} icon={<Users className="h-5 w-5" />} />
              <StatCard
                label="Credenciados"
                value={credentialedCount}
                icon={<UserCheck className="h-5 w-5" />}
                sub={participantsCount > 0 ? `${Math.round((credentialedCount / participantsCount) * 100)}%` : undefined}
              />
              <StatCard label="Credenciais emitidas" value={credentialsData.total} icon={<ShieldCheck className="h-5 w-5" />} />
              <StatCard
                label="Credenciais ativas"
                value={credentialsData.active}
                icon={<CheckCircle2 className="h-5 w-5" />}
                alert={credentialsData.total > 0 && credentialsData.active < credentialsData.total * 0.5}
                sub={credentialsData.total > 0 ? `${Math.round((credentialsData.active / credentialsData.total) * 100)}% do total` : undefined}
              />
            </div>
          </div>

          <Separator />

          {/* Section: Transporte */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Bus className="h-4 w-4" /> Transporte
            </h2>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
              <StatCard label="Viagens cadastradas" value={transportData.trips} icon={<Bus className="h-5 w-5" />} />
              <StatCard label="Embarcados (ativos)" value={transportData.passengers} icon={<Users className="h-5 w-5" />} />
            </div>
          </div>

          <Separator />

          {/* Section: Alimentação */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4" /> Alimentação
            </h2>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
              <StatCard label="Janelas ativas" value={mealsData.windows} icon={<Clock className="h-5 w-5" />} />
              <StatCard label="Consumos registrados" value={mealsData.consumptions} icon={<UtensilsCrossed className="h-5 w-5" />} />
            </div>
          </div>

          <Separator />

          {/* Section: Alojamento */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Building className="h-4 w-4" /> Alojamento
            </h2>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <StatCard label="Unidades ativas" value={lodgingData.units} icon={<Building className="h-5 w-5" />} />
              <StatCard label="Capacidade total" value={lodgingData.capacity} icon={<Users className="h-5 w-5" />} />
              <StatCard label="Ocupados" value={lodgingData.occupied} icon={<CheckCircle2 className="h-5 w-5" />} />
              <StatCard
                label="Vagas livres"
                value={Math.max(0, lodgingData.capacity - lodgingData.occupied)}
                icon={<AlertTriangle className="h-5 w-5" />}
                alert={lodgingData.capacity > 0 && lodgingData.occupied >= lodgingData.capacity * 0.9}
                sub={lodgingData.capacity > 0 ? `${Math.round(((lodgingData.capacity - lodgingData.occupied) / lodgingData.capacity) * 100)}% disponível` : undefined}
              />
            </div>
          </div>

          <Separator />

          {/* Section: Competição */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Competição
            </h2>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <StatCard label="Partidas" value={compData.matches} icon={<Trophy className="h-5 w-5" />} />
              <StatCard label="Resultados lançados" value={compData.results} icon={<CheckCircle2 className="h-5 w-5" />} />
              <StatCard label="Validados" value={compData.validated} icon={<ShieldCheck className="h-5 w-5" />} />
              <StatCard
                label="Publicados"
                value={compData.published}
                icon={<TrendingUp className="h-5 w-5" />}
                sub={compData.results > 0 ? `${Math.round((compData.published / compData.results) * 100)}% dos resultados` : undefined}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
