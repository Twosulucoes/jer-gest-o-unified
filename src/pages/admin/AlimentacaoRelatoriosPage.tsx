import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Download, Utensils, AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function AlimentacaoRelatoriosPage() {
  const eventId = useActiveEventId();
  const { hasRole } = useAuth();
  const canExport = hasRole("admin") || hasRole("secretaria") || hasRole("alimentacao");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [delegationFilter, setDelegationFilter] = useState("all");
  const [mealTypeFilter, setMealTypeFilter] = useState("all");

  const { data: delegations = [] } = useQuery({
    queryKey: ["delegations-list", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegations")
        .select("id, school_name")
        .eq("event_id", eventId!)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: mealTypes = [] } = useQuery({
    queryKey: ["meal-types", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from("meal_types").select("id, name").eq("event_id", eventId!).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: consumptions, isLoading, isError } = useQuery({
    queryKey: ["food-report", eventId, startDate, endDate, delegationFilter, mealTypeFilter],
    enabled: !!eventId,
    queryFn: async () => {
      let q = supabase
        .from("meal_consumptions")
        .select("*, meal_windows(label, service_date, meal_type_id, meal_types(name)), participants(person:people(full_name), delegation_id, delegations(school_name))")
        .order("consumed_at", { ascending: false });

      // Filter by event through meal_windows
      q = q.not("meal_window_id", "is", null);

      if (startDate) q = q.gte("consumed_at", `${startDate}T00:00:00`);
      if (endDate) q = q.lte("consumed_at", `${endDate}T23:59:59`);
      if (delegationFilter !== "all") q = q.eq("participants.delegation_id", delegationFilter);

      const { data, error } = await q;
      if (error) throw error;

      let filtered = data as any[];
      if (mealTypeFilter !== "all") {
        filtered = filtered.filter((c) => c.meal_windows?.meal_type_id === mealTypeFilter);
      }
      return filtered;
    },
  });

  // Totals
  const totalByType = new Map<string, number>();
  const totalByDelegation = new Map<string, number>();
  (consumptions || []).forEach((c: any) => {
    const typeName = c.meal_windows?.meal_types?.name || "Outro";
    totalByType.set(typeName, (totalByType.get(typeName) || 0) + 1);
    const delName = c.participants?.delegations?.school_name || "Sem delegação";
    totalByDelegation.set(delName, (totalByDelegation.get(delName) || 0) + 1);
  });

  const exportCsv = () => {
    if (!consumptions?.length) return;
    const rows = ["Participante,Delegação,Refeição,Data/Hora,Método"];
    for (const c of consumptions) {
      rows.push([
        `"${c.participants?.person?.full_name || ""}"`,
        `"${c.participants?.delegations?.institutions?.name || ""}"`,
        `"${c.meal_windows?.label || ""}"`,
        c.consumed_at ? format(new Date(c.consumed_at), "dd/MM/yyyy HH:mm") : "",
        c.method || "scan",
      ].join(","));
    }
    // Add totals
    rows.push("");
    rows.push("TOTAIS POR TIPO");
    totalByType.forEach((v, k) => rows.push(`${k},${v}`));
    rows.push("");
    rows.push("TOTAIS POR DELEGAÇÃO");
    totalByDelegation.forEach((v, k) => rows.push(`"${k}",${v}`));

    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_alimentacao_${startDate || "todos"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso");
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Relatório de Alimentação</h1>
          <p className="text-sm text-muted-foreground mt-1">Consumos por refeição, delegação e período</p>
        </div>
        {canExport && (
          <Button onClick={exportCsv} disabled={!consumptions?.length}>
            <Download className="mr-2 h-4 w-4" />Exportar CSV
          </Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Filtros</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="w-40">
            <label className="text-xs font-medium mb-1 block">Data início</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="w-40">
            <label className="text-xs font-medium mb-1 block">Data fim</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="w-52">
            <label className="text-xs font-medium mb-1 block">Delegação</label>
            <Select value={delegationFilter} onValueChange={setDelegationFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {delegations.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.institutions?.name || d.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-52">
            <label className="text-xs font-medium mb-1 block">Tipo de refeição</label>
            <Select value={mealTypeFilter} onValueChange={setMealTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {mealTypes.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      {consumptions && consumptions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{consumptions.length}</p>
              <p className="text-xs text-muted-foreground">Total consumos</p>
            </CardContent>
          </Card>
          {Array.from(totalByType.entries()).slice(0, 3).map(([k, v]) => (
            <Card key={k}>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{v}</p>
                <p className="text-xs text-muted-foreground">{k}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : isError ? (
        <div className="flex flex-col items-center py-16 text-center border border-dashed rounded-lg bg-muted/30">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <p className="text-muted-foreground font-medium">Erro ao carregar dados de alimentação</p>
        </div>
      ) : !consumptions?.length ? (
        <div className="flex flex-col items-center py-16 text-center border border-dashed rounded-lg bg-muted/30">
          <Utensils className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum consumo encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou registre consumos</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participante</TableHead>
                <TableHead>Delegação</TableHead>
                <TableHead>Refeição</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Método</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumptions.slice(0, 200).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.participants?.person?.full_name || "—"}</TableCell>
                  <TableCell>{c.participants?.delegations?.institutions?.name || "—"}</TableCell>
                  <TableCell>{c.meal_windows?.label || "—"}</TableCell>
                  <TableCell>{c.consumed_at ? format(new Date(c.consumed_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                  <TableCell>{c.method || "scan"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {consumptions.length > 200 && (
            <p className="text-xs text-muted-foreground text-center py-2">Mostrando 200 de {consumptions.length}. Exporte CSV para ver todos.</p>
          )}
        </div>
      )}
    </div>
  );
}
