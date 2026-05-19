import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Check, X, PlayCircle, Search, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_LABEL: Record<string, { label: string; tone: "default" | "secondary" | "destructive" | "outline" }> = {
  requested: { label: "Solicitada",  tone: "outline" },
  approved:  { label: "Aprovada",    tone: "default" },
  rejected:  { label: "Rejeitada",   tone: "destructive" },
  executed:  { label: "Executada",   tone: "secondary" },
  cancelled: { label: "Cancelada",   tone: "destructive" },
};

const REASON_LABEL: Record<string, string> = {
  lesao:       "Lesão",
  desistencia: "Desistência",
  disciplinar: "Disciplinar",
  convocacao:  "Convocação externa",
  outro:       "Outro",
};

export default function SubstituicaoAdminPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const eventId = useActiveEventId();

  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pendingDecision, setPendingDecision] = useState<{
    id: string;
    action: "approve" | "reject" | "execute" | "cancel";
  } | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState("");

  // Etapas para filtro
  const { data: stages = [] } = useQuery({
    queryKey: ["sub_admin_stages", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("event_stages")
        .select("id, name")
        .eq("event_id", eventId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["substituicoes_admin", eventId, stageFilter, statusFilter],
    enabled: !!eventId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("substitutions")
        .select(`
          *,
          delegations(id, institutions(name)),
          sport_events(id, name, sports(name), categories(name)),
          event_stages(id, name),
          out_part:participants!substitutions_participant_out_id_fkey(id, people(full_name)),
          in_part:participants!substitutions_participant_in_id_fkey(id, people(full_name))
        `)
        .eq("event_id", eventId)
        .order("requested_at", { ascending: false });

      if (stageFilter !== "all") q = q.eq("event_stage_id", stageFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const term = search.toLowerCase();
    return rows.filter((r: any) => {
      const out   = r.out_part?.people?.full_name?.toLowerCase() ?? "";
      const inn   = r.in_part?.people?.full_name?.toLowerCase() ?? "";
      const sport = r.sport_events?.name?.toLowerCase() ?? "";
      const deleg = r.delegations?.institutions?.name?.toLowerCase() ?? "";
      const proto = (r.protocol_number ?? "").toLowerCase();
      return out.includes(term) || inn.includes(term) || sport.includes(term) || deleg.includes(term) || proto.includes(term);
    });
  }, [rows, search]);

  const approveMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("substitutions")
        .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "requested");
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Substituição aprovada"); qc.invalidateQueries({ queryKey: ["substituicoes_admin"] }); },
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
    onSuccess: () => { toast.success("Substituição rejeitada"); qc.invalidateQueries({ queryKey: ["substituicoes_admin"] }); },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("substitutions")
        .update({ status: "cancelled", rejected_by: user?.id, rejected_at: new Date().toISOString() })
        .eq("id", id)
        .in("status", ["requested", "approved"]);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Substituição cancelada"); qc.invalidateQueries({ queryKey: ["substituicoes_admin"] }); },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const executeMut = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("execute_substitution", { p_substitution_id: id });
      if (error) throw error;
      return data as { ok: boolean; already_executed?: boolean };
    },
    onSuccess: (res) => {
      toast.success(res?.already_executed ? "Substituição já estava executada" : "Substituição executada com sucesso");
      qc.invalidateQueries({ queryKey: ["substituicoes_admin"] });
    },
    onError: (e: Error) => toast.error(`Erro ao executar: ${e.message}`),
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Gestão de Substituições</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aprovar, rejeitar e executar substituições de atletas em todas as etapas.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase text-muted-foreground">Etapa</label>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(stages as any[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <label className="text-xs font-medium uppercase text-muted-foreground">Busca</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Atleta, delegação, modalidade ou protocolo…"
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
                <TableHead>Protocolo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Delegação</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Sai</TableHead>
                <TableHead>Entra</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}><Skeleton className="h-9 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-16 text-muted-foreground">
                    <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Nenhuma substituição encontrada com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r: any) => {
                  const status = STATUS_LABEL[r.status] ?? { label: r.status, tone: "outline" as const };
                  const reasonLabel = r.reason_code ? REASON_LABEL[r.reason_code] ?? r.reason_code : "—";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {r.protocol_number ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(r.requested_at), "dd/MM/yy HH:mm")}
                      </TableCell>
                      <TableCell className="text-xs">{r.delegations?.institutions?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.event_stages?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        <div>{r.sport_events?.name ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.sport_events?.sports?.name} · {r.sport_events?.categories?.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        {r.out_part?.people?.full_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {r.in_part?.people?.full_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <Badge variant={status.tone}>{status.label}</Badge>
                          {r.rejection_notes && (
                            <p className="text-[10px] text-destructive line-clamp-1">{r.rejection_notes}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {r.status === "requested" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => { setPendingDecision({ id: r.id, action: "approve" }); }}
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
                          {r.status === "approved" && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 px-2 text-xs"
                              onClick={() => setPendingDecision({ id: r.id, action: "execute" })}
                              disabled={executeMut.isPending}
                            >
                              <PlayCircle className="h-3 w-3 mr-1" /> Executar
                            </Button>
                          )}
                          {(r.status === "requested" || r.status === "approved") && (
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

      <AlertDialog
        open={!!pendingDecision}
        onOpenChange={(open) => { if (!open) setPendingDecision(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDecision?.action === "approve"  && "Aprovar substituição"}
              {pendingDecision?.action === "reject"   && "Rejeitar substituição"}
              {pendingDecision?.action === "execute"  && "Executar substituição"}
              {pendingDecision?.action === "cancel"   && "Cancelar substituição"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDecision?.action === "approve"  && "A substituição será marcada como aprovada e poderá ser executada em seguida."}
              {pendingDecision?.action === "reject"   && "A substituição será rejeitada. Informe o motivo da rejeição."}
              {pendingDecision?.action === "execute"  && "A inscrição do atleta que sai será cancelada (cancelled_by_substitution) e uma nova inscrição será criada para o atleta que entra. Lineups e consumos anteriores não são afetados."}
              {pendingDecision?.action === "cancel"   && "A substituição será cancelada. Use quando o pedido foi feito por engano."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingDecision?.action === "reject" && (
            <div className="space-y-1 py-2">
              <label className="text-xs font-medium">Motivo da rejeição (obrigatório)</label>
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
              disabled={pendingDecision?.action === "reject" && !rejectionNotes.trim()}
              onClick={() => {
                if (!pendingDecision) return;
                if (pendingDecision.action === "approve") {
                  approveMut.mutate(pendingDecision.id);
                } else if (pendingDecision.action === "reject") {
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
