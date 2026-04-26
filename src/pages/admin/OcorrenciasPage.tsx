import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AlertTriangle, Search, Phone, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  INCIDENT_MODULES, 
  INCIDENT_STATUSES, 
  type IncidentModule, 
  type IncidentStatus 
} from "@/types/incidents";

interface Incident {
  id: string;
  event_id: string;
  event_stage_id: string | null;
  module: IncidentModule;
  reference_id: string | null;
  reference_label: string | null;
  reported_by_user_id: string;
  reporter_name: string | null;
  reporter_phone: string | null;
  incident_description: string;
  incident_status: IncidentStatus;
  admin_response: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  created_at: string;
}


export default function OcorrenciasPage() {
  const { activeEvent } = useEventContext();
  const { isStageScoped, stageId } = useStageScope();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterModule, setFilterModule] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState<Incident | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editStatus, setEditStatus] = useState("");
  const [editResponse, setEditResponse] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 15;

  const fetchIncidents = useCallback(async () => {
    if (!activeEvent) return;
    setLoading(true);
    
    try {
      let query = supabase
        .from("operational_incidents")
        .select("*", { count: "exact" })
        .eq("event_id", activeEvent.id);

      if (isStageScoped && stageId) {
        query = query.eq("event_stage_id", stageId);
      }

      if (filterModule !== "all") {
        query = query.eq("module", filterModule as any);
      }
      
      if (filterStatus !== "all") {
        query = query.eq("incident_status", filterStatus as any);
      }

      if (search) {
        // Simple search across multiple columns
        query = query.or(`reporter_name.ilike.%${search}%,reference_label.ilike.%${search}%,incident_description.ilike.%${search}%`);
      }

      // Pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      setIncidents((data as any) || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error("Error fetching incidents:", err);
      toast.error("Erro ao carregar ocorrências");
    } finally {
      setLoading(false);
    }
  }, [activeEvent, filterModule, filterStatus, isStageScoped, stageId, currentPage, search]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterModule, filterStatus, search]);

  const openDrawer = (incident: Incident) => {
    setSelected(incident);
    setEditStatus(incident.incident_status);
    setEditResponse(incident.admin_response || "");
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updates: any = {
        incident_status: editStatus,
        admin_response: editResponse.trim() || null,
      };
      if (editStatus === "resolved" && selected.incident_status !== "resolved") {
        updates.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("operational_incidents")
        .update(updates)
        .eq("id", selected.id);
      if (error) throw error;
      toast.success("Ocorrência atualizada");
      setDrawerOpen(false);
      fetchIncidents();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <div>
          <h1 className="text-xl font-bold">Ocorrências Operacionais</h1>
          <p className="text-sm text-muted-foreground">Central de ocorrências de todos os módulos operacionais.</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, referência ou descrição..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-[160px]">
              <Label className="text-xs">Módulo</Label>
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {(Object.entries(INCIDENT_MODULES) as [IncidentModule, any][]).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>

              </Select>
            </div>
            <div className="w-[160px]">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in_progress">Em análise</SelectItem>
                  <SelectItem value="resolved">Resolvida</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : incidents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium">Nenhuma ocorrência encontrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Módulo</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Reportado por</TableHead>
                    <TableHead className="max-w-[300px]">Descrição</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[120px]">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((incident) => {
                    const mod = INCIDENT_MODULES[incident.module] || INCIDENT_MODULES.outro;
                    const status = INCIDENT_STATUSES[incident.incident_status] || INCIDENT_STATUSES.pending;

                    return (
                      <TableRow
                        key={incident.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => openDrawer(incident)}
                      >
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${mod.color}`}>
                            {mod.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{incident.reference_label || "—"}</TableCell>
                        <TableCell>
                          <div className="text-sm">{incident.reporter_name || "—"}</div>
                          {incident.reporter_phone && (
                            <a
                              href={`tel:${incident.reporter_phone}`}
                              className="text-xs text-primary flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="h-3 w-3" />{incident.reporter_phone}
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <p className="text-sm truncate">
                            {incident.incident_description.length > 80
                              ? incident.incident_description.slice(0, 80) + "..."
                              : incident.incident_description}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(incident.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-4">
              <p className="text-sm text-muted-foreground">
                Mostrando <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> a{" "}
                <span className="font-medium">
                  {Math.min(currentPage * pageSize, totalCount)}
                </span>{" "}
                de <span className="font-medium">{totalCount}</span> resultados
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Logic to show a window of pages around current
                    let pageNum = currentPage;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próximo <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da Ocorrência</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-4 mt-4">
              {/* Context card */}
              <Card>
                <CardContent className="p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Módulo:</span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${(INCIDENT_MODULES[selected.module] || INCIDENT_MODULES.outro).color}`}>
                      {(INCIDENT_MODULES[selected.module] || INCIDENT_MODULES.outro).label}
                    </span>
                  </div>

                  {selected.reference_label && (
                    <div>
                      <span className="font-medium">Referência:</span>{" "}
                      <span>{selected.reference_label}</span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Reportado por:</span>{" "}
                    <span>{selected.reporter_name || "—"}</span>
                    {selected.reporter_phone && (
                      <a href={`tel:${selected.reporter_phone}`} className="ml-2 text-primary text-xs inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />{selected.reporter_phone}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(selected.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </CardContent>
              </Card>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Descrição da Ocorrência</Label>
                <Textarea
                  value={selected.incident_description}
                  readOnly
                  rows={4}
                  className="bg-muted resize-none"
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_progress">Em análise</SelectItem>
                    <SelectItem value="resolved">Resolvida</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Admin response */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Resposta / Ação Tomada</Label>
                <Textarea
                  value={editResponse}
                  onChange={(e) => setEditResponse(e.target.value)}
                  placeholder="Descreva como a ocorrência foi tratada..."
                  rows={3}
                />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
