import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Calendar, Globe, CalendarRange, ListChecks, History, AlertTriangle, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEventContext } from "@/contexts/EventContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";

export default function SuperEventosPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; eventId: string; current: boolean; eventName: string }>({ 
    open: false, eventId: "", current: false, eventName: "" 
  });
  const [historySheet, setHistorySheet] = useState<{ open: boolean; eventId: string; eventName: string }>({
    open: false, eventId: "", eventName: ""
  });
  const navigate = useNavigate();
  const { setActiveEventId } = useEventContext();

  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ["super-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = (events ?? []).filter((e) => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleEnterEvent = (eventId: string) => {
    setActiveEventId(eventId);
    navigate("/admin");
  };

  const togglePublic = async (eventId: string, current: boolean) => {
    const { error } = await supabase
      .from("events")
      .update({ is_public: !current })
      .eq("id", eventId);
    if (error) toast.error(error.message);
    else {
      toast.success(current ? "Evento ocultado do portal público" : "Evento visível no portal público");
      refetch();
    }
  };

  const toggleAgenda = async (eventId: string, current: boolean) => {
    const { error } = await supabase
      .from("events")
      .update({ public_agenda_published: !current })
      .eq("id", eventId);
    if (error) toast.error(error.message);
    else {
      toast.success(current ? "Agenda removida do portal público" : "Agenda publicada no portal público");
      refetch();
    }
  };

  const toggleRegistros = async (eventId: string, current: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Perform update
    const { error: updateError } = await supabase
      .from("events")
      .update({ registros_mode_enabled: !current })
      .eq("id", eventId);
    
    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    // Log the change
    const { error: logError } = await supabase
      .from("registros_mode_logs")
      .insert({
        event_id: eventId,
        user_id: user?.id,
        old_value: current,
        new_value: !current
      });

    if (logError) console.error("Erro ao registrar log de auditoria:", logError);

    toast.success(!current ? "Modo Registros ativado com sucesso" : "Modo Registros desativado");
    refetch();
    setConfirmDialog({ ...confirmDialog, open: false });
  };

  const { data: logHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["registros-history", historySheet.eventId],
    queryFn: async () => {
      if (!historySheet.eventId) return [];
      const { data, error } = await supabase
        .from("registros_mode_logs")
        .select(`
          id,
          created_at,
          old_value,
          new_value,
          profiles (
            full_name
          )
        `)
        .eq("event_id", historySheet.eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: historySheet.open
  });

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    archived: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestão de Eventos</h1>
        <p className="text-sm text-zinc-400 mt-1">Gerencie a visibilidade pública e o status de todos os eventos.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-zinc-900 border-zinc-800 text-zinc-100">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="archived">Arquivado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
              <TableHead className="text-zinc-400">Nome</TableHead>
              <TableHead className="text-zinc-400">Ano</TableHead>
              <TableHead className="text-zinc-400 text-center">Portal Público</TableHead>
              <TableHead className="text-zinc-400 text-center">Agenda Pública</TableHead>
              <TableHead className="text-zinc-400 text-center">Modo Registros</TableHead>
              <TableHead className="text-zinc-400">Status</TableHead>
              <TableHead className="text-zinc-400 text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-zinc-800">
                  <TableCell><Skeleton className="h-4 w-40 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 bg-zinc-800 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 bg-zinc-800 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 bg-zinc-800 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 bg-zinc-800" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow className="border-zinc-800">
                <TableCell colSpan={7} className="text-center py-12 text-zinc-500">
                  <Calendar className="mx-auto h-10 w-10 mb-2 text-zinc-600" />
                  <p>Nenhum evento encontrado.</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((event) => (
                <TableRow key={event.id} className="border-zinc-800 hover:bg-zinc-800/50 text-zinc-200">
                  <TableCell className="font-medium">{event.name}</TableCell>
                  <TableCell>{event.year}</TableCell>
                  <TableCell className="text-center">
                    <button 
                      onClick={() => togglePublic(event.id, event.is_public)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        event.is_public ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                      )}
                      title={event.is_public ? "Ocultar do Portal" : "Mostrar no Portal"}
                    >
                      <Globe className="h-4 w-4" />
                    </button>
                  </TableCell>
                  <TableCell className="text-center">
                    <button 
                      onClick={() => toggleAgenda(event.id, event.public_agenda_published)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        event.public_agenda_published ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                      )}
                      title={event.public_agenda_published ? "Remover Agenda Pública" : "Publicar Agenda Pública"}
                    >
                      <CalendarRange className="h-4 w-4" />
                    </button>
                  </TableCell>
                  <TableCell className="text-center">
                    <button 
                      onClick={() => toggleRegistros(event.id, event.registros_mode_enabled)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        event.registros_mode_enabled ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                      )}
                      title={event.registros_mode_enabled ? "Desativar Modo Registros" : "Ativar Modo Registros"}
                    >
                      <ListChecks className="h-4 w-4" />
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[event.status] || "text-zinc-400"}>
                      {event.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={() => handleEnterEvent(event.id)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-medium px-3 py-1.5 rounded border border-amber-400/20 hover:border-amber-400/50 transition-colors"
                    >
                      Entrar →
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
