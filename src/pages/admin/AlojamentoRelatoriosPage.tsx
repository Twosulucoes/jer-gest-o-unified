import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Download, Building2, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function AlojamentoRelatoriosPage() {
  const eventId = useActiveEventId();
  const { hasRole } = useAuth();
  const canExport = hasRole("admin") || hasRole("secretaria") || hasRole("alojamento");
  const [locationFilter, setLocationFilter] = useState("all");
  const [delegationFilter, setDelegationFilter] = useState("all");

  const { data: locations = [] } = useQuery({
    queryKey: ["lodging-locations", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from("lodging_locations").select("id, name").eq("event_id", eventId!).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: delegations = [] } = useQuery({
    queryKey: ["delegations-list", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from("delegations").select("id, institutions(name)").eq("event_id", eventId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ["lodging-units-report", eventId, locationFilter],
    enabled: !!eventId,
    queryFn: async () => {
      let q = supabase.from("lodging_units").select("id, name, capacity, location_id, lodging_locations(name)").eq("event_id", eventId!);
      if (locationFilter !== "all") q = q.eq("location_id", locationFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: occupancies, isLoading, isError } = useQuery({
    queryKey: ["lodging-report", eventId, locationFilter, delegationFilter],
    enabled: !!eventId,
    queryFn: async () => {
      let q = supabase
        .from("lodging_occupancies")
        .select("*, lodging_units(name, capacity, location_id, lodging_locations(name)), participants(person:people(full_name), delegation_id, delegations(institutions(name)))")
        .eq("event_id", eventId!)
        .order("checked_in_at", { ascending: false });

      if (locationFilter !== "all") q = q.eq("lodging_units.location_id", locationFilter);

      const { data, error } = await q;
      if (error) throw error;

      let filtered = data as any[];
      if (delegationFilter !== "all") {
        filtered = filtered.filter((o) => o.participants?.delegation_id === delegationFilter);
      }
      return filtered;
    },
  });

  // Chart data: capacity vs occupied per location
  const chartData = locations.map((loc) => {
    const locUnits = units.filter((u) => u.location_id === loc.id);
    const totalCapacity = locUnits.reduce((s, u) => s + (u.capacity || 0), 0);
    const occupied = (occupancies || []).filter((o: any) => o.lodging_units?.location_id === loc.id && o.status !== "checked_out").length;
    return { name: loc.name, capacidade: totalCapacity, ocupado: occupied };
  });

  const statusLabel = (s: string) => {
    const m: Record<string, string> = { allocated: "Alocado", checked_in: "Check-in", checked_out: "Check-out" };
    return m[s] || s;
  };

  const exportCsv = () => {
    if (!occupancies?.length) return;
    const rows = ["Participante,Delegação,Local,Unidade,Status,Check-in,Check-out"];
    for (const o of occupancies) {
      rows.push([
        `"${o.participants?.person?.full_name || ""}"`,
        `"${o.participants?.delegations?.institutions?.name || ""}"`,
        `"${o.lodging_units?.lodging_locations?.name || ""}"`,
        `"${o.lodging_units?.name || ""}"`,
        statusLabel(o.status),
        o.checked_in_at ? format(new Date(o.checked_in_at), "dd/MM/yyyy HH:mm") : "",
        o.checked_out_at ? format(new Date(o.checked_out_at), "dd/MM/yyyy HH:mm") : "",
      ].join(","));
    }
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio_alojamento.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso");
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Relatório de Alojamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Ocupação atual e histórico por local e delegação</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          {canExport && (
            <Button size="sm" onClick={exportCsv} disabled={!occupancies?.length}>
              <Download className="mr-2 h-4 w-4" />Exportar CSV
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Filtros</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="w-52">
            <label className="text-xs font-medium mb-1 block">Local</label>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
        </CardContent>
      </Card>

      {/* Occupancy chart */}
      {chartData.length > 0 && chartData.some((d) => d.capacidade > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Ocupação por Local</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="capacidade" fill="hsl(var(--muted-foreground))" name="Capacidade" />
                <Bar dataKey="ocupado" fill="hsl(var(--primary))" name="Ocupado" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : isError ? (
        <div className="flex flex-col items-center py-16 text-center border border-dashed rounded-lg bg-muted/30">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <p className="text-muted-foreground font-medium">Erro ao carregar dados de alojamento</p>
        </div>
      ) : !occupancies?.length ? (
        <div className="flex flex-col items-center py-16 text-center border border-dashed rounded-lg bg-muted/30">
          <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma ocupação encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou registre ocupações</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participante</TableHead>
                <TableHead>Delegação</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {occupancies.slice(0, 200).map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.participants?.person?.full_name || "—"}</TableCell>
                  <TableCell>{o.participants?.delegations?.institutions?.name || "—"}</TableCell>
                  <TableCell>{o.lodging_units?.lodging_locations?.name || "—"}</TableCell>
                  <TableCell>{o.lodging_units?.name || "—"}</TableCell>
                  <TableCell><Badge variant={o.status === "checked_in" ? "default" : o.status === "checked_out" ? "secondary" : "outline"}>{statusLabel(o.status)}</Badge></TableCell>
                  <TableCell>{o.checked_in_at ? format(new Date(o.checked_in_at), "dd/MM HH:mm") : "—"}</TableCell>
                  <TableCell>{o.checked_out_at ? format(new Date(o.checked_out_at), "dd/MM HH:mm") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {occupancies.length > 200 && (
            <p className="text-xs text-muted-foreground text-center py-2">Mostrando 200 de {occupancies.length}. Exporte CSV para ver todos.</p>
          )}
        </div>
      )}
    </div>
  );
}
