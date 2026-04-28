import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { 
  AlertTriangle, 
  ArrowLeft, 
  Download, 
  Search,
  Filter,
  User,
  Building
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type DivergenceType = "unit_divergence" | "missing_checkin" | "missing_presence" | "all";

export default function AlojamentoDivergenciasPage() {
  const eventId = useActiveEventId();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [typeFilter, setTypeFilter] = useState<DivergenceType>("all");
  const [search, setSearch] = useState("");

  // Load Occupancies with divergence info
  const { data: occupancies = [], isLoading } = useQuery({
    queryKey: ["lodging-divergences", eventId, typeFilter],
    enabled: !!eventId,
    queryFn: async () => {
      let query = supabase
        .from("lodging_occupancies")
        .select(`
          *,
          lodging_units(name, lodging_locations(name)),
          participants(
            id,
            people(full_name),
            delegations(institutions(name))
          )
        `)
        .eq("event_id", eventId!);

      const { data, error } = await query;
      if (error) throw error;

      let result = data as any[];

      // In a real scenario, we would join with lodging_presence_logs to find missing_presence
      // For this implementation, we focus on unit_divergence and missing_checkin (status='allocated')
      
      if (typeFilter === "unit_divergence") {
        result = result.filter(o => o.divergence_notes && o.status === 'checked_in');
      } else if (typeFilter === "missing_checkin") {
        result = result.filter(o => o.status === 'allocated');
      }

      return result;
    }
  });

  const filteredData = occupancies.filter(o => 
    o.participants?.people?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.lodging_units?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const exportXlsx = () => {
    const data = filteredData.map(item => ({
      "Participante": item.participants?.people?.full_name,
      "Delegação": item.participants?.delegations?.institutions?.name,
      "Unidade Real": item.lodging_units?.name,
      "Local": item.lodging_units?.lodging_locations?.name,
      "Divergência": item.divergence_notes || (item.status === 'allocated' ? "Check-in Pendente" : "Nenhuma"),
      "Status": item.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Divergências");
    XLSX.writeFile(wb, "relatorio_divergencias_alojamento.xlsx");
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Relatório de Divergências</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consolidado de conflitos e pendências do módulo
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <Button variant="outline" size="sm" onClick={exportXlsx}>
            <Download className="mr-2 h-4 w-4" /> Exportar XLSX
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Divergência</label>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ocorrências</SelectItem>
                  <SelectItem value="unit_divergence">Unidade Divergente</SelectItem>
                  <SelectItem value="missing_checkin">Ausência de Check-in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">Busca Rápida</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Nome do participante ou unidade..." 
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> 
            Ocorrências Identificadas ({filteredData.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participante</TableHead>
                <TableHead>Unidade Real</TableHead>
                <TableHead>Divergência / Pendência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    Nenhuma divergência encontrada nos critérios atuais.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="font-medium">{o.participants?.people?.full_name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{o.participants?.delegations?.institutions?.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Building className="h-3 w-3 text-muted-foreground" />
                        {o.lodging_units?.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {o.divergence_notes ? (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold">
                          {o.divergence_notes}
                        </Badge>
                      ) : o.status === 'allocated' ? (
                        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-[10px] font-bold">
                          CHECK-IN PENDENTE
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={o.status === 'checked_in' ? 'default' : 'secondary'} className="text-[10px]">
                        {o.status === 'checked_in' ? 'Hospedado' : 'Alocado'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/participante/${o.participant_id}`)}>
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
