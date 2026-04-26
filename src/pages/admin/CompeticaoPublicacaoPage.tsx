import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, 
  History,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Clock
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";


export default function CompeticaoPublicacaoPage() {
  const eventId = useActiveEventId();
  const { hasRole } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("resultado_validado");
  const [selectedMatches, setSelectedMatches] = useState<string[]>([]);
  const [showConfirmBatch, setShowConfirmBatch] = useState(false);
  const [historyMatchId, setHistoryMatchId] = useState<string | null>(null);

  // Fetch results that are validated or published
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["publication-matches", eventId, statusFilter],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_matches")
        .select(`
          *,
          sport_events (id, name, sports(name), categories(name)),
          competition_phases (name),
          competition_match_entries (
            id,
            teams (
              name,
              delegations (
                institutions (name)
              )
            )
          ),
          competition_match_results (
            id,
            result_status,
            score,
            outcome,
            validated_at,
            validated_by,
            published_at,
            published_by
          )
        `)
        .eq("event_id", eventId!)
        .order("match_date", { ascending: false });

      if (error) throw error;
      
      // Filter matches that have results in validado or publicado
      return (data || []).filter((m: any) => 
        m.competition_match_results.some((r: any) => 
          statusFilter === "all" || r.result_status === statusFilter
        )
      );
    }
  });

  const publishMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await (supabase.rpc as any)("rpc_publish_match_result", {
        p_match_ids: ids
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Resultados publicados com sucesso!");
      setSelectedMatches([]);
      setShowConfirmBatch(false);
      qc.invalidateQueries({ queryKey: ["publication-matches"] });
    },
    onError: (e: any) => {
      toast.error("Erro ao publicar: " + e.message);
    }
  });

  const revertMut = useMutation({
    mutationFn: async ({ matchId, targetStatus, reason }: { matchId: string, targetStatus: string, reason: string }) => {
      const { data, error } = await (supabase.rpc as any)("rpc_revert_match_result_status", {
        p_match_id: matchId,
        p_target_status: targetStatus,
        p_reason: reason
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Status revertido com sucesso!");
      qc.invalidateQueries({ queryKey: ["publication-matches"] });
    },
    onError: (e: any) => {
      toast.error("Erro ao reverter: " + e.message);
    }
  });

  const filteredMatches = useMemo(() => {
    return matches.filter((m: any) => {
      if (search) {
        const s = search.toLowerCase();
        const schoolA = m.competition_match_entries?.[0]?.teams?.name?.toLowerCase() || "";
        const schoolB = m.competition_match_entries?.[1]?.teams?.name?.toLowerCase() || "";
        const modality = m.sport_events?.name?.toLowerCase() || "";
        const sport = (m.sport_events as any)?.sports?.name?.toLowerCase() || "";
        if (!schoolA.includes(s) && !schoolB.includes(s) && !modality.includes(s) && !sport.includes(s)) return false;
      }
      return true;
    });
  }, [matches, search]);

  const handleToggleSelect = (id: string) => {
    setSelectedMatches(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const validatableIds = filteredMatches
      .filter((m: any) => m.competition_match_results[0]?.result_status === "resultado_validado")
      .map((m: any) => m.id);
    
    if (selectedMatches.length === validatableIds.length && validatableIds.length > 0) {
      setSelectedMatches([]);
    } else {
      setSelectedMatches(validatableIds);
    }
  };

  const handleBatchPublish = () => {
    if (selectedMatches.length > 10) {
      setShowConfirmBatch(true);
    } else {
      publishMut.mutate(selectedMatches);
    }
  };

  // Fetch history for selected match
  const { data: history = [] } = useQuery({
    queryKey: ["match-history", historyMatchId],
    enabled: !!historyMatchId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("match_results_history")
        .select(`
          *,
          profiles(full_name)
        `)
        .eq("match_id", historyMatchId!)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <ModuleHeader 
        title="Central de Publicação de Resultados"
        route="/admin/competicao/painel"
      />

      <div className="flex flex-col md:flex-row gap-4 bg-muted/30 p-4 rounded-lg border">
        <div className="flex-1 flex gap-2 items-center">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por escola ou modalidade..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="resultado_validado">Aguardando Publicação</SelectItem>
              <SelectItem value="publicado">Publicados</SelectItem>
            </SelectContent>
          </Select>

          {selectedMatches.length > 0 && (
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleBatchPublish}>
              <CheckCircle2 className="h-4 w-4" />
              Publicar Selecionados ({selectedMatches.length})
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40px]">
                <Checkbox 
                  checked={selectedMatches.length > 0 && selectedMatches.length === filteredMatches.filter((m: any) => m.competition_match_results[0]?.result_status === "resultado_validado").length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Modalidade / Categoria</TableHead>
              <TableHead>Confronto</TableHead>
              <TableHead>Placar</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Homologação / Publicação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))
            ) : filteredMatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Nenhum resultado encontrado para publicação.
                </TableCell>
              </TableRow>
            ) : (
              filteredMatches.map((m: any) => {
                const res = m.competition_match_results[0];
                const schoolA = m.competition_match_entries?.[0]?.teams?.name || "—";
                const schoolB = m.competition_match_entries?.[1]?.teams?.name || "—";
                
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      {res?.result_status === "resultado_validado" && (
                        <Checkbox 
                          checked={selectedMatches.includes(m.id)}
                          onCheckedChange={() => handleToggleSelect(m.id)}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{(m.sport_events as any)?.sports?.name}</div>
                      <div className="text-xs text-muted-foreground">{(m.sport_events as any)?.categories?.name} • {m.competition_phases?.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{schoolA} × {schoolB}</div>
                      <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-2 mt-1">
                        <Calendar className="h-3 w-3" /> {new Date(m.match_date).toLocaleDateString("pt-BR")}
                        <Clock className="h-3 w-3 ml-2" /> {m.start_time?.slice(0, 5)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-sm">
                        {m.competition_match_results?.[0]?.score || "0"} × {m.competition_match_results?.[1]?.score || "0"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {res?.result_status === "publicado" ? (
                        <Badge className="bg-emerald-600 border-none text-white">Publicado</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 animate-pulse">Aguardando</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {res?.validated_at && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-blue-500" />
                          <span>{new Date(res.validated_at).toLocaleString("pt-BR")}</span>
                        </div>
                      )}
                      {res?.published_at && (
                        <div className="flex items-center gap-1 text-muted-foreground mt-1">
                          <ExternalLink className="h-3 w-3 text-emerald-500" />
                          <span>{new Date(res.published_at).toLocaleString("pt-BR")}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8" 
                          title="Ver Histórico"
                          onClick={() => setHistoryMatchId(m.id)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        
                        {res?.result_status === "validado" && (
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="bg-emerald-500 hover:bg-emerald-600 text-white h-8"
                            onClick={() => publishMut.mutate([m.id])}
                          >
                            Publicar
                          </Button>
                        )}

                        {hasRole("admin") && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive" 
                            title="Reverter Status"
                            onClick={() => {
                              const reason = prompt("Justificativa para reversão:");
                              if (reason) {
                                revertMut.mutate({ 
                                  matchId: m.id, 
                                  targetStatus: "resultado_lancado", 
                                  reason 
                                });
                              }
                            }}
                          >
                            <AlertTriangle className="h-4 w-4" />
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

      <Dialog open={showConfirmBatch} onOpenChange={setShowConfirmBatch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Publicação em Lote</DialogTitle>
            <DialogDescription>
              Você está prestes a publicar {selectedMatches.length} resultados simultaneamente. 
              Esta ação tornará todos estes resultados visíveis no portal público.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmBatch(false)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => publishMut.mutate(selectedMatches)}>
              Confirmar Publicação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!historyMatchId} onOpenChange={(open) => !open && setHistoryMatchId(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 font-heading">
              <History className="h-5 w-5" />
              Histórico do Resultado
            </SheetTitle>
            <SheetDescription>
              Linha do tempo de alterações e homologações deste confronto.
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-8 space-y-6">
            {history.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground italic">
                Nenhum registro de histórico encontrado.
              </div>
            ) : (
              <div className="relative pl-6 border-l-2 border-muted space-y-8 ml-2">
                {history.map((h: any) => (
                  <div key={h.id} className="relative">
                    <div className={`absolute -left-[31px] mt-1.5 h-4 w-4 rounded-full border-2 border-background ${
                      h.action_type === 'published' ? 'bg-emerald-500' :
                      h.action_type === 'homologated' ? 'bg-blue-500' :
                      h.action_type === 'reverted' ? 'bg-destructive' : 'bg-amber-500'
                    }`} />
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-sm uppercase">
                          {h.action_type === 'save' ? 'Lançamento' : 
                           h.action_type === 'homologated' ? 'Homologação' :
                           h.action_type === 'published' ? 'Publicação' :
                           h.action_type === 'reverted' ? 'Reversão' : h.action_type}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(h.changed_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Por: {h.profiles?.full_name || 'Usuário do Sistema'}
                      </div>
                      {h.payload?.reason && (
                        <div className="mt-2 p-2 bg-destructive/10 text-destructive text-[10px] rounded italic">
                          Justificativa: {h.payload.reason}
                        </div>
                      )}
                      {h.payload?.observation && (
                        <div className="mt-2 p-2 bg-blue-50 text-blue-700 text-[10px] rounded italic">
                          Obs: {h.payload.observation}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
