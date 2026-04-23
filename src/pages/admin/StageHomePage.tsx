import { Link, useParams } from "react-router-dom";
import {
  BadgeCheck, Trophy, Building, UtensilsCrossed, Bus,
  AlertTriangle, ClipboardList, FileBarChart, ArrowRight, Gavel,
  Users, CheckCircle2, RefreshCw, CalendarClock, Clock
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AppKPI } from "@/components/app/AppKPI";
import { useStageDashboardData } from "./useStageDashboardData";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ALL_OPS: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica"];

interface ModuleCard {
  label: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  color: string;
  roles: AppRole[];
}

const MODULES: ModuleCard[] = [
  { label: "Credenciamento", description: "Emissão e validação de credenciais.", icon: <BadgeCheck className="h-5 w-5" />, to: "credenciamento", color: "text-emerald-600", roles: ALL_OPS },
  { label: "Competição", description: "Provas, partidas e resultados desta etapa.", icon: <Trophy className="h-5 w-5" />, to: "competicao", color: "text-amber-600", roles: [...ALL_OPS, "coordenador_modalidade"] },
  { label: "Alojamento", description: "Locais, unidades e ocupações.", icon: <Building className="h-5 w-5" />, to: "alojamento", color: "text-purple-600", roles: [...ALL_OPS, "alojamento"] },
  { label: "Alimentação", description: "Janelas, tipos e consumos.", icon: <UtensilsCrossed className="h-5 w-5" />, to: "alimentacao", color: "text-orange-600", roles: [...ALL_OPS, "alimentacao"] },
  { label: "Transporte", description: "Veículos, rotas e viagens.", icon: <Bus className="h-5 w-5" />, to: "transporte", color: "text-cyan-600", roles: [...ALL_OPS, "transporte"] },
  { label: "Ocorrências", description: "Registro e acompanhamento de incidentes.", icon: <AlertTriangle className="h-5 w-5" />, to: "ocorrencias", color: "text-red-600", roles: ALL_OPS },
  { label: "Protestos (CDE)", description: "Fila de julgamento de protestos online.", icon: <Gavel className="h-5 w-5" />, to: "protestos", color: "text-rose-600", roles: [...ALL_OPS, "cde", "super_admin"] },
  { label: "Pesquisa de Satisfação", description: "Coleta de feedback dos participantes.", icon: <ClipboardList className="h-5 w-5" />, to: "pesquisa", color: "text-blue-600", roles: ALL_OPS },
  { label: "Relatórios da Etapa", description: "Relatórios operacionais desta etapa.", icon: <FileBarChart className="h-5 w-5" />, to: "relatorios", color: "text-indigo-600", roles: [...ALL_OPS, "coordenador_modalidade"] },
];

export default function StageHomePage() {
  const { stageId } = useParams<{ stageId: string }>();
  const { hasRole } = useAuth();
  const { data, isLoading, refetchAll, lastUpdated } = useStageDashboardData(stageId);

  const visible = MODULES.filter((m) => m.roles.some((r) => hasRole(r)));
  const r = data.resumo;
  const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0);

  const handleRefresh = async () => {
    await refetchAll();
    toast.success("Dados da etapa atualizados");
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Painel da Etapa</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão operacional e acesso aos módulos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
              Atualizado: {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Mini KPIs Dashboard */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
        <AppKPI icon={Users} label="Participantes" value={r.participants} 
          sub={`${r.credentialed} credenciados (${pct(r.credentialed, r.participants)}%)`}
          loading={isLoading}
        />
        <AppKPI icon={Trophy} label="Partidas" value={r.matches_total} 
          sub={`${r.matches_done} concluídas`}
          loading={isLoading}
        />
        <AppKPI icon={UtensilsCrossed} label="Refeições" value={r.meals_total} 
          sub={`${r.meals_today} hoje nesta etapa`}
          loading={isLoading}
        />
        <AppKPI icon={Building} label="Alojamento" value={`${r.lodging_occupied}/${r.lodging_capacity}`} 
          sub={`${pct(r.lodging_occupied, r.lodging_capacity)}% ocupação`}
          loading={isLoading}
        />
        <div className="hidden lg:block">
          <AppKPI icon={ClipboardList} label="Status Geral" value={`${pct(r.matches_done, r.matches_total)}%`} 
            sub="Conclusão da Etapa"
            loading={isLoading}
            className="bg-primary/5 border-primary/10"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Módulos Operacionais */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Módulos Operacionais
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visible.map((m) => (
              <Link key={m.to} to={m.to} className="group">
                <Card className="h-full hover:border-primary hover:shadow-app-md transition-all">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        <span className={m.color}>{m.icon}</span>
                        <span className="group-hover:text-primary transition-colors">{m.label}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{m.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Sidebar Mini Dash info */}
        <div className="space-y-6">
          {/* Agenda de Hoje */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5" /> Próximas Partidas (Hoje)
            </h2>
            <Card>
              <CardContent className="p-4 space-y-3">
                {isLoading ? <Skeleton className="h-20 w-full" /> : data.competicao.today.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma partida agendada para hoje.</p>
                ) : (
                  <div className="space-y-3">
                    {data.competicao.today.map(m => (
                      <div key={m.id} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                        <div className="h-10 w-10 rounded bg-muted flex flex-col items-center justify-center text-[10px] font-bold">
                          <Clock className="h-3 w-3 mb-1" />
                          {m.start_time?.slice(0, 5) || "--:--"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{m.sport_name}</p>
                          <Badge variant="outline" className="text-[9px] h-4 mt-1 capitalize">{m.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="ghost" size="sm" className="w-full text-xs h-8" asChild>
                  <Link to="competicao">Ver agenda completa</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Progresso Modalidades */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5" /> Progresso da Competição
            </h2>
            <Card>
              <CardContent className="p-4 space-y-4">
                {isLoading ? <Skeleton className="h-20 w-full" /> : data.competicao.by_sport.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma modalidade configurada.</p>
                ) : (
                  <div className="space-y-3">
                    {data.competicao.by_sport.slice(0, 4).map(s => (
                      <div key={s.sport_event_id} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="truncate font-medium flex-1">{s.name}</span>
                          <span className="text-muted-foreground tabular-nums ml-2">{s.done}/{s.total}</span>
                        </div>
                        <Progress value={s.pct} className="h-1" />
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="ghost" size="sm" className="w-full text-xs h-8" asChild>
                  <Link to="competicao/painel">Painel de Competição</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
