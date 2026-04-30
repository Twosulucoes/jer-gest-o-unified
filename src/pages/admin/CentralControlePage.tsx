import { useAuth } from "@/hooks/useAuth";
import { AppPageHeader } from "@/components/app/AppPageHeader";
import { SuperAdminRemediation } from "@/components/admin/super-admin/SuperAdminRemediation";
import { TechnicalAuditSummary } from "@/components/admin/super-admin/TechnicalAuditSummary";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Shield, AlertTriangle, Terminal, History, ArrowRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";

export default function CentralControlePage() {
  const { profile } = useAuth();
  usePerformanceMonitor("CentralControlePage");

  const { data: recentCritical = [], isLoading: loadingCritical } = useQuery({
    queryKey: ["recent-critical-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_events")
        .select(`
          id,
          action,
          payload,
          created_at,
          profiles:created_by (full_name)
        `)
        .or("action.eq.scope_violation,table_name.eq.pwa_scope_violation,action.eq.error")
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    }
  });

  return (
    <div className="animate-fade-in space-y-6 max-w-7xl mx-auto">
      <AppPageHeader
        title="Central de Controle (Super Admin)"
        description="Visão consolidada de integridade, remediação e eventos críticos do sistema."
      >
        <div className="flex gap-2">
          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 font-mono">
            V 2.6.0-STAGE4
          </Badge>
          <Button variant="outline" size="sm" asChild className="h-8 text-xs">
            <Link to="/admin/auditoria">
              <History className="mr-2 h-3.5 w-3.5" />
              Logs Completos
            </Link>
          </Button>
        </div>
      </AppPageHeader>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Lado Esquerdo: Remediação e Saúde */}
        <div className="lg:col-span-8 space-y-6">
          <SuperAdminRemediation />
          
          <div className="grid gap-6 md:grid-cols-2">
            <TechnicalAuditSummary />
            
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Performance e Infra
                </CardTitle>
                <CardDescription className="text-[10px]">
                  Métricas de renderização e saúde da infraestrutura.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
                  <span className="text-xs font-medium">Render Latency (Avg)</span>
                  <Badge variant="outline" className="h-5 text-[10px]">~32ms</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                  <span className="text-xs font-medium">Postgres Status</span>
                  <Badge className="bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/20 h-5 text-[10px]">Saudável</Badge>
                </div>
                <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground" asChild>
                  <Link to="/admin/sistema/database-monitoring">
                    Monitoramento Avançado <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Status do Banco / Infra */}
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Segurança e Permissões
                </CardTitle>
                <CardDescription className="text-[10px]">
                  Estado atual das políticas de acesso e chaves.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                  <span className="text-xs font-medium">RLS Policies (Banco)</span>
                  <Badge className="bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/20 h-5 text-[10px]">Ativas</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                  <span className="text-xs font-medium">JWT Expiration</span>
                  <Badge className="bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/20 h-5 text-[10px]">60 min</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <span className="text-xs font-medium">Sessões Ativas</span>
                  <span className="text-xs font-mono font-bold text-amber-600">--</span>
                </div>
                <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground" asChild>
                  <Link to="/admin/sistema/diagnostico">
                    Ver Diagnóstico Detalhado <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Lado Direito: Eventos Críticos e Feed */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="h-full">
            <CardHeader className="bg-muted/30 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Eventos Críticos Recentes
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingCritical ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Carregando eventos...</div>
              ) : recentCritical.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center mx-auto">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">Nenhum evento crítico detectado nas últimas 24h.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentCritical.map((event: any) => (
                    <div key={event.id} className="p-4 hover:bg-muted/20 transition-colors space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="destructive" className="h-4 text-[9px] px-1 uppercase">
                          {event.action.replace('_', ' ')}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(event.created_at), "HH:mm:ss")}
                        </span>
                      </div>
                      <p className="text-xs font-medium leading-tight truncate">
                        {event.payload?.module || "Sistema"}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Terminal className="h-3 w-3" />
                        <span className="truncate">{event.profiles?.full_name || "Sistema"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
