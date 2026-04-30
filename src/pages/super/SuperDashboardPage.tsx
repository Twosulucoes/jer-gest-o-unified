import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppKPI } from "@/components/app/AppKPI";
import { Calendar, Users, UserCheck, Activity, AlertTriangle, Cpu, Database, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import GlobalRefreshButton from "@/components/super/GlobalRefreshButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { RemediationDialog, type RemediationAction } from "@/components/super/RemediationDialog";

export default function SuperDashboardPage() {
  const navigate = useNavigate();
  const [remediationOpen, setRemediationOpen] = useState(false);
  const [activeRemediation, setRemediationAction] = useState<RemediationAction>("republish_results");

  const openRemediation = (action: RemediationAction) => {
    setRemediationAction(action);
    setRemediationOpen(true);
  };

  const { data: stats, isLoading } = useQuery({
    queryKey: ["super-dashboard-stats"],
    queryFn: async () => {
      const [eventsRes, participantsRes, usersRes, auditRes, metricsRes] = await Promise.all([
        supabase.from("events").select("id, status", { count: "exact" }),
        supabase.from("participants").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("audit_events").select("created_at").order("created_at", { ascending: false }).limit(1),
        supabase.from("monitoring_metrics").select("*").order("bucket_at", { ascending: false }).limit(1),
      ]);

      const activeEvents = eventsRes.data?.filter((e) => e.status === "active").length ?? 0;
      const totalEvents = eventsRes.count ?? 0;
      const latestMetric = metricsRes.data?.[0];

      return {
        activeEvents,
        totalEvents,
        totalParticipants: participantsRes.count ?? 0,
        totalUsers: usersRes.count ?? 0,
        lastActivity: auditRes.data?.[0]?.created_at ?? null,
        activeUsers: latestMetric?.active_users ?? 0,
        loadReqMin: latestMetric?.requests_count ?? 0,
        errorRate: latestMetric?.errors_count ?? 0,
      };
    },
    refetchInterval: 30000,
  });

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Super Admin</h1>
          <p className="text-sm text-zinc-400 mt-1">Visão global de todos os eventos e clientes.</p>
        </div>
        <GlobalRefreshButton label="Refresh todas máquinas" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div onClick={() => navigate("/super/monitor")} className="cursor-pointer">
          <AppKPI
            label="Saúde do Sistema"
            value={stats?.errorRate === 0 ? "Normal" : "Crítico"}
            icon={Activity}
            sub={stats?.errorRate === 0 ? "Nenhum erro recente" : `${stats?.errorRate} erros detectados`}
            loading={isLoading}
            alert={!!stats && stats.errorRate > 0}
            className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-100 [&_p]:text-zinc-400"
          />
        </div>
        <div onClick={() => navigate("/super/monitor")} className="cursor-pointer">
          <AppKPI
            label="Usuários Ativos"
            value={stats?.activeUsers ?? 0}
            icon={Users}
            sub={`${stats?.loadReqMin ?? 0} req/min`}
            loading={isLoading}
            className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-100 [&_p]:text-zinc-400"
          />
        </div>
        <div onClick={() => navigate("/super/eventos")} className="cursor-pointer">
          <AppKPI
            label="Eventos Ativos"
            value={stats?.activeEvents ?? 0}
            icon={Calendar}
            sub={`${stats?.totalEvents ?? 0} total no DB`}
            loading={isLoading}
            className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-100 [&_p]:text-zinc-400"
          />
        </div>
        <div onClick={() => navigate("/super/logs")} className="cursor-pointer">
          <AppKPI
            label="Auditoria"
            value="Ativa"
            icon={Database}
            sub={`Visto: ${formatDate(stats?.lastActivity ?? null)}`}
            loading={isLoading}
            className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-100 [&_p]:text-zinc-400"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-zinc-900 mb-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-zinc-500">Ações Críticas de Infra</CardTitle>
            <Cpu className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => openRemediation("fix_orphaned_records")}
            >
              <Database className="h-4 w-4 text-blue-400" />
              Corrigir Órfãos
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => openRemediation("reset_system_cache")}
            >
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Reset Cache Global
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => navigate("/super/config")}
            >
              <Settings className="h-4 w-4 text-zinc-400" />
              Configurações Engine
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => navigate("/super/permissoes")}
            >
              <UserCheck className="h-4 w-4 text-emerald-400" />
              Permissões Master
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-zinc-900 mb-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-zinc-500">Últimos Alertas de Segurança</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold">Falha de Integridade (Schema)</p>
                  <p className="text-[10px] text-zinc-500">Tabela 'participants' possui colunas órfãs.</p>
                </div>
                <Badge variant="destructive" className="text-[10px]">ALERTA</Badge>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold">Pico de Carga Detectado</p>
                  <p className="text-[10px] text-zinc-500">PWA emitiu 450 req/min no módulo transporte.</p>
                </div>
                <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-500">INFO</Badge>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-4 text-[10px] uppercase font-bold text-zinc-600 hover:text-zinc-400"
              onClick={() => navigate("/super/logs")}
            >
              Ver todos os logs de auditoria
            </Button>
          </CardContent>
        </Card>
      </div>

      <RemediationDialog 
        open={remediationOpen} 
        onOpenChange={setRemediationOpen}
        action={activeRemediation}
      />
    </div>
  );
}
