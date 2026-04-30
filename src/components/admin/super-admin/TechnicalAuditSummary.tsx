import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2, Database, Activity } from "lucide-react";
import { useDashboardData } from "@/pages/admin/relatorios/useDashboardData";

export function TechnicalAuditSummary() {
  const eventId = useActiveEventId();
  const { data: dashboard, isLoading: loadingDash } = useDashboardData(eventId);

  const { data: audit, isLoading: loadingAudit } = useQuery({
    queryKey: ["kpi-audit-summary", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      // Direct counts to compare with dashboard cache
      const results = await Promise.all([
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("event_id", eventId),
        supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("event_id", eventId),
        supabase.from("participant_credentials").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "active"),
        supabase.from("db_operation_logs").select("id", { count: "exact", head: true }),
      ]);

      return {
        participants_total: results[0].count || 0,
        matches_total: results[1].count || 0,
        credentials_active: results[2].count || 0,
      };
    }
  });

  const isLoading = loadingDash || loadingAudit;

  const metrics = [
    { label: "Participantes", dash: dashboard?.resumo.participants_total, audit: audit?.participants_total },
    { label: "Partidas", dash: dashboard?.resumo.matches_total, audit: audit?.matches_total },
    { label: "Credenciais", dash: dashboard?.resumo.credentials_active, audit: audit?.credentials_active },
    { label: "Logs de Operação", dash: null, audit: audit?.db_logs_count },
  ];

  return (
    <Card>
      <CardHeader className="py-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Integridade de Dados (Cache vs Realtime)
            </CardTitle>
            <CardDescription className="text-[10px]">
              Verificação cruzada de KPIs para detectar delay de sincronia.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-[9px] h-5 px-1.5">
            Auto-refresh: 30s
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-t">
              <TableHead className="h-8 text-[10px] font-bold px-4">KPI</TableHead>
              <TableHead className="h-8 text-[10px] font-bold text-center">Dashboard</TableHead>
              <TableHead className="h-8 text-[10px] font-bold text-center">Banco</TableHead>
              <TableHead className="h-8 text-[10px] font-bold text-right px-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : (
              metrics.map((m) => {
                const isOk = m.dash === null || m.dash === m.audit;
                return (
                  <TableRow key={m.label} className="group transition-colors">
                    <TableCell className="py-2 px-4 text-xs font-medium">{m.label}</TableCell>
                    <TableCell className="py-2 text-center text-xs font-mono">{m.dash || 0}</TableCell>
                    <TableCell className="py-2 text-center text-xs font-mono">{m.audit || 0}</TableCell>
                    <TableCell className="py-2 text-right px-4">
                      {isOk ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-auto" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive ml-auto animate-pulse" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
