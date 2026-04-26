import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { toast } from "sonner";
import ModuleHeader from "@/components/admin/ModuleHeader";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  AlertTriangle,
  Calendar,
  Clock,
  MapPin,
  Info,
  Trophy
} from "lucide-react";
import { 
  useScoreMatches, 
  useModalityDetails, 
  useModalityPhases, 
  useModalityGroups
} from "@/hooks/useScoreMatches";
import { useSportEventRules } from "@/hooks/useSportEventRules";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MatchScoreFormDrawer } from "@/components/admin/competition/MatchScoreFormDrawer";

export default function CompeticaoPainelScorePage() {
  const { sportEventId } = useParams();
  const eventId = useActiveEventId();
  const { hasRole } = useAuth();
  const qc = useQueryClient();

  const [phaseFilter, setPhaseFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null);

  const { data: modality, isLoading: loadingModality } = useModalityDetails(sportEventId);
  const { data: matches = [], isLoading: loadingMatches, error: matchesError } = useScoreMatches(sportEventId);
  const { data: phases = [] } = useModalityPhases(sportEventId);
  const { data: groups = [] } = useModalityGroups(sportEventId);
  const { rules, isLoading: loadingRules } = useSportEventRules(eventId, sportEventId || null);

  const canEdit = hasRole("admin") || hasRole("coordenacao_tecnica");
  const canEditAgenda = canEdit || hasRole("secretaria");

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      if (phaseFilter !== "all" && m.phase_id !== phaseFilter) return false;
      if (groupFilter !== "all" && m.group_id !== groupFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      
      if (search) {
        const s = search.toLowerCase();
        const schoolA = m.match_entries?.[0]?.teams?.delegations?.institutions?.name?.toLowerCase() || "";
        const schoolB = m.match_entries?.[1]?.teams?.delegations?.institutions?.name?.toLowerCase() || "";
        if (!schoolA.includes(s) && !schoolB.includes(s)) return false;
      }
      
      return true;
    });
  }, [matches, phaseFilter, groupFilter, statusFilter, search]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("competition_matches")
      .delete()
      .eq("id", id);
      
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Confronto excluído");
      qc.invalidateQueries({ queryKey: ["score-matches", sportEventId] });
    }
  };

  const getMatchStatus = (m: any) => {
    const hasResults = (m.match_results?.length || 0) > 0;
    const allValidated = hasResults && m.match_results?.every((r: any) => r.result_status === "resultado_validado" || r.result_status === "publicado");
    const allPublished = hasResults && m.match_results?.every((r: any) => r.result_status === "publicado");
    const someLaunched = hasResults && m.match_results?.some((r: any) => r.result_status === "resultado_lancado");

    if (allPublished) return { label: "Publicado", variant: "default" as const, color: "bg-emerald-600 hover:bg-emerald-700" };
    if (allValidated) return { label: "Validado", variant: "default" as const, color: "bg-blue-600 hover:bg-blue-700 animate-pulse" };
    if (someLaunched) return { label: "Resultado Lançado", variant: "default" as const, color: "bg-amber-500 hover:bg-amber-600" };
    if (m.status === "in_progress") return { label: "Em Andamento", variant: "default" as const, color: "bg-orange-500 hover:bg-orange-600" };
    return { label: "Agendado", variant: "secondary" as const, color: "bg-slate-500 hover:bg-slate-600 text-white" };
  };

  if (loadingModality || loadingRules) {
    return <div className="p-8"><Skeleton className="h-20 w-full mb-4" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <ModuleHeader 
        route="/admin/competicao/painel" 
        title={`${modality?.sports?.name} - ${modality?.categories?.name}`}
        actions={
          canEdit && (
            <Button onClick={() => { setEditingMatch(null); setIsDrawerOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Confronto
            </Button>
          )
        }
      />

      {!rules && !loadingRules && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 font-bold">Regras não cadastradas</AlertTitle>
          <AlertDescription className="text-amber-700">
            Esta modalidade ainda não possui regras configuradas. 
            <Link to="/admin/competicao/regras" className="ml-1 font-bold underline">Configurar Regras</Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-muted/30 p-4 rounded-lg border">
        <div className="flex-1 flex gap-2 items-center">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por escola..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={phaseFilter} onValueChange={setPhaseFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Fase" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Fases</SelectItem>
              {phases.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Grupos</SelectItem>
              {groups.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="scheduled">Agendado</SelectItem>
              <SelectItem value="in_progress">Em andamento</SelectItem>
              <SelectItem value="finished">Finalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[80px]">Nº</TableHead>
              <TableHead>Escola A</TableHead>
              <TableHead className="text-center w-[40px] px-0">vs</TableHead>
              <TableHead>Escola B</TableHead>
              <TableHead>Agenda</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingMatches ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))
            ) : filteredMatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  {matches.length === 0 ? "Nenhum confronto criado. Crie o primeiro confronto para começar." : "Nenhum confronto encontrado com os filtros atuais."}
                </TableCell>
              </TableRow>
            ) : (
              filteredMatches.map((m) => {
                return (
                  <TableRow key={m.id} className="group text-sm">
                    {(() => {
                      const status = getMatchStatus(m);
                      const schoolA = m.match_entries?.[0]?.teams?.delegations?.institutions?.name || "—";
                      const schoolB = m.match_entries?.[1]?.teams?.delegations?.institutions?.name || "—";
                      const hasResults = (m.match_results?.length || 0) > 0;
                      const validated = m.match_results?.every((r: any) => r.result_status === "resultado_validado" || r.result_status === "publicado");
                      const published = m.match_results?.some((r: any) => r.result_status === "publicado");
                      
                      return (
                        <>
                          <TableCell className="font-mono text-xs font-semibold">
                            #{m.match_number || "—"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {schoolA}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground px-0">
                            ×
                          </TableCell>
                          <TableCell className="font-medium">
                            {schoolB}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {m.match_date ? new Date(m.match_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {m.start_time?.slice(0, 5) || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                              {m.venues?.name || "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className={`${status.color} border-0`}>
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {(m.status === "scheduled" || m.status === "in_progress" || hasResults) && !validated && !published && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                  title="Lançar Resultado"
                                  asChild
                                >
                                  <Link to={`confronto/${m.id}/resultado`}>
                                    <Trophy className="h-4 w-4" />
                                  </Link>
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground" 
                                title="Informações"
                                asChild
                              >
                                <Link to={`/admin/competicao/partida/${m.id}`}>
                                  <Info className="h-4 w-4" />
                                </Link>
                              </Button>
                              {(canEdit || canEditAgenda) && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground"
                                  title="Editar Confronto"
                                  onClick={() => { setEditingMatch(m); setIsDrawerOpen(true); }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canEdit && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  title="Excluir"
                                  onClick={() => {
                                    setMatchToDelete(m.id);
                                    setShowDeleteConfirm(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </>
                      );
                    })()}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <MatchScoreFormDrawer 
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        match={editingMatch}
        sportEventId={sportEventId}
        sportId={modality?.sport_id}
        phases={phases}
        groups={groups}
      />
    </div>
  );
}
