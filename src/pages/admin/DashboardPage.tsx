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
  RefreshCw, Bed, Truck, CalendarClock, Calendar
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppKPI } from "@/components/app/AppKPI";
import { AppPageHeader } from "@/components/app/AppPageHeader";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { useDashboardData } from "./relatorios/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";

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

const PALETTE = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success, 142 71% 45%))", "hsl(var(--warning, 38 92% 50%))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

function fmtDate(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }
  catch { return d; }
}

export default function DashboardPage() {
  const { profile, roles, hasRole } = useAuth();
  const eventId = useActiveEventId();
  const { activeEvent } = useEventContext();
  const [showAllDel, setShowAllDel] = useState(false);

  const visibleActions = quickActions.filter((a) => a.roles.some((r) => hasRole(r)));

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading, refetchAll, lastUpdated } = useDashboardData(eventId);

  const selectedEvent = events.find(e => e.id === eventId);
  const r = data.resumo;
  const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0);

  const handleRefresh = async () => {
    await refetchAll();
    toast.success("Dados atualizados");
  };

  const delegationsToShow = showAllDel ? data.credenciamento.by_delegation : data.credenciamento.by_delegation.slice(0, 10);

  return (
    <div className="animate-fade-in space-y-6">
      <AppPageHeader
        title="Painel de Gestão"
        description={`Bem-vindo, ${profile?.full_name || "Usuário"} — ${roles.map(getRoleLabel).join(", ") || "Sem perfil"}`}
      >
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
              Atualizado: {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          {selectedEvent && (
            <Badge variant={selectedEvent.status === "active" ? "success" : "outline"} className="text-xs">
              {selectedEvent.status === "active" ? "Ativo" : selectedEvent.status === "draft" ? "Rascunho" : selectedEvent.status}
            </Badge>
          )}
        </div>
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

      {/* KPI Resumo Principal */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[100px]" />)
        ) : (
          <>
            <AppKPI icon={Users} label="Participantes" value={r.participants_total}
              sub={`${r.credentialed} credenciados (${pct(r.credentialed, r.participants_total)}%)`}
              loading={isLoading}
              className="bg-primary/5 border-primary/10"
            />
            <AppKPI icon={ShieldCheck} label="Credenciais Ativas" value={r.credentials_active}
              sub={`${r.credentials_today} hoje`}
              loading={isLoading}
            />
            <AppKPI icon={Trophy} label="Partidas" value={r.matches_total}
              sub={`${r.matches_done} concluídas`}
              loading={isLoading}
            />
            <AppKPI icon={UtensilsCrossed} label="Refeições" value={r.meals_total}
              sub={`${r.meals_today} hoje`}
              loading={isLoading}
            />
            <AppKPI icon={Building} label="Alojamento" value={`${r.lodging_occupied}/${r.lodging_capacity}`}
              sub={`${pct(r.lodging_occupied, r.lodging_capacity)}% ocupação`}
              loading={isLoading}
            />
            <AppKPI icon={Bus} label="Transporte" value={r.transport_trips}
              sub={`${r.transport_passengers} passageiros`}
              loading={isLoading}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Credenciamento Charts */}
        <section className="space-y-3 lg:col-span-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="h-3.5 w-3.5" /> Credenciamento
            </h2>
            {data.credenciamento.by_delegation.length > 10 && (
              <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setShowAllDel((v) => !v)}>
                {showAllDel ? "Ver menos" : "Ver todas delegações"}
              </Button>
            )}
          </div>
          
          <div className="grid gap-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Progresso por dia</CardTitle>
              </CardHeader>
              <CardContent className="h-[200px] px-2 pb-2">
                {isLoading ? <Skeleton className="w-full h-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.credenciamento.daily.map((d) => ({ ...d, date: fmtDate(d.date) }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                        cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Top Delegações</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {isLoading ? <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></div> : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {delegationsToShow.map((d) => (
                      <div key={d.delegation_id} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="truncate font-medium">{d.name}</span>
                          <span className="text-muted-foreground tabular-nums">{d.credentialed}/{d.total} ({d.pct}%)</span>
                        </div>
                        <Progress value={d.pct} className="h-1" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Competição e Alimentação */}
        <section className="space-y-6 lg:col-span-6">
          {/* Competição */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5" /> Competição
            </h2>
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Andamento por Modalidade</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {isLoading ? <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></div> : (
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {data.competicao.by_sport.slice(0, 8).map((row) => (
                      <div key={row.sport_event_id} className="space-y-1">
                        <div className="flex justify-between text-[11px] items-center">
                          <span className="truncate font-medium flex-1">{row.name}</span>
                          <div className="flex gap-3 text-muted-foreground tabular-nums">
                            <span>{row.done}/{row.total}</span>
                            <span className="w-8 text-right font-semibold text-foreground">{row.pct}%</span>
                          </div>
                        </div>
                        <Progress value={row.pct} className="h-1" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Alimentação */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <UtensilsCrossed className="h-3.5 w-3.5" /> Alimentação
            </h2>
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Consumo por dia (Empilhado)</CardTitle>
              </CardHeader>
              <CardContent className="h-[180px] px-2 pb-2">
                {isLoading ? <Skeleton className="w-full h-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.alimentacao.daily.map((d) => ({ ...d, date: fmtDate(String(d.date)) }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                      {data.alimentacao.meal_types.map((t, i) => (
                        <Bar key={t} dataKey={t} stackId="a" fill={PALETTE[i % PALETTE.length]} radius={i === data.alimentacao.meal_types.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
