import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";
import { useAuth } from "@/hooks/useAuth";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Download, Calculator, FileDown, AlertTriangle, 
  Users, Utensils, Calendar, MapPin, History, Clock
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface EligibilityTotals {
  profiles: any[];
  delegations: any[];
  institutions: any[];
  total: number;
}

export default function AlimentacaoPrevisaoPage() {
  const qc = useQueryClient();
  const eventId = useActiveEventId();
  const { user } = useAuth();
  const { isStageScoped, stageId, stage } = useStageScope();
  const [filterDate, setFilterDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [filterMealType, setFilterMealType] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [isExporting, setIsExporting] = useState(false);

  // 1. Fetch Meal Types
  const { data: mealTypes = [] } = useQuery({
    queryKey: ["meal_types", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_types")
        .select("*")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // 2. Fetch Meal Locations
  const { data: mealLocations = [] } = useQuery({
    queryKey: ["meal_locations", eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("meal_locations")
        .select("*")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // 3. Fetch Meal Windows with Eligibility and Location
  const { data: windows = [], isLoading: loadingWindows } = useQuery({
    queryKey: ["meal_windows_forecast", eventId, stageId, filterDate],
    queryFn: async () => {
      let q = (supabase as any)
        .from("meal_windows")
        .select(`
          *,
          meal_locations(name, capacity),
          meal_types(name),
          meal_window_eligibility(*)
        `)
        .eq("event_id", eventId)
        .eq("service_date", filterDate)
        .eq("is_active", true);
      
      if (isStageScoped && stageId) q = q.eq("event_stage_id", stageId);
      
      const { data, error } = await q.order("start_time");
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // 4. Fetch Real-time Consumption Counts for these windows
  const { data: consumptionCounts = {} } = useQuery({
    queryKey: ["meal_consumption_counts", windows.map(w => w.id)],
    queryFn: async () => {
      const windowIds = windows.map(w => w.id);
      if (!windowIds.length) return {};
      
      const { data, error } = await supabase
        .from("meal_consumptions")
        .select("meal_window_id")
        .in("meal_window_id", windowIds);
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach(c => {
        counts[c.meal_window_id] = (counts[c.meal_window_id] || 0) + 1;
      });
      return counts;
    },
    enabled: windows.length > 0,
    refetchInterval: 30000,
  });

  // 5. Eligibility Totals Query
  const { data: eligibilityTotals } = useQuery<EligibilityTotals>({
    queryKey: ["meal_eligibility_forecast", eventId, stageId],
    queryFn: async () => {
      const [profileRes, delegationRes, institutionRes] = await Promise.all([
        supabase.rpc("get_participant_counts_by_profile" as any, { p_event_id: eventId, p_stage_id: stageId }),
        supabase.rpc("get_participant_counts_by_delegation" as any, { p_event_id: eventId, p_stage_id: stageId }),
        supabase.rpc("get_participant_counts_by_institution" as any, { p_event_id: eventId, p_stage_id: stageId }),
      ]);

      const profiles = (profileRes.data as any[]) || [];
      const delegations = (delegationRes.data as any[]) || [];
      const institutions = (institutionRes.data as any[]) || [];
      
      return {
        profiles,
        delegations,
        institutions,
        total: profiles.reduce((acc, curr) => acc + Number(curr.count || 0), 0)
      };
    },
    enabled: !!eventId,
    initialData: { profiles: [], delegations: [], institutions: [], total: 0 }
  });

  const calculateForecast = (window: any) => {
    if (!window.meal_window_eligibility || window.meal_window_eligibility.length === 0) {
      return eligibilityTotals.total;
    }

    let forecast = 0;
    const rules = window.meal_window_eligibility;
    
    rules.forEach((rule: any) => {
      if (rule.eligibility_type === "participant_type") {
        const found = eligibilityTotals.profiles.find((p: any) => p.type === rule.participant_type_value);
        forecast += Number(found?.count || 0);
      } else if (rule.eligibility_type === "delegation") {
        const found = eligibilityTotals.delegations.find((d: any) => d.id === rule.reference_id);
        forecast += Number(found?.count || 0);
      } else if (rule.eligibility_type === "institution") {
        const found = eligibilityTotals.institutions.find((i: any) => i.id === rule.reference_id);
        forecast += Number(found?.count || 0);
      }
    });

    return forecast;
  };

  const filteredWindows = useMemo(() => {
    return windows.filter(w => {
      const matchesType = filterMealType === "all" || w.meal_type_id === filterMealType;
      const matchesLoc = filterLocation === "all" || w.meal_window_location_id === filterLocation;
      return matchesType && matchesLoc;
    });
  }, [windows, filterMealType, filterLocation]);

  const auditExportMut = useMutation({
    mutationFn: async (vars: { format: string, filters: any }) => {
      const { error } = await (supabase as any).from("meal_forecast_exports").insert({
        event_id: eventId,
        event_stage_id: stageId,
        generated_by: user?.id,
        service_date: filterDate,
        export_format: vars.format,
        filters: vars.filters
      });
      if (error) throw error;
    }
  });

  const { data: recentExports = [] } = useQuery({
    queryKey: ["recent_meal_exports", eventId, stageId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("meal_forecast_exports")
        .select("*, profiles:generated_by(display_name)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!eventId
  });

  const handleExportXlsx = async () => {
    if (!filteredWindows.length) return;
    setIsExporting(true);
    try {
      const data = filteredWindows.map(w => {
        const forecast = calculateForecast(w);
        const consumed = consumptionCounts[w.id] || 0;
        return {
          "Data": format(new Date(w.service_date + "T00:00:00"), "dd/MM/yyyy"),
          "Tipo": w.meal_types?.name || "—",
          "Rótulo": w.label || "—",
          "Local": w.meal_locations?.name || "—",
          "Horário": `${w.start_time.slice(0, 5)} - ${w.end_time.slice(0, 5)}`,
          "Previsão": forecast,
          "Realizado": consumed,
          "Saldo": Math.max(0, forecast - consumed)
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Previsão Cozinha");
      XLSX.writeFile(wb, `previsao_cozinha_${filterDate}.xlsx`);
      
      auditExportMut.mutate({ format: "xlsx", filters: { date: filterDate, mealType: filterMealType, location: filterLocation } });
      toast.success("Exportação XLSX gerada com sucesso");
    } catch (e) {
      toast.error("Falha ao exportar");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!filteredWindows.length) return;
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setFontSize(18);
      doc.text("Previsão de Demanda - Cozinha", pageWidth / 2, 20, { align: "center" });
      doc.setFontSize(10);
      doc.text(`Evento: ${eventId} | Etapa: ${stage?.name || "Geral"}`, pageWidth / 2, 28, { align: "center" });
      doc.text(`Data de Serviço: ${format(new Date(filterDate + "T00:00:00"), "dd/MM/yyyy")}`, pageWidth / 2, 34, { align: "center" });
      
      const body = filteredWindows.map(w => {
        const forecast = calculateForecast(w);
        const consumed = consumptionCounts[w.id] || 0;
        return [
          w.meal_types?.name || "—",
          w.label || "—",
          w.meal_locations?.name || "—",
          `${w.start_time.slice(0, 5)}-${w.end_time.slice(0, 5)}`,
          forecast.toString(),
          consumed.toString(),
          Math.max(0, forecast - consumed).toString()
        ];
      });

      autoTable(doc, {
        startY: 40,
        head: [["Tipo", "Rótulo", "Local", "Horário", "Prev.", "Real.", "Saldo"]],
        body: body,
        theme: "striped",
        headStyles: { fillColor: [41, 128, 185] }
      });

      doc.save(`previsao_cozinha_${filterDate}.pdf`);
      auditExportMut.mutate({ format: "pdf", filters: { date: filterDate, mealType: filterMealType, location: filterLocation } });
      toast.success("Exportação PDF gerada com sucesso");
    } catch (e) {
      toast.error("Falha ao exportar");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Previsão de Demanda</h1>
          <p className="text-sm text-muted-foreground mt-1">Planejamento e ocupação por janela de serviço</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPdf} disabled={isExporting || !filteredWindows.length}>
            <FileDown className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" onClick={handleExportXlsx} disabled={isExporting || !filteredWindows.length}>
            <Download className="mr-2 h-4 w-4" /> XLSX
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium">Data de Serviço</label>
              <Input 
                type="date" 
                value={filterDate} 
                onChange={(e) => setFilterDate(e.target.value)} 
                className="w-[180px]" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Tipo de Refeição</label>
              <Select value={filterMealType} onValueChange={setFilterMealType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Tipos</SelectItem>
                  {mealTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Local</label>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Locais</SelectItem>
                  {mealLocations.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["meal_windows_forecast"] })}>
              <Calculator className="h-4 w-4 mr-2" /> Recalcular
            </Button>
          </div>
        </CardContent>
      </Card>

      {loadingWindows ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[200px] w-full" />)}
        </div>
      ) : filteredWindows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground font-medium">Nenhuma janela de serviço encontrada</p>
            <p className="text-sm text-muted-foreground max-w-xs">Não existem janelas ativas para os filtros selecionados nesta data.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {filteredWindows.map(w => {
              const forecast = calculateForecast(w);
              const consumed = consumptionCounts[w.id] || 0;
              const percent = forecast > 0 ? Math.min(100, (consumed / forecast) * 100) : 0;
              
              return (
                <Card key={w.id} className="overflow-hidden">
                  <div className={`h-1 w-full ${percent >= 90 ? 'bg-amber-500' : 'bg-primary'}`} />
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant="outline" className="mb-2">{w.meal_types?.name}</Badge>
                        <CardTitle className="text-lg">{w.label || w.meal_types?.name}</CardTitle>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {w.start_time.slice(0, 5)} - {w.end_time.slice(0, 5)}</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {w.meal_locations?.name || "—"}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{percent.toFixed(0)}%</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Ocupação</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progresso: {consumed} de {forecast} refeições</span>
                        {forecast > 0 && consumed > forecast && (
                          <span className="text-amber-600 flex items-center gap-1 font-medium">
                            <AlertTriangle className="h-3 w-3" /> Excedente: {consumed - forecast}
                          </span>
                        )}
                      </div>
                      <Progress value={percent} className="h-2" />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 pt-2">
                      <div className="bg-muted/50 p-2 rounded text-center">
                        <p className="text-xs text-muted-foreground mb-1">Previsão</p>
                        <p className="text-xl font-bold">{forecast}</p>
                      </div>
                      <div className="bg-primary/5 p-2 rounded text-center">
                        <p className="text-xs text-muted-foreground mb-1">Realizado</p>
                        <p className="text-xl font-bold text-primary">{consumed}</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded text-center">
                        <p className="text-xs text-muted-foreground mb-1">Saldo</p>
                        <p className="text-xl font-bold">{Math.max(0, forecast - consumed)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" /> Histórico de Exportações
                </CardTitle>
                <CardDescription>Últimas gerações para cozinha</CardDescription>
              </CardHeader>
              <CardContent>
                {recentExports.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center italic">Nenhuma exportação registrada</p>
                ) : (
                  <div className="space-y-3">
                    {recentExports.map((exp: any) => (
                      <div key={exp.id} className="text-xs border-b pb-2 last:border-0 last:pb-0">
                        <div className="flex justify-between font-medium">
                          <span className="uppercase">{exp.export_format}</span>
                          <span className="text-muted-foreground">{format(new Date(exp.created_at), "dd/MM HH:mm")}</span>
                        </div>
                        <p className="text-muted-foreground mt-1 truncate">Por: {exp.profiles?.display_name || "Sistema"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Utensils className="h-4 w-4 text-primary" /> Resumo do Dia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Previsto</p>
                  <p className="text-2xl font-bold">
                    {filteredWindows.reduce((acc, w) => acc + calculateForecast(w), 0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Realizado</p>
                  <p className="text-2xl font-bold text-primary">
                    {filteredWindows.reduce((acc, w) => acc + (consumptionCounts[w.id] || 0), 0)}
                  </p>
                </div>
                <div className="pt-2">
                  <Button variant="link" className="p-0 h-auto text-xs" onClick={() => toast.info("Funcionalidade em desenvolvimento")}>
                    Ver detalhamento por delegação
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}