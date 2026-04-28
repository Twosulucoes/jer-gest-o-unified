import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStageScope } from "@/hooks/useStageScope";
import { format } from "date-fns";
import { 
  AlertTriangle, 
  ArrowLeft, 
  Download, 
  Search,
  Filter,
  Users,
  Utensils,
  Clock,
  UserX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type DivergenceType = "missing_consumption" | "incident_attempt" | "all";

export default function AlimentacaoDivergenciasPage() {
  const eventId = useActiveEventId();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { isStageScoped, stageId } = useStageScope();
  const [tab, setTab] = useState<DivergenceType>("all");
  const [filterDate, setFilterDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");

  // 1. Fetch Incidents (Rejected Attempts)
  const { data: incidents = [], isLoading: loadingIncidents } = useQuery({
    queryKey: ["meal-incidents", eventId, filterDate],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("meal_incidents")
        .select(`
          *,
          meal_windows!inner(id, label, service_date, meal_types(name)),
          participants(
            id,
            people(full_name),
            delegations(school_name)
          ),
          profiles:registered_by(full_name)
        `)
        .eq("meal_windows.event_id", eventId)
        .eq("meal_windows.service_date", filterDate);

      if (error) throw error;
      return data as any[];
    }
  });

  // 2. Fetch Missing Consumptions (Logic: Eligible but no consumption)
  // This is a complex query, we'll fetch windows, eligibility, and consumptions to calculate
  const { data: missingConsumptions = [], isLoading: loadingMissing } = useQuery({
    queryKey: ["meal-missing", eventId, filterDate, stageId],
    enabled: !!eventId,
    queryFn: async () => {
      // 2.1 Fetch active windows for the date
      let winQuery = (supabase as any)
        .from("meal_windows")
        .select(`
          id, label, 
          meal_types(name),
          meal_window_eligibility(*)
        `)
        .eq("event_id", eventId)
        .eq("service_date", filterDate)
        .eq("is_active", true);
      
      if (isStageScoped && stageId) winQuery = winQuery.eq("event_stage_id", stageId);
      
      const { data: windows, error: winError } = await winQuery;
      if (winError) throw winError;
      if (!windows?.length) return [];

      // 2.2 Fetch all consumptions for these windows
      const windowIds = windows.map(w => w.id);
      const { data: consumptions, error: consError } = await (supabase as any)
        .from("meal_consumptions")
        .select("participant_id, meal_window_id")
        .in("meal_window_id", windowIds);
      
      if (consError) throw consError;

      // 2.3 For each window, find eligible participants who didn't consume
      // We need participant list for the event/stage
      let partQuery = (supabase as any)
        .from("participants")
        .select(`
          id, 
          participant_type,
          delegation_id, 
          delegations(school_name, institution_id),
          people(full_name)
        `)
        .eq("event_id", eventId!);
      
      // Note: participants table might not have event_stage_id directly, 
      // but they are linked to the event. If a stage filter is needed, 
      // it would be via registrations if they exist. 
      // For now we use event level.
      
      const { data: participants, error: partError } = await partQuery;
      if (partError) throw partError;

      const missing: any[] = [];

      for (const win of windows) {
        const rules = win.meal_window_eligibility || [];
        const winConsumptions = new Set(consumptions?.filter(c => c.meal_window_id === win.id).map(c => c.participant_id));
        
        participants?.forEach(p => {
          // Check eligibility
          let isEligible = rules.length === 0; // If no rules, everyone is eligible
          if (rules.length > 0) {
            isEligible = rules.some((r: any) => {
              if (r.eligibility_type === 'participant_type') return p.participant_type === r.participant_type_value;
              if (r.eligibility_type === 'delegation') return p.delegation_id === r.reference_id;
              if (r.eligibility_type === 'institution') return p.delegations?.institution_id === r.reference_id;
              return false;
            });
          }

          if (isEligible && !winConsumptions.has(p.id)) {
            missing.push({
              id: `${win.id}-${p.id}`,
              participant: p,
              window: win,
              type: 'MISSING'
            });
          }
        });
      }

      return missing;
    }
  });

  const filteredIncidents = incidents.filter(i => 
    !search || 
    i.participants?.people?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.meal_windows?.label?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMissing = missingConsumptions.filter(m => 
    !search || 
    m.participant?.people?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.window?.label?.toLowerCase().includes(search.toLowerCase())
  );

  const exportXlsx = () => {
    const data: any[] = [];

    if (tab === 'all' || tab === 'incident_attempt') {
      filteredIncidents.forEach(i => {
        data.push({
          "Tipo": "Tentativa Recusada",
          "Participante": i.participants?.people?.full_name || "Anônimo",
          "Delegação": i.participants?.delegations?.school_name || "—",
          "Janela": i.meal_windows?.label || i.meal_windows?.meal_types?.name,
          "Motivo": i.incident_type,
          "Instante": format(new Date(i.incident_at), "HH:mm:ss"),
          "Operador": i.profiles?.full_name || "—",
          "Offline": i.is_offline ? "Sim" : "Não"
        });
      });
    }

    if (tab === 'all' || tab === 'missing_consumption') {
      filteredMissing.forEach(m => {
        data.push({
          "Tipo": "Ausência de Consumo",
          "Participante": m.participant?.people?.full_name,
          "Delegação": m.participant?.delegations?.school_name,
          "Janela": m.window?.label || m.window?.meal_types?.name,
          "Motivo": "Elegível não consumiu",
          "Instante": "—",
          "Operador": "—",
          "Offline": "—"
        });
      });
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Divergências Alimentação");
    XLSX.writeFile(wb, `divergencias_alimentacao_${filterDate}.xlsx`);
    toast.success("Relatório exportado");
  };

  const getIncidentLabel = (type: string) => {
    const map: any = {
      'NOT_ELIGIBLE': 'Não Elegível',
      'OUTSIDE_WINDOW': 'Fora de Horário',
      'DUPLICATE': 'Duplicidade',
      'VOUCHER_INVALID': 'Voucher Inválido',
      'VOUCHER_REVOKED': 'Voucher Revogado',
      'VOUCHER_EXPIRED': 'Voucher Expirado',
      'VOUCHER_ALREADY_USED': 'Voucher Já Usado',
      'OTHER': 'Outro'
    };
    return map[type] || type;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Divergências de Alimentação</h1>
          <p className="text-sm text-muted-foreground mt-1">Consolidado de recusas e ausências de consumo</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <Button variant="outline" size="sm" onClick={exportXlsx} disabled={loadingIncidents || loadingMissing}>
            <Download className="mr-2 h-4 w-4" /> Exportar XLSX
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">Data de Serviço</label>
              <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            </div>
            <div className="md:col-span-3 space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">Busca Rápida</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Nome do participante ou janela..." 
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as DivergenceType)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="incident_attempt" className="gap-2">
            <AlertTriangle className="h-3.5 w-3.5" /> Recusas
          </TabsTrigger>
          <TabsTrigger value="missing_consumption" className="gap-2">
            <UserX className="h-3.5 w-3.5" /> Ausências
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incident_attempt" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> 
                Tentativas Recusadas ({filteredIncidents.length})
              </CardTitle>
              <CardDescription>Logs de QR Codes escaneados mas não autorizados</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participante</TableHead>
                    <TableHead>Janela</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Instante</TableHead>
                    <TableHead>Operador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingIncidents ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                    ))
                  ) : filteredIncidents.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Nenhuma recusa registrada para este dia.</TableCell></TableRow>
                  ) : (
                    filteredIncidents.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          <div className="font-medium">{i.participants?.people?.full_name || "Anônimo"}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">{i.participants?.delegations?.school_name || "—"}</div>
                        </TableCell>
                        <TableCell>{i.meal_windows?.label || i.meal_windows?.meal_types?.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-destructive/30 text-destructive text-[10px]">
                            {getIncidentLabel(i.incident_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[10px]">
                          {format(new Date(i.incident_at), "HH:mm:ss")}
                          {i.is_offline && <Badge variant="secondary" className="ml-1 text-[8px] h-3 px-1">OFF</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{i.profiles?.full_name || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="missing_consumption" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-500" /> 
                Ausências de Consumo ({filteredMissing.length})
              </CardTitle>
              <CardDescription>Pessoas elegíveis que não registraram consumo na janela</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participante</TableHead>
                    <TableHead>Delegação</TableHead>
                    <TableHead>Janela</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMissing ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                    ))
                  ) : filteredMissing.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">Nenhuma ausência detectada ou não há janelas/elegíveis.</TableCell></TableRow>
                  ) : (
                    filteredMissing.slice(0, 300).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.participant?.people?.full_name}</TableCell>
                        <TableCell className="text-xs">{m.participant?.delegations?.school_name}</TableCell>
                        <TableCell className="text-xs">{m.window?.label || m.window?.meal_types?.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 text-[10px]">FALTA</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {filteredMissing.length > 300 && (
                <p className="text-center text-[10px] text-muted-foreground py-2">Mostrando primeiros 300 resultados. Exporte XLSX para ver todos.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Card className="bg-amber-50/30 border-amber-200">
               <CardContent className="pt-6">
                 <div className="flex items-center gap-4">
                    <AlertTriangle className="h-10 w-10 text-amber-500" />
                    <div>
                      <p className="text-2xl font-bold">{filteredIncidents.length}</p>
                      <p className="text-sm font-medium text-amber-700">Tentativas Recusadas</p>
                    </div>
                 </div>
               </CardContent>
             </Card>
             <Card className="bg-red-50/30 border-red-200">
               <CardContent className="pt-6">
                 <div className="flex items-center gap-4">
                    <UserX className="h-10 w-10 text-red-500" />
                    <div>
                      <p className="text-2xl font-bold">{filteredMissing.length}</p>
                      <p className="text-sm font-medium text-red-700">Ausências Detectadas</p>
                    </div>
                 </div>
               </CardContent>
             </Card>
          </div>
          <p className="text-center text-sm text-muted-foreground italic">Selecione uma aba acima para ver o detalhamento.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}