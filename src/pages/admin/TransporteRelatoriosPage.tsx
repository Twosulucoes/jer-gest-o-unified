import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Download, Truck, Loader2, AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function TransporteRelatoriosPage() {
  const eventId = useActiveEventId();
  const { hasRole } = useAuth();
  const canExport = hasRole("admin") || hasRole("secretaria") || hasRole("transporte");
  const [dateFilter, setDateFilter] = useState("");
  const [routeFilter, setRouteFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");

  const { data: routes = [] } = useQuery({
    queryKey: ["transport-routes", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from("transport_routes").select("id, name").eq("event_id", eventId!).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["transport-vehicles", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from("transport_vehicles").select("id, label, plate").eq("event_id", eventId!).eq("is_active", true).order("label");
      if (error) throw error;
      return data;
    },
  });

  const { data: trips, isLoading, isError } = useQuery({
    queryKey: ["transport-report", eventId, dateFilter, routeFilter, vehicleFilter],
    enabled: !!eventId,
    queryFn: async () => {
      let q = supabase
        .from("transport_trips")
        .select("*, transport_routes(name, origin, destination), transport_vehicles(label, plate), transport_passengers(id, participant_id, status, boarded_at, participants(person:people(full_name), delegations(institutions(name))))")
        .eq("event_id", eventId!)
        .order("scheduled_at", { ascending: false });

      if (dateFilter) {
        q = q.gte("scheduled_at", `${dateFilter}T00:00:00`).lte("scheduled_at", `${dateFilter}T23:59:59`);
      }
      if (routeFilter !== "all") q = q.eq("route_id", routeFilter);
      if (vehicleFilter !== "all") q = q.eq("vehicle_id", vehicleFilter);

      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const exportCsv = () => {
    if (!trips?.length) return;
    const rows: string[] = ["Data/Hora,Rota,Origem,Destino,Veículo,Placa,Motorista,Status,Total Embarcados,Passageiro,Delegação,Embarcou em"];
    for (const t of trips) {
      const passengers = t.transport_passengers || [];
      const base = [
        t.scheduled_at ? format(new Date(t.scheduled_at), "dd/MM/yyyy HH:mm") : "",
        t.transport_routes?.name || "",
        t.transport_routes?.origin || "",
        t.transport_routes?.destination || "",
        t.transport_vehicles?.label || "",
        t.transport_vehicles?.plate || "",
        t.driver_name || "",
        t.status,
        passengers.filter((p: any) => p.status === "boarded").length,
      ];
      if (passengers.length === 0) {
        rows.push(base.concat(["", "", ""]).join(","));
      } else {
        for (const p of passengers) {
          rows.push(base.concat([
            `"${p.participants?.person?.full_name || ""}"`,
            `"${p.participants?.delegations?.institutions?.name || ""}"`,
            p.boarded_at ? format(new Date(p.boarded_at), "dd/MM/yyyy HH:mm") : "",
          ]).join(","));
        }
      }
    }
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_transporte_${dateFilter || "todos"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso");
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Relatório de Transporte</h1>
          <p className="text-sm text-muted-foreground mt-1">Viagens, embarques e passageiros</p>
        </div>
        {canExport && (
          <Button onClick={exportCsv} disabled={!trips?.length}>
            <Download className="mr-2 h-4 w-4" />Exportar CSV
          </Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Filtros</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="w-44">
            <label className="text-xs font-medium mb-1 block">Data</label>
            <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          </div>
          <div className="w-52">
            <label className="text-xs font-medium mb-1 block">Rota</label>
            <Select value={routeFilter} onValueChange={setRouteFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-52">
            <label className="text-xs font-medium mb-1 block">Veículo</label>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.label} ({v.plate})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : isError ? (
        <div className="flex flex-col items-center py-16 text-center border border-dashed rounded-lg bg-muted/30">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <p className="text-muted-foreground font-medium">Erro ao carregar dados de transporte</p>
        </div>
      ) : !trips?.length ? (
        <div className="flex flex-col items-center py-16 text-center border border-dashed rounded-lg bg-muted/30">
          <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma viagem encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou cadastre viagens</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Rota</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead className="text-center">Embarcados</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((t) => {
                const boarded = (t.transport_passengers || []).filter((p: any) => p.status === "boarded").length;
                return (
                  <TableRow key={t.id}>
                    <TableCell>{t.scheduled_at ? format(new Date(t.scheduled_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                    <TableCell className="font-medium">{t.transport_routes?.name || "—"}</TableCell>
                    <TableCell>{t.transport_vehicles?.label || "—"}</TableCell>
                    <TableCell>{t.driver_name || "—"}</TableCell>
                    <TableCell className="text-center font-semibold">{boarded}</TableCell>
                    <TableCell>{t.status}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
