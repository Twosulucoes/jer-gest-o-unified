import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Building, 
  Moon, 
  Users, 
  ArrowLeft, 
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { downloadXlsx } from "@/lib/reportExport";

export default function AlojamentoPresencaPage() {
  const eventId = useActiveEventId();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [selectedNight, setSelectedNight] = useState(format(new Date(), "yyyy-MM-dd"));
  const [viewMode, setViewMode] = useState<"by_unit" | "by_person">("by_unit");

  // Load locations for filtering
  const { data: locations = [] } = useQuery({
    queryKey: ["lodging-locations", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from("lodging_locations").select("id, name").eq("event_id", eventId!).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Calculate night start and end
  // Night 2024-05-01 is defined as 01/05 18:00 to 02/05 06:00
  const nightStart = new Date(selectedNight + "T18:00:00");
  const nightEnd = new Date(selectedNight + "T06:00:00");
  nightEnd.setDate(nightEnd.getDate() + 1);

  // Load Presence Logs for the selected night
  const { data: presenceLogs = [], isLoading: loadingPresence } = useQuery({
    queryKey: ["lodging-presence-logs", eventId, selectedNight],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lodging_presence_logs")
        .select(`
          *,
          participants(
            id,
            people(full_name),
            delegations(institutions(name))
          )
        `)
        .eq("event_id", eventId!)
        .gte("recorded_at", nightStart.toISOString())
        .lt("recorded_at", nightEnd.toISOString());
      if (error) throw error;
      return data as any[];
    }
  });

  // Load Occupancies (those who SHOULD be there)
  const { data: occupancies = [], isLoading: loadingOccupancies } = useQuery({
    queryKey: ["lodging-active-occupancies", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lodging_occupancies")
        .select(`
          *,
          lodging_units(id, name, location_id, lodging_locations(name)),
          participants(
            id,
            people(full_name, gender),
            delegations(institutions(name))
          )
        `)
        .eq("event_id", eventId!)
        .in("status", ["allocated", "checked_in"]);
      if (error) throw error;
      return data as any[];
    }
  });

  // Reconcile
  const reconciledData = useMemo(() => {
    const presentSet = new Set(presenceLogs.map(p => p.participant_id));
    
    return occupancies.map(occ => {
      const isPresent = presentSet.has(occ.participant_id);
      const log = presenceLogs.find(p => p.participant_id === occ.participant_id);
      
      return {
        ...occ,
        isPresent,
        recordedAt: log?.recorded_at,
        deviceId: log?.device_id
      };
    });
  }, [occupancies, presenceLogs]);

  const unitsGrouped = useMemo(() => {
    const groups: Record<string, any> = {};
    reconciledData.forEach(item => {
      const unitId = item.unit_id;
      if (!groups[unitId]) {
        groups[unitId] = {
          id: unitId,
          name: item.lodging_units?.name,
          locationName: item.lodging_units?.lodging_locations?.name,
          present: [],
          absent_with_checkin: [],
          missing_checkin: []
        };
      }
      
      if (item.isPresent) {
        groups[unitId].present.push(item);
      } else if (item.status === 'checked_in') {
        groups[unitId].absent_with_checkin.push(item);
      } else {
        groups[unitId].missing_checkin.push(item);
      }
    });
    return Object.values(groups);
  }, [reconciledData]);

  const exportXlsx = () => {
    const data = reconciledData.map(item => ({
      "Participante": item.participants?.people?.full_name,
      "Unidade": item.lodging_units?.name,
      "Local": item.lodging_units?.lodging_locations?.name,
      "Status Check-in": item.status,
      "Presente na Noite": item.isPresent ? "SIM" : "NÃO",
      "Horário Registro": item.recordedAt ? format(new Date(item.recordedAt), "HH:mm") : "-"
    }));
    downloadXlsx(data, `presenca_alojamento_${selectedNight}.xlsx`, "Presença");
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Presença Noturna</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controle de retorno aos alojamentos (Modo Lua)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <Button variant="outline" size="sm" onClick={exportXlsx}>
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Noite Selecionada</label>
              <Input 
                type="date" 
                value={selectedNight} 
                onChange={(e) => setSelectedNight(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
               <label className="text-sm font-medium">Resumo da Noite</label>
               <div className="flex gap-3">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 py-1.5 px-3">
                    {presenceLogs.length} Presentes
                  </Badge>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 py-1.5 px-3">
                    {reconciledData.filter(d => !d.isPresent && d.status === 'checked_in').length} Ausentes
                  </Badge>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 py-1.5 px-3">
                    {reconciledData.filter(d => d.status === 'allocated').length} Sem Check-in
                  </Badge>
               </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="by_unit" className="flex items-center gap-2">
            <Building className="h-4 w-4" /> Por Unidade
          </TabsTrigger>
          <TabsTrigger value="by_person" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Por Pessoa
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {viewMode === "by_unit" ? (
            <div className="space-y-6">
              {loadingPresence || loadingOccupancies ? (
                <Skeleton className="h-40 w-full" />
              ) : unitsGrouped.map(unit => (
                <Card key={unit.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/50 py-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base">
                        {unit.locationName} — {unit.name}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="secondary" className="text-[10px]">{unit.present.length} P</Badge>
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">{unit.absent_with_checkin.length} A</Badge>
                        <Badge variant="outline" className="text-[10px] text-red-600 border-red-200">{unit.missing_checkin.length} SC</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-1/3">Participante</TableHead>
                          <TableHead>Delegação</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Presença</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...unit.present, ...unit.absent_with_checkin, ...unit.missing_checkin].map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium text-xs">{item.participants?.people?.full_name}</TableCell>
                            <TableCell className="text-xs">{item.participants?.delegations?.institutions?.name}</TableCell>
                            <TableCell>
                               <Badge variant={item.status === 'checked_in' ? 'default' : 'outline'} className="text-[10px]">
                                 {item.status === 'checked_in' ? 'Hospedado' : 'Alocado'}
                               </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.isPresent ? (
                                <div className="flex items-center justify-end gap-1 text-green-600 font-bold text-xs">
                                  <CheckCircle2 className="h-3 w-3" /> {format(new Date(item.recordedAt), "HH:mm")}
                                </div>
                              ) : item.status === 'checked_in' ? (
                                <div className="flex items-center justify-end gap-1 text-amber-600 font-bold text-xs">
                                  <XCircle className="h-3 w-3" /> AUSENTE
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1 text-red-600 font-bold text-xs uppercase">
                                  <HelpCircle className="h-3 w-3" /> Sem In
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participante</TableHead>
                      <TableHead>Local / Unidade</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead className="text-right">Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciledData.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.participants?.people?.full_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.lodging_units?.lodging_locations?.name} / {item.lodging_units?.name}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.recordedAt ? format(new Date(item.recordedAt), "dd/MM HH:mm") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.isPresent ? (
                            <Badge className="bg-green-500">Presente</Badge>
                          ) : item.status === 'checked_in' ? (
                            <Badge variant="destructive">Ausente</Badge>
                          ) : (
                            <Badge variant="outline">Sem Check-in</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </Tabs>
    </div>
  );
}

