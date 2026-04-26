import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { useEventContext } from "@/contexts/EventContext";
import { AlertTriangle, ClipboardList, Filter, ArrowUpDown, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  INCIDENT_MODULES, 
  INCIDENT_STATUSES, 
  type IncidentModule, 
  type IncidentStatus 
} from "@/types/incidents";

interface IncidentItem {
  id: string;
  incident_description: string;
  incident_status: IncidentStatus;
  module: IncidentModule;
  created_at: string;
}


export default function CoordenacaoIncidentesPage() {
  const navigate = useNavigate();
  const { activeEventId } = useEventContext();
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters and Pagination
  const [filterModule, setFilterModule] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 15;

  const fetchIncidents = useCallback(async (isLoadMore = false) => {
    if (!activeEventId) {
      setIncidents([]);
      setLoading(false);
      return;
    }

    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      let query = supabase
        .from("operational_incidents")
        .select("id, incident_description, incident_status, module, created_at")
        .eq("event_id", activeEventId)
        .order("created_at", { ascending: sortOrder === "asc" });

      if (filterModule !== "all") {
        query = query.eq("module", filterModule as any);
      }
      
      if (filterStatus !== "all") {
        query = query.eq("incident_status", filterStatus as any);
      }

      const from = (isLoadMore ? page : 0) * pageSize;
      const to = from + pageSize - 1;

      const { data, error: fetchError } = await query.range(from, to);
      
      if (fetchError) throw fetchError;
      
      const newItems = (data as any) || [];
      if (isLoadMore) {
        setIncidents(prev => [...prev, ...newItems]);
        setPage(prev => prev + 1);
      } else {
        setIncidents(newItems);
        setPage(1);
      }
      
      setHasMore(newItems.length === pageSize);
      setError(null);
    } catch (err: any) {
      console.error("Erro ao carregar ocorrências:", err);
      setError("Não foi possível carregar a lista de ocorrências.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeEventId, filterModule, filterStatus, sortOrder, page]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleLoadMore = () => {
    fetchIncidents(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/pwa/login", { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
      <PwaHeader 
        title="Ocorrências" 
        icon={AlertTriangle} 
        backTo="/pwa/coordenacao-tecnica" 
        onSignOut={handleSignOut} 
      />

      <main className="relative mx-auto max-w-md space-y-3 p-4">
        {activeEventId && (
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger className="h-9 bg-card/50 border-border/40 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3 w-3 opacity-50" />
                    <SelectValue placeholder="Módulo" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Módulos</SelectItem>
                  {(Object.entries(INCIDENT_MODULES) as [IncidentModule, any][]).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>

              </Select>
            </div>
            <div className="flex-1">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 bg-card/50 border-border/40 text-xs">
                  <div className="flex items-center gap-1.5">
                    <ClipboardList className="h-3 w-3 opacity-50" />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  {(Object.entries(INCIDENT_STATUSES) as [IncidentStatus, any][]).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>

              </Select>
            </div>
          </div>
        )}

        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}

        {!loading && !activeEventId && (
          <div className="text-center py-12 px-6 text-muted-foreground bg-card/50 rounded-2xl border border-dashed border-border/60">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30 text-yellow-500" />
            <h3 className="text-foreground font-semibold mb-1">Nenhum evento selecionado</h3>
            <p className="text-sm">Por favor, selecione um evento ativo no menu principal para visualizar as ocorrências.</p>
          </div>
        )}

        {!loading && activeEventId && error && (
          <div className="text-center py-12 px-6 text-muted-foreground bg-destructive/5 rounded-2xl border border-dashed border-destructive/30">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-destructive opacity-80" />
            <h3 className="text-foreground font-semibold mb-1">Erro de conexão</h3>
            <p className="text-sm mb-4">{error}</p>
            <Button 
              variant="outline"
              onClick={() => fetchIncidents()}
              className="text-xs font-bold uppercase tracking-wider"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {!loading && activeEventId && !error && incidents.length === 0 && (
          <div className="text-center py-12 px-6 text-muted-foreground bg-card/50 rounded-2xl border border-dashed border-border/60">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <h3 className="text-foreground font-semibold mb-1">Tudo em ordem por aqui</h3>
            <p className="text-sm">Nenhuma ocorrência operacional registrada com estes filtros.</p>
          </div>
        )}

        {incidents.map((inc) => (
          <Card 
            key={inc.id} 
            className="cursor-pointer hover:bg-accent/50 active:scale-[0.98] transition-all border-border/60 bg-card/95 shadow-app-sm"
            onClick={() => navigate(`/pwa/coordenacao-tecnica/incidente/${inc.id}`)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                  {INCIDENT_MODULES[inc.module]?.label ?? inc.module}
                </Badge>
                <Badge 
                  variant={INCIDENT_STATUSES[inc.incident_status]?.variant ?? "outline"}
                  className="text-[10px] uppercase font-bold"
                >
                  {INCIDENT_STATUSES[inc.incident_status]?.label ?? inc.incident_status}
                </Badge>
              </div>

              
              <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                {inc.incident_description}
              </p>
              
              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                <span>{format(new Date(inc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                <span className="flex items-center gap-1">
                  Ver detalhes <ClipboardList className="h-3 w-3" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}

        {hasMore && (
          <div className="pt-2 pb-8">
            <Button 
              variant="outline" 
              className="w-full h-12 rounded-xl text-xs font-bold uppercase tracking-widest border-border/60"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Carregando..." : "Carregar mais ocorrências"}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
