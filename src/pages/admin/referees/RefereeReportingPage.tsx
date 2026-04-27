import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  FileSpreadsheet, 
  Search, 
  ChevronDown, 
  ChevronUp,
  Calendar,
  Filter
} from "lucide-react";
import { useEventContext } from "@/contexts/EventContext";
import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

type ReportingRow = {
  user_id: string;
  match_id: string;
  role: string;
  match_date: string;
  event_stage_id: string;
  sport_id: string;
  remuneration_type: 'daily' | 'per_match';
  is_fulfilled: boolean;
};

export default function RefereeReportingPage() {
  const { activeEventId } = useEventContext();
  const [selectedStageId, setSelectedStageId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedReferees, setExpandedReferees] = useState<Set<string>>(new Set());

  // Etapas do evento
  const { data: stages = [] } = useQuery({
    queryKey: ["event-stages-reporting", activeEventId],
    enabled: !!activeEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_stages")
        .select("id, name")
        .eq("event_id", activeEventId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Modalidades (para labels)
  const { data: sports = [] } = useQuery({
    queryKey: ["sports-reporting", activeEventId],
    enabled: !!activeEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sports")
        .select("id, name")
        .eq("event_id", activeEventId!);
      if (error) throw error;
      return data;
    },
  });
  const sportsMap = useMemo(() => new Map(sports.map(s => [s.id, s.name])), [sports]);

  // Designações cumpridas
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["referee-reporting-assignments", activeEventId, selectedStageId],
    enabled: !!activeEventId,
    queryFn: async () => {
      let q = supabase
        .from("vw_fulfilled_referee_assignments" as any)
        .select("*")
        .eq("event_id", activeEventId);
      
      if (selectedStageId !== "all") {
        q = q.eq("event_stage_id", selectedStageId);
      }
      
      const { data, error } = await q;
      if (error) throw error;
      return data as ReportingRow[];
    },
  });

  // Perfis (nomes)
  const userIds = useMemo(() => Array.from(new Set(assignments.map(a => a.user_id))), [assignments]);
  const { data: profiles = [] } = useQuery({
    queryKey: ["referee-reporting-profiles", userIds.length],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (error) throw error;
      return data;
    },
  });
  const profilesMap = useMemo(() => new Map(profiles.map(p => [p.id, p.full_name])), [profiles]);

  // Agrupamento e Cálculo
  const consolidated = useMemo(() => {
    const grouped = new Map<string, {
      userId: string;
      fullName: string;
      dailyUnits: number;
      matchUnits: number;
      sports: Set<string>;
      activities: ReportingRow[];
    }>();

    assignments.forEach(a => {
      if (!grouped.has(a.user_id)) {
        grouped.set(a.user_id, {
          userId: a.user_id,
          fullName: profilesMap.get(a.user_id) || "Usuário desconhecido",
          dailyUnits: 0,
          matchUnits: 0,
          sports: new Set(),
          activities: [],
        });
      }
      const g = grouped.get(a.user_id)!;
      g.sports.add(a.sport_id);
      g.activities.push(a);
    });

    // Calcular unidades
    grouped.forEach(g => {
      // Unidades por partida
      g.matchUnits = g.activities.filter(a => a.remuneration_type === 'per_match' && a.is_fulfilled).length;

      // Unidades por diária (contar dias distintos com ao menos uma atividade cumprida de modalidade tipo 'daily')
      const dailyActivities = g.activities.filter(a => a.remuneration_type === 'daily' && a.is_fulfilled);
      const distinctDays = new Set(dailyActivities.map(a => a.match_date));
      g.dailyUnits = distinctDays.size;
    });

    return Array.from(grouped.values())
      .filter(g => {
        if (!searchTerm) return true;
        return g.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [assignments, profilesMap, searchTerm]);

  const toggleExpand = (userId: string) => {
    const next = new Set(expandedReferees);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setExpandedReferees(next);
  };

  const handleExport = () => {
    // Implementação simples de CSV
    const headers = ["Árbitro", "Modalidades", "Diárias", "Partidas"];
    const rows = consolidated.map(g => [
      g.fullName,
      Array.from(g.sports).map(id => sportsMap.get(id) || id).join(", "),
      g.dailyUnits.toString(),
      g.matchUnits.toString()
    ]);

    const csvContent = [headers, ...rows].map(e => e.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `apuracao-arbitragem-${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Auditoria
    supabase.from("audit_events").insert({
      action: "referee_report_export",
      table_name: "match_user_assignments",
      record_id: activeEventId || "global",
      payload: { stage_id: selectedStageId, filters: { searchTerm } }
    }).then(() => {});

    toast.success("Relatório exportado com sucesso.");
  };

  if (!activeEventId) {
    return <div className="p-8 text-center text-muted-foreground">Selecione um evento ativo.</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Apuração de Atividades
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Contagem de diárias e partidas para fins de remuneração operacional.
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={consolidated.length === 0}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Exportar Planilha
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-4 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar árbitro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedStageId} onValueChange={setSelectedStageId}>
            <SelectTrigger>
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : consolidated.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma atividade registrada.</CardContent></Card>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Árbitro</TableHead>
                <TableHead>Modalidades</TableHead>
                <TableHead className="text-right">Diárias</TableHead>
                <TableHead className="text-right">Partidas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consolidated.map((ref) => (
                <>
                  <TableRow key={ref.userId} className="cursor-pointer" onClick={() => toggleExpand(ref.userId)}>
                    <TableCell>
                      {expandedReferees.has(ref.userId) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </TableCell>
                    <TableCell className="font-medium">{ref.fullName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(ref.sports).map(id => (
                          <Badge key={id} variant="secondary" className="text-[10px]">
                            {sportsMap.get(id) || "..." }
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold">{ref.dailyUnits}</TableCell>
                    <TableCell className="text-right font-bold">{ref.matchUnits}</TableCell>
                  </TableRow>
                  {expandedReferees.has(ref.userId) && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={5} className="p-0">
                        <div className="p-4 space-y-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detalhamento de Atividades</h4>
                          <Table className="bg-background border rounded-md">
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="h-8 text-[10px]">Data</TableHead>
                                <TableHead className="h-8 text-[10px]">Modalidade</TableHead>
                                <TableHead className="h-8 text-[10px]">Função</TableHead>
                                <TableHead className="h-8 text-[10px]">Tipo</TableHead>
                                <TableHead className="h-8 text-[10px] text-right">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {ref.activities.sort((a,b) => a.match_date.localeCompare(b.match_date)).map((act, i) => (
                                <TableRow key={i} className="hover:bg-transparent">
                                  <TableCell className="py-1 text-xs">{act.match_date ? format(parseISO(act.match_date), "dd/MM") : "—"}</TableCell>
                                  <TableCell className="py-1 text-xs">{sportsMap.get(act.sport_id) || "—"}</TableCell>
                                  <TableCell className="py-1 text-xs opacity-70">{act.role}</TableCell>
                                  <TableCell className="py-1 text-xs">
                                    <Badge variant="outline" className="text-[9px] uppercase">
                                      {act.remuneration_type === 'daily' ? 'Diária' : 'Partida'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-1 text-right">
                                    {act.is_fulfilled ? (
                                      <Badge variant="default" className="bg-green-600 hover:bg-green-600 text-[9px]">CUMPRIDA</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[9px] opacity-50">NÃO CUMPRIDA</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
