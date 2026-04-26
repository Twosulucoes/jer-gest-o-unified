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
  useModalityDetails, 
  useModalityPhases, 
  useModalityGroups
} from "@/hooks/useScoreMatches";
import { useSetsMatches } from "@/hooks/useSetsMatches";
import { useSportEventRules } from "@/hooks/useSportEventRules";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MatchScoreFormDrawer } from "@/components/admin/competition/MatchScoreFormDrawer";
import { formatMatchSets, formatMatchPartials } from "./competicao/painel/lib/formatSets";

export default function CompeticaoPainelSetsPage() {
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

  const { data: modality, isLoading: loadingModality } = useModalityDetails(sportEventId);
  const { data: matches = [], isLoading: loadingMatches, error: matchesError } = useSetsMatches(sportEventId);
  const { data: phases = [] } = useModalityPhases(sportEventId);
  const { data: groups = [] } = useModalityGroups(sportEventId);
  const { rules, isLoading: loadingRules } = useSportEventRules(eventId, sportEventId || null);

  const canEdit = hasRole("admin") || hasRole("coordenacao_tecnica");
  const canEditAgenda = canEdit || hasRole("secretaria");

  const filteredMatches = useMemo(() => {
    return (matches || []).filter(m => {
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
    if (!window.confirm("Tem certeza que deseja excluir este confronto?")) return;
    
    const { error } = await supabase
      .from("competition_matches")
      .delete()
      .eq("id", id);
      
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Confronto excluído");
      qc.invalidateQueries({ queryKey: ["sets-matches", sportEventId] });
    }
  };

  const getMatchStatus = (m: any) => {
    const hasResults = (m.match_results?.length || 0) > 0;
    const validated = m.match_results?.every((r: any) => r.result_status === "resultado_validado" || r.result_status === "publicado");
    const published = m.match_results?.some((r: any) => r.result_status === "publicado");

    if (published) return { label: "Publicado", variant: "default" as const, color: "bg-blue-500" };
    if (validated) return { label: "Homologado", variant: "default" as const, color: "bg-green-600" };
    if (hasResults) return { label: "Resultado Lançado", variant: "default" as const, color: "bg-amber-500" };
    if (m.status === "in_progress") return { label: "Em andamento", variant: "default" as const, color: "bg-orange-500" };
    return { label: "Agendado", variant: "outline" as const, color: "text-muted-foreground" };
  };

  if (loadingModality || loadingRules) {
    return <div className="p-8"><Skeleton className="h-20 w-full mb-4" /><Skeleton className="h-64 w-full" /></div>;
  }

  const isConfigured = rules && rules.scoring?.best_of;

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

      {rules && !isConfigured && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Formato de sets não configurado</AlertTitle>
          <AlertDescription>
            O formato da partida (melhor de X sets) não foi definido nas regras desta modalidade. 
            Por favor, <Link to="/admin/competicao/regras" className="font-bold underline">configure as regras</Link> antes de lançar resultados.
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
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[60px]">Nº</TableHead>
              <TableHead>Confronto</TableHead>
              <TableHead className="text-center w-[80px]">Placar</TableHead>
              <TableHead>Parciais</TableHead>
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
                const status = getMatchStatus(m);
                const schoolA = m.match_entries?.[0]?.teams?.delegations?.institutions?.name || "—";
                const schoolB = m.match_entries?.[1]?.teams?.delegations?.institutions?.name || "—";
                const sets = formatMatchSets(m);
                const partials = formatMatchPartials(m);
                
                return (
                  <TableRow key={m.id} className="group text-xs">
                    <TableCell className="font-mono text-[10px] font-semibold">
                      #{m.match_number || "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate max-w-[150px]">{schoolA}</span>
                        <span className="text-[10px] text-muted-foreground">vs</span>
                        <span className="truncate max-w-[150px]">{schoolB}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-bold text-sm">
                      {sets || "—"}
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground font-mono">
                      {partials || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {m.match_date ? new Date(m.match_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {m.start_time?.slice(0, 5) || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[100px] truncate">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        {m.venues?.name || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className={`${status.color} border-0 text-[10px] py-0 h-5`}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7" 
                          asChild
                          title="Ver Detalhes"
                        >
                          <Link to={`/admin/competicao/partida/${m.id}`}>
                            <Info className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        {m.match_entries?.length === 2 && (status.label === "Agendado" || status.label === "Em andamento" || status.label === "Resultado Lançado") && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                            asChild
                            title="Lançar Resultado"
                          >
                            <Link to={`/admin/competicao/painel-sets/${sportEventId}/confronto/${m.id}/resultado`}>
                              <Trophy className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                        {(canEdit || canEditAgenda) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => { setEditingMatch(m); setIsDrawerOpen(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(m.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
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
