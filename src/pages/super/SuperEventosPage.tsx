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
              <TableHead className="text-zinc-400 text-center">Modo Registros (Flag)</TableHead>
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
                    <div className="flex flex-col items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-1.5 rounded-full border border-zinc-700/50">
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wider",
                                event.registros_mode_enabled ? "text-amber-400" : "text-zinc-500"
                              )}>
                                {event.registros_mode_enabled ? "Registros" : "Competição"}
                              </span>
                              <Switch 
                                checked={event.registros_mode_enabled}
                                onCheckedChange={() => setConfirmDialog({ 
                                  open: true, 
                                  eventId: event.id, 
                                  current: event.registros_mode_enabled,
                                  eventName: event.name 
                                })}
                                className="data-[state=checked]:bg-amber-500"
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            <p>
                              {event.registros_mode_enabled 
                                ? "Modo Registros ATIVO: Caminho simplificado para registro de partidas e resultados." 
                                : "Modo Competição COMPLEXO: Estrutura completa de fases, grupos e chaves."}
                            </p>
                            <p className="mt-1 opacity-70">Clique no toggle para alterar o modo do evento.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <button
                        onClick={() => setHistorySheet({ open: true, eventId: event.id, eventName: event.name })}
                        className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase font-bold tracking-tighter"
                      >
                        <History className="h-3 w-3" />
                        Ver Histórico
                      </button>
                    </div>
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

      <AlertDialog open={confirmDialog.open} onOpenChange={(o) => setConfirmDialog({ ...confirmDialog, open: o })}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              Confirmar alteração de modo
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 space-y-4 pt-2">
              <p>
                Você está alterando o modo do evento <strong className="text-zinc-200">"{confirmDialog.eventName}"</strong> para 
                <strong className="text-amber-400"> {confirmDialog.current ? "Competição Complexa" : "Modo Registros"}</strong>.
              </p>
              
              {confirmDialog.current ? (
                <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-700 space-y-2">
                  <p className="text-xs">
                    <strong className="text-zinc-300">Impacto da Desativação:</strong>
                  </p>
                  <ul className="list-disc list-inside text-[11px] space-y-1">
                    <li>Oculta o módulo de Registros simplificado.</li>
                    <li>Libera novamente o módulo de Competição estruturado.</li>
                    <li>Partidas registradas no modo anterior continuam operacionais.</li>
                  </ul>
                </div>
              ) : (
                <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 space-y-2">
                  <p className="text-xs">
                    <strong className="text-amber-400">Impacto da Ativação:</strong>
                  </p>
                  <ul className="list-disc list-inside text-[11px] space-y-1">
                    <li>Ativa o caminho simplificado de registro de partidas.</li>
                    <li>Oculta o módulo de Competição estruturado para todos os perfis.</li>
                    <li>Simplifica a operação para eventos de menor complexidade.</li>
                  </ul>
                </div>
              )}
              
              <p className="text-xs italic">Esta ação será registrada na trilha de auditoria do sistema.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => toggleRegistros(confirmDialog.eventId, confirmDialog.current)}
              className="bg-amber-600 hover:bg-amber-700 text-white border-none"
            >
              Confirmar Alteração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={historySheet.open} onOpenChange={(o) => setHistorySheet({ ...historySheet, open: o })}>
        <SheetContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-zinc-100">Histórico de Alterações</SheetTitle>
            <SheetDescription className="text-zinc-400">
              Rastreabilidade do Modo Registros para: <br/>
              <span className="font-bold text-zinc-200">{historySheet.eventName}</span>
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            {isLoadingHistory ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-zinc-800 h-20 rounded-lg" />
              ))
            ) : logHistory?.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <History className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>Nenhuma alteração registrada ainda.</p>
              </div>
            ) : (
              logHistory?.map((log: any) => (
                <div key={log.id} className="bg-zinc-800/50 border border-zinc-800 rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      log.new_value ? "text-amber-400 border-amber-400/20" : "text-zinc-400 border-zinc-700"
                    )}>
                      {log.new_value ? "ATIVADO" : "DESATIVADO"}
                    </Badge>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-300">
                    <div className="h-6 w-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold">
                      {log.profiles?.full_name?.charAt(0) || "U"}
                    </div>
                    <span>{log.profiles?.full_name || "Usuário do Sistema"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
