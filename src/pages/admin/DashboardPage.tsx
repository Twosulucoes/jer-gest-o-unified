import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";
import {
  Users, UserCheck, ShieldCheck, Bus, UtensilsCrossed, Building, Trophy,
  AlertTriangle, Clock,
  Upload, UsersRound, ScanLine, Navigation, ClipboardList, CalendarDays, KeyRound,
  RefreshCw, Gavel, ClipboardCheck, MapPin
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppKPI } from "@/components/app/AppKPI";
import { AppPageHeader } from "@/components/app/AppPageHeader";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { useDashboardData } from "./relatorios/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { DashboardProgressCard } from "@/components/admin/DashboardProgressCard";

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
  { label: "Controle", to: "/admin/central-controle", icon: <ShieldCheck className="h-5 w-5" />, roles: ["super_admin"], group: "Super Admin" },
  { label: "Importação", to: "/admin/importacao", icon: <Upload className="h-5 w-5" />, roles: ["admin", "secretaria"], group: "Preparação" },
  { label: "Participantes", to: "/admin/participantes", icon: <UsersRound className="h-5 w-5" />, roles: ADMIN_ROLES, group: "Preparação" },
  { label: "Credenciamento", to: "/admin/credenciamento", icon: <UserCheck className="h-5 w-5" />, roles: ADMIN_ROLES, group: "Credenciamento" },
  { label: "Validação QR", to: "/admin/validacao-qr", icon: <ScanLine className="h-5 w-5" />, roles: ["admin", "secretaria", "coordenacao_tecnica", "transporte", "alimentacao"], group: "Credenciamento" },
  { label: "Vinculação", to: "/admin/credenciamento-externo", icon: <ScanLine className="h-5 w-5" />, roles: ADMIN_ROLES, group: "Credenciamento" },
  { label: "Viagens", to: "/admin/transporte/viagens", icon: <Navigation className="h-5 w-5" />, roles: TRANSPORT_ROLES, group: "Logística" },
  { label: "Consumo", to: "/admin/alimentacao/consumos", icon: <ClipboardList className="h-5 w-5" />, roles: FOOD_ROLES, group: "Logística" },
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

  const { data, isLoading, refetchAll, lastUpdated } = useDashboardData(eventId, null);
  const r = data.resumo;
  const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0);

  const handleRefresh = async () => {
    await refetchAll();
    toast.success("Dados atualizados");
  };

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
          {activeEvent && (
            <Badge variant={activeEvent.status === "active" ? "success" : "outline"} className="text-xs">
              {activeEvent.status === "active" ? "Ativo" : activeEvent.status === "draft" ? "Rascunho" : activeEvent.status}
            </Badge>
          )}
        </div>
      </AppPageHeader>

      {/* CTA de Operação por Etapa removido daqui para voltar ao menu principal */}


      {/* DashboardQuickActions removido conforme solicitado para manter apenas o dashboard visual */}

      {/* KPI Resumo Principal */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {isLoading ? (
          Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[100px]" />)
        ) : (
          <>
            <AppKPI icon={Users} label="Atletas" value={r.athletes_total}
              sub={`${r.participants_total} pessoas total`}
              loading={isLoading}
              className="bg-primary/5 border-primary/10"
            />
            <AppKPI icon={UserCheck} label="Credenciados" value={r.credentialed}
              sub={`${pct(r.credentialed, r.athletes_total)}% dos atletas`}
              loading={isLoading}
            />
            <AppKPI icon={Trophy} label="Partidas" value={r.matches_total}
              sub={`${r.matches_done} concluídas · ${r.matches_today} hoje`}
              loading={isLoading}
            />
            <AppKPI icon={Gavel} label="Árbitros" value={r.referees_assigned}
              sub={`de ${r.referees_total} cadastrados`}
              loading={isLoading}
              className="bg-accent/5 border-accent/10"
            />
            <AppKPI icon={UtensilsCrossed} label="Refeições" value={r.meals_total}
              sub={`${r.meals_today} hoje`}
              loading={isLoading}
            />
            <AppKPI icon={Building} label="Alojamento" value={`${r.lodging_occupied}/${r.lodging_capacity}`}
              sub={`${pct(r.lodging_occupied, r.lodging_capacity)}% ocupação`}
              alert={r.lodging_capacity > 0 && pct(r.lodging_occupied, r.lodging_capacity) > 85}
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
        {/* Novas KPIs de Inscrições */}
        <section className="space-y-3 lg:col-span-12">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ClipboardCheck className="h-3.5 w-3.5" /> Estatísticas de Inscrições
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <AppKPI
              icon={ClipboardCheck}
              label="Inscrições em Provas"
              value={data.inscricoes.total_provas}
              sub={`${r.athletes_total > 0 ? (data.inscricoes.total_provas / r.athletes_total).toFixed(1) : "—"} provas/atleta`}
              loading={isLoading}
              className="bg-blue-500/5 border-blue-500/10"
            />

            <AppKPI 
              icon={MapPin} 
              label="Vínculos por Etapa" 
              value={data.inscricoes.total_etapas}
              sub={`em ${data.inscricoes.by_stage.filter(s => s.count > 0).length} etapa(s) ativas`}
              loading={isLoading}
            />

            <AppKPI 
              icon={AlertTriangle} 
              label="Bloqueio Documental" 
              value={data.inscricoes.pendentes_documentacao}
              sub="Inscrições com pendências"
              alert={data.inscricoes.pendentes_documentacao > 0}
              loading={isLoading}
            />

            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Status das Inscrições</CardTitle>
              </CardHeader>
              <CardContent className="h-[120px] pt-0">
                {isLoading ? <Skeleton className="w-full h-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.inscricoes.por_status}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={45}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data.inscricoes.por_status.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 10 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <DashboardProgressCard
              title="Inscrições por Etapa"
              isLoading={isLoading}
              items={data.inscricoes.by_stage.map(s => ({
                id: s.id,
                name: s.name,
                current: s.count,
                total: r.participants_total,
                percentage: r.participants_total > 0 ? Math.round((s.count / r.participants_total) * 100) : 0
              }))}
            />

            <DashboardProgressCard
              title="Top 10 Modalidades (Inscrições)"
              isLoading={isLoading}
              items={data.inscricoes.by_modality.slice(0, 10).map(m => ({
                id: m.id,
                name: m.name,
                current: m.count,
                total: data.inscricoes.total_provas,
                percentage: data.inscricoes.total_provas > 0 ? Math.round((m.count / data.inscricoes.total_provas) * 100) : 0
              }))}
            />
            {data.inscricoes.by_modality.length > 10 && (
              <p className="text-[11px] text-muted-foreground text-center -mt-1">
                + {data.inscricoes.by_modality.length - 10} modalidade(s) não exibida(s)
              </p>
            )}
          </div>
        </section>
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

            <DashboardProgressCard
              title="Top Delegações"
              isLoading={isLoading}
              items={data.credenciamento.by_delegation.map(d => ({
                id: d.delegation_id,
                name: d.name,
                current: d.credentialed,
                total: d.total,
                percentage: d.pct
              }))}
              maxItems={showAllDel ? 999 : 10}
            />
          </div>
        </section>

        {/* Competição e Alimentação */}
        <section className="space-y-6 lg:col-span-6">
          {/* Competição */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5" /> Competição
            </h2>
            <DashboardProgressCard
              title="Andamento por Modalidade"
              isLoading={isLoading}
              items={data.competicao.by_sport.map(s => ({
                id: s.sport_event_id,
                name: s.name,
                current: s.done,
                total: s.total,
                percentage: s.pct
              }))}
            />
            {!isLoading && data.competicao.today.length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> Hoje — {data.competicao.today.length} partida{data.competicao.today.length !== 1 ? "s" : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2 max-h-[160px] overflow-y-auto">
                    {data.competicao.today.map(m => (
                      <div key={m.id} className="flex items-center gap-2 text-[11px]">
                        <span className="text-muted-foreground tabular-nums w-9 shrink-0">{m.start_time?.slice(0, 5) ?? "—:—"}</span>
                        <span className="flex-1 font-medium truncate">{m.sport_name}</span>
                        <Badge
                          variant={m.status === "completed" || m.status === "finished" ? "success" : m.status === "ongoing" ? "default" : "outline"}
                          className="text-[9px] h-4 px-1.5 shrink-0"
                        >
                          {m.status === "completed" || m.status === "finished" ? "Concluída" : m.status === "ongoing" ? "Em andamento" : "Ag."}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
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
            {data.alimentacao.by_delegation.length > 0 && (
              <DashboardProgressCard
                title="Refeições por Delegação"
                isLoading={isLoading}
                items={data.alimentacao.by_delegation.slice(0, 10).map((d, i) => ({
                  id: `${d.name}-${i}`,
                  name: d.name,
                  current: d.total,
                  total: r.meals_total,
                  percentage: r.meals_total > 0 ? Math.round((d.total / r.meals_total) * 100) : 0
                }))}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
