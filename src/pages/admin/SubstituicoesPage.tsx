import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Check, X, PlayCircle, Search, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import RequestSubstitutionDialog from "@/components/admin/competition/RequestSubstitutionDialog";

const STATUS_LABEL: Record<string, { label: string; tone: "default" | "secondary" | "destructive" | "outline" }> = {
  requested: { label: "Solicitada", tone: "outline" },
  approved: { label: "Aprovada", tone: "default" },
  rejected: { label: "Rejeitada", tone: "destructive" },
  executed: { label: "Executada", tone: "secondary" },
  cancelled: { label: "Cancelada", tone: "destructive" },
};

const REASON_LABEL: Record<string, string> = {
  lesao: "Lesão",
  desistencia: "Desistência",
  disciplinar: "Disciplinar",
  convocacao: "Convocação externa",
  outro: "Outro",
};

export default function SubstituicoesPage() {
  const qc = useQueryClient();
  const { hasRole, user } = useAuth();
  const eventId = useActiveEventId();
  const { stageId } = useStageScope();

  const canDecide = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");
  const canRequest = canDecide || hasRole("delegacao");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [pendingDecision, setPendingDecision] = useState<{ id: string; action: "reject" | "execute" | "cancel" } | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["substitutions", eventId, stageId, statusFilter],
    enabled: !!eventId && !!stageId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("substitutions")
        .select(`
          *,
          delegations(id, institutions(name)),
          sport_events(id, name, sports(name), categories(name)),
          out_part:participants!substitutions_participant_out_id_fkey(id, people(full_name)),
          in_part:participants!substitutions_participant_in_id_fkey(id, people(full_name))
        `)
        .eq("event_id", eventId)
        .eq("event_stage_id", stageId)
        .order("requested_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const term = search.toLowerCase();
    return rows.filter((r) => {
      const out = r.out_part?.people?.full_name?.toLowerCase() || "";
      const inn = r.in_part?.people?.full_name?.toLowerCase() || "";
      const sportEvt = r.sport_events?.name?.toLowerCase() || "";
      const deleg = r.delegations?.institutions?.name?.toLowerCase() || "";
      return out.includes(term) || inn.includes(term) || sportEvt.includes(term) || deleg.includes(term);
    });
  }, [rows, search]);

  const approveMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("substitutions")
        .update({
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "requested");
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Substituição aprovada"); qc.invalidateQueries({ queryKey: ["substitutions"] }); },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const rejectMut = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await (supabase as any)
        .from("substitutions")
        .update({
          status: "rejected",
          rejected_by: user?.id,
          rejected_at: new Date().toISOString(),
          rejection_notes: notes || null,
        })
        .eq("id", id)
        .eq("status", "requested");
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Substituição rejeitada"); qc.invalidateQueries({ queryKey: ["substitutions"] }); },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("substitutions")
        .update({
          status: "cancelled",
          rejected_by: user?.id,
          rejected_at: new Date().toISOString(),
        })
        .eq("id", id)
        .in("status", ["requested", "approved"]);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Substituição cancelada"); qc.invalidateQueries({ queryKey: ["substitutions"] }); },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const executeMut = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("execute_substitution", { p_substitution_id: id });
      if (error) throw error;
      return data as { ok: boolean; already_executed?: boolean };
    },
    onSuccess: (res) => {
      toast.success(res?.already_executed ? "Substituição já estava executada" : "Substituição executada");
      qc.invalidateQueries({ queryKey: ["substitutions"] });
    },
    onError: (e: Error) => toast.error(`Erro ao executar: ${e.message}`),
  });

  if (!stageId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
        <ArrowLeftRight className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">Selecione uma etapa</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Substituições</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trocas regulamentares de atletas em provas. Auditoria imutável; lineups passados ficam com a pessoa antiga.
          </p>
        </div>
        {canRequest && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Nova substituição
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium uppercase text-muted-foreground">Busca rápida</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Atleta, prova ou delegação…"
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
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Solicitada em</TableHead>
                <TableHead>Delegação</TableHead>
                <TableHead>Prova</TableHead>
                <TableHead>Sai</TableHead>
                <TableHead>Entra</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Nenhuma substituição encontrada para esta etapa.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const status = STATUS_LABEL[r.status] ?? { label: r.status, tone: "outline" as const };
                  const reasonLabel = r.reason_code ? REASON_LABEL[r.reason_code] ?? r.reason_code : "—";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(r.requested_at), "dd/MM/yy HH:mm")}
                      </TableCell>
                      <TableCell className="text-xs">{r.delegations?.institutions?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        <div>{r.sport_events?.name ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.sport_events?.sports?.name} · {r.sport_events?.categories?.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        {r.out_part?.people?.full_name ?? r.participant_out_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {r.in_part?.people?.full_name ?? r.participant_in_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{reasonLabel}</div>
                        {r.reason && <div className="text-[10px] text-muted-foreground line-clamp-2">{r.reason}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.tone}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {r.status === "requested" && canDecide && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => approveMut.mutate(r.id)}
                                disabled={approveMut.isPending}
                              >
                                <Check className="h-3 w-3 mr-1" /> Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-destructive border-destructive/40"
                                onClick={() => { setRejectionNotes(""); setPendingDecision({ id: r.id, action: "reject" }); }}
                              >
                                <X className="h-3 w-3 mr-1" /> Rejeitar
                              </Button>
                            </>
                          )}
                          {r.status === "approved" && canDecide && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 px-2 text-xs"
                              onClick={() => setPendingDecision({ id: r.id, action: "execute" })}
                            >
                              <PlayCircle className="h-3 w-3 mr-1" /> Executar
                            </Button>
                          )}
                          {(r.status === "requested" || r.status === "approved") && canDecide && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-muted-foreground"
                              onClick={() => setPendingDecision({ id: r.id, action: "cancel" })}
                            >
                              Cancelar
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
        </CardContent>
      </Card>

      <RequestSubstitutionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eventId={eventId}
        stageId={stageId}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["substitutions"] })}
      />

      <AlertDialog
        open={!!pendingDecision}
        onOpenChange={(open) => { if (!open) setPendingDecision(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDecision?.action === "reject" && "Rejeitar substituição"}
              {pendingDecision?.action === "execute" && "Executar substituição"}
              {pendingDecision?.action === "cancel" && "Cancelar substituição"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDecision?.action === "reject" && "A substituição será marcada como rejeitada. Você pode adicionar uma observação."}
              {pendingDecision?.action === "execute" && "A inscrição esportiva do atleta de saída será marcada como cancelled_by_substitution e uma nova inscrição será criada para o atleta de entrada. Lineups e consumos passados não são afetados."}
              {pendingDecision?.action === "cancel" && "A substituição será marcada como cancelada. Use isso quando o pedido perdeu o sentido (ex.: foi feito por engano)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingDecision?.action === "reject" && (
            <div className="space-y-1 py-2">
              <label className="text-xs font-medium">Observação (opcional)</label>
              <Input
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Ex.: prazo regulamentar expirado"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDecision) return;
                if (pendingDecision.action === "reject") {
                  rejectMut.mutate({ id: pendingDecision.id, notes: rejectionNotes });
                } else if (pendingDecision.action === "execute") {
                  executeMut.mutate(pendingDecision.id);
                } else if (pendingDecision.action === "cancel") {
                  cancelMut.mutate(pendingDecision.id);
                }
                setPendingDecision(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
