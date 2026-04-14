import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, Utensils, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

export default function AlimentacaoDashboardPage() {
  const eventId = useActiveEventId();
  const [filterDate, setFilterDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [filterDelegation, setFilterDelegation] = useState("all");
  const [filterMealType, setFilterMealType] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setRefreshKey((k) => k + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Meal types
  const { data: mealTypes = [] } = useQuery({
    queryKey: ["meal-types-dash", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_types")
        .select("id, name, slug")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // Meal windows for the selected date
  const { data: mealWindows = [] } = useQuery({
    queryKey: ["meal-windows-dash", eventId, filterDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_windows")
        .select("id, label, meal_type_id, start_time, end_time, service_date")
        .eq("event_id", eventId)
        .eq("service_date", filterDate)
        .eq("is_active", true)
        .order("start_time");
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // Consumptions for the date
  const { data: consumptions = [], isLoading, isError } = useQuery({
    queryKey: ["meal-consumptions-dash", eventId, filterDate, refreshKey],
    queryFn: async () => {
      const windowIds = mealWindows.map((w) => w.id);
      if (!windowIds.length) return [];
      const { data, error } = await supabase
        .from("meal_consumptions")
        .select("id, meal_window_id, participant_id, consumed_at, method")
        .in("meal_window_id", windowIds);
      if (error) throw error;
      return data;
    },
    enabled: mealWindows.length > 0,
  });

  // Participants with delegations
  const participantIds = useMemo(() => [...new Set(consumptions.map((c) => c.participant_id))], [consumptions]);
  const { data: participants = [] } = useQuery({
    queryKey: ["participants-dash", eventId, participantIds.length],
    queryFn: async () => {
      if (!participantIds.length) return [];
      const { data, error } = await supabase
        .from("participants")
        .select("id, delegation_id")
        .in("id", participantIds);
      if (error) throw error;
      return data;
    },
    enabled: participantIds.length > 0,
  });

  const participantDelegationMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p.delegation_id])),
    [participants]
  );

  // Delegations
  const { data: delegations = [] } = useQuery({
    queryKey: ["delegations-dash", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegations")
        .select("id, institutions(name)")
        .eq("event_id", eventId);
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const delegationNameMap = useMemo(
    () => new Map(delegations.map((d: any) => [d.id, (d.institutions as any)?.name ?? "—"])),
    [delegations]
  );

  // Total participants in event
  const { data: totalParticipants = 0 } = useQuery({
    queryKey: ["total-participants-dash", eventId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!eventId,
  });

  // Filtered consumptions
  const filteredConsumptions = useMemo(() => {
    let result = consumptions;
    if (filterMealType !== "all") {
      const windowIdsForType = mealWindows
        .filter((w) => w.meal_type_id === filterMealType)
        .map((w) => w.id);
      result = result.filter((c) => windowIdsForType.includes(c.meal_window_id));
    }
    if (filterDelegation !== "all") {
      result = result.filter((c) => participantDelegationMap.get(c.participant_id) === filterDelegation);
    }
    return result;
  }, [consumptions, filterMealType, filterDelegation, mealWindows, participantDelegationMap]);

  // Stats per meal window
  const windowStats = useMemo(() => {
    const mealTypeMap = new Map(mealTypes.map((t) => [t.id, t.name]));
    return mealWindows.map((w) => {
      const count = filteredConsumptions.filter((c) => c.meal_window_id === w.id).length;
      return {
        name: mealTypeMap.get(w.meal_type_id) ?? w.label,
        label: w.label,
        count,
        start: w.start_time?.slice(0, 5) ?? "",
      };
    });
  }, [mealWindows, filteredConsumptions, mealTypes]);

  // Hourly chart data
  const hourlyData = useMemo(() => {
    const hours: Record<string, number> = {};
    for (let h = 5; h <= 22; h++) {
      hours[`${h.toString().padStart(2, "0")}h`] = 0;
    }
    filteredConsumptions.forEach((c) => {
      if (c.consumed_at) {
        const hour = new Date(c.consumed_at).getHours();
        const key = `${hour.toString().padStart(2, "0")}h`;
        if (hours[key] !== undefined) hours[key]++;
      }
    });
    return Object.entries(hours).map(([hour, count]) => ({ hour, count }));
  }, [filteredConsumptions]);

  // Top delegations by consumption
  const topDelegations = useMemo(() => {
    const delegCounts: Record<string, number> = {};
    filteredConsumptions.forEach((c) => {
      const delegId = participantDelegationMap.get(c.participant_id);
      if (delegId) delegCounts[delegId] = (delegCounts[delegId] ?? 0) + 1;
    });
    return Object.entries(delegCounts)
      .map(([id, count]) => ({ id, name: delegationNameMap.get(id) ?? "—", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredConsumptions, participantDelegationMap, delegationNameMap]);

  // Participants with zero consumptions today
  const zeroConsumptionCount = totalParticipants - participantIds.length;

  // Export CSV
  const exportCSV = useCallback(() => {
    const mealTypeMap = new Map(mealTypes.map((t) => [t.id, t.name]));
    const windowMap = new Map(mealWindows.map((w) => [w.id, { label: w.label, type: mealTypeMap.get(w.meal_type_id) ?? "" }]));
    const rows = ["Participant ID,Delegação,Refeição,Janela,Consumido em,Método"];
    filteredConsumptions.forEach((c) => {
      const delegName = delegationNameMap.get(participantDelegationMap.get(c.participant_id) ?? "") ?? "";
      const win = windowMap.get(c.meal_window_id);
      rows.push([
        c.participant_id,
        `"${delegName}"`,
        win?.type ?? "",
        win?.label ?? "",
        c.consumed_at ?? "",
        c.method ?? "",
      ].join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consumo-alimentacao-${filterDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredConsumptions, mealTypes, mealWindows, delegationNameMap, participantDelegationMap, filterDate]);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Dashboard de Alimentação</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada do consumo de refeições em tempo real</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-medium mb-1 block">Data</label>
          <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">Delegação</label>
          <Select value={filterDelegation} onValueChange={setFilterDelegation}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {delegations.map((d: any) => (
                <SelectItem key={d.id} value={d.id}>{(d.institutions as any)?.name ?? "—"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">Tipo de refeição</label>
          <Select value={filterMealType} onValueChange={setFilterMealType}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {mealTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredConsumptions.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : isError ? (
        <Card><CardContent className="py-8 text-center text-destructive">Erro ao carregar dados de consumo.</CardContent></Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <Utensils className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-3xl font-bold">{filteredConsumptions.length}</p>
                <p className="text-xs text-muted-foreground">Consumos registrados</p>
              </CardContent>
            </Card>
            {windowStats.map((ws) => (
              <Card key={ws.label}>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{ws.name} ({ws.start})</p>
                  <p className="text-2xl font-bold">{ws.count}</p>
                  <p className="text-xs text-muted-foreground">{ws.label}</p>
                </CardContent>
              </Card>
            ))}
            {zeroConsumptionCount > 0 && (
              <Card className="border-yellow-300 dark:border-yellow-700">
                <CardContent className="pt-4 text-center">
                  <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-destructive" />
                  <p className="text-2xl font-bold text-destructive">{zeroConsumptionCount}</p>
                  <p className="text-xs text-muted-foreground">Sem refeição hoje</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Hourly chart */}
          <Card>
            <CardHeader><CardTitle className="text-base">Consumo ao longo do dia</CardTitle></CardHeader>
            <CardContent>
              {filteredConsumptions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum consumo registrado para os filtros selecionados.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Consumos" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top delegations */}
          <Card>
            <CardHeader><CardTitle className="text-base">Delegações com maior consumo</CardTitle></CardHeader>
            <CardContent>
              {topDelegations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado.</p>
              ) : (
                <div className="space-y-2">
                  {topDelegations.map((d, i) => (
                    <div key={d.id} className="flex items-center justify-between border-b pb-1 last:border-b-0">
                      <span className="text-sm">{i + 1}. {d.name}</span>
                      <Badge variant="secondary">{d.count} consumos</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
