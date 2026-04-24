import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2, ShieldCheck, Database } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useDashboardData } from "./relatorios/useDashboardData";

export default function SistemaDiagnosticoKpiPage() {
  const eventId = useActiveEventId();
  const { data: dashboard, isLoading: loadingDash } = useDashboardData(eventId);

  const { data: audit, isLoading: loadingAudit } = useQuery({
    queryKey: ["kpi-audit", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const results = await Promise.all([
        // Participantes
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("event_id", eventId),
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("event_id", eventId).not("credentialed_at", "is", null),
        
        // Credenciais
        supabase.from("participant_credentials").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "active"),
        
        // Partidas
        supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("event_id", eventId),
        supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("event_id", eventId).in("status", ["completed", "finished"]),
        
        // Alimentação
        supabase.rpc("get_event_meal_consumption_count", { p_event_id: eventId }),
        
        // Alojamento
        supabase.from("lodging_occupancies").select("id", { count: "exact", head: true }).eq("event_id", eventId).in("status", ["allocated", "checked_in"]),
        supabase.from("lodging_units").select("capacity").eq("event_id", eventId).eq("is_active", true),

        // Transporte
        supabase.from("transport_trips").select("id", { count: "exact", head: true }).eq("event_id", eventId),
        supabase.from("transport_passengers").select("id", { count: "exact", head: true }).eq("status", "boarded").filter("trip_id", "in", 
          supabase.from("transport_trips").select("id").eq("event_id", eventId)
        )
      ]);

      // Fallback manual para o RPC de alimentação se falhar ou se quisermos contagem via query normal
      const mealCountQuery = await supabase
        .from("meal_consumptions")
        .select("id", { count: "exact", head: true })
        .filter("meal_window_id", "in", `(${ (await supabase.from("meal_windows").select("id").eq("event_id", eventId)).data?.map(w => w.id).join(",") || "" })`);

      return {
        participants_total: results[0].count || 0,
        credentialed: results[1].count || 0,
        credentials_active: results[2].count || 0,
        matches_total: results[3].count || 0,
        matches_done: results[4].count || 0,
        meals_total: mealCountQuery.count || 0,
        lodging_occupied: results[6].count || 0,
        lodging_capacity: (results[7].data as any[])?.reduce((acc, u) => acc + (u.capacity || 0), 0) || 0,
        transport_trips: results[8].count || 0,
      };
    }
  });

  const isLoading = loadingDash || loadingAudit;

  const kpis = [
    { label: "Total de Participantes", dash: dashboard?.resumo.participants_total, audit: audit?.participants_total },
    { label: "Participantes Credenciados", dash: dashboard?.resumo.credentialed, audit: audit?.credentialed },
    { label: "Credenciais Ativas", dash: dashboard?.resumo.credentials_active, audit: audit?.credentials_active },
    { label: "Total de Partidas", dash: dashboard?.resumo.matches_total, audit: audit?.matches_total },
    { label: "Partidas Finalizadas", dash: dashboard?.resumo.matches_done, audit: audit?.matches_done },
    { label: "Total de Refeições (Consumos)", dash: dashboard?.resumo.meals_total, audit: audit?.meals_total },
    { label: "Ocupação Alojamento", dash: dashboard?.resumo.lodging_occupied, audit: audit?.lodging_occupied },
    { label: "Capacidade Alojamento", dash: dashboard?.resumo.lodging_capacity, audit: audit?.lodging_capacity },
    { label: "Total de Viagens", dash: dashboard?.resumo.transport_trips, audit: audit?.transport_trips },
  ];

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Auditoria de KPIs
          </h1>
          <p className="text-muted-foreground">Comparação entre os dados processados pelo Dashboard vs. Contagem Direta no Banco.</p>
        </div>
        <Badge variant="outline" className="flex gap-1">
          <Database className="h-3 w-3" /> Evento: {eventId}
        </Badge>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Sobre esta Auditoria</AlertTitle>
        <AlertDescription>
          O Dashboard utiliza hooks complexos com caches e processamento em memória para performance. 
          Esta tela executa <code className="bg-muted px-1 rounded">SELECT COUNT(*)</code> diretos para validar se o resumo está íntegro.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Conferência de Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica (KPI)</TableHead>
                <TableHead className="text-center">Dashboard (Cache)</TableHead>
                <TableHead className="text-center">Banco (Realtime)</TableHead>
                <TableHead className="text-center">Diferença</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-2 block">Cruzando dados...</span>
                  </TableCell>
                </TableRow>
              ) : (
                kpis.map((kpi) => {
                  const diff = (kpi.dash || 0) - (kpi.audit || 0);
                  const isOk = diff === 0;
                  return (
                    <TableRow key={kpi.label}>
                      <TableCell className="font-medium">{kpi.label}</TableCell>
                      <TableCell className="text-center font-mono">{kpi.dash}</TableCell>
                      <TableCell className="text-center font-mono">{kpi.audit}</TableCell>
                      <TableCell className={`text-center font-mono ${!isOk ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </TableCell>
                      <TableCell className="text-right">
                        {isOk ? (
                          <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Íntegro
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" /> Divergente
                          </Badge>
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
    </div>
  );
}
