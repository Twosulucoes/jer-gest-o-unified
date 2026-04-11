import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, AlertTriangle, Search, Eye, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface Irregularity {
  id: string;
  event_id: string;
  participant_id: string;
  rule_code: string;
  severity: string;
  status: string;
  message: string;
  context: Record<string, unknown>;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  participant?: {
    id: string;
    person: { full_name: string } | null;
    delegation: { id: string; institution: { name: string } | null } | null;
  };
}

const RULE_LABELS: Record<string, string> = {
  LIMIT_COLLECTIVE_TEAMS: "Equipes coletivas",
  LIMIT_INDIVIDUAL_SPORTS: "Modalidades individuais",
  LIMIT_EVENTS_PER_SPORT: "Provas por modalidade",
};

const SEVERITY_COLORS: Record<string, string> = {
  blocking: "destructive",
  warning: "secondary",
};

export default function IrregularidadesPage() {
  const activeEventId = useActiveEventId();
  const { activeEvent } = useEventContext();
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

  const [searchName, setSearchName] = useState("");
  const [filterRule, setFilterRule] = useState<string>("all");
  const [selectedIrr, setSelectedIrr] = useState<Irregularity | null>(null);

  const { data: irregularities = [], isLoading } = useQuery({
    queryKey: ["participation-irregularities", activeEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participation_irregularities")
        .select(`
          *,
          participant:participants!participation_irregularities_participant_id_fkey(
            id,
            person:people!participants_person_id_fkey(full_name),
            delegation:delegations!participants_delegation_id_fkey(
              id,
              institution:institutions!delegations_institution_id_fkey(name)
            )
          )
        `)
        .eq("event_id", activeEventId)
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Irregularity[];
    },
  });

  const recomputeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("recompute_participation_irregularities", {
        p_event_id: activeEventId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: unknown) => {
      const result = data as { created?: { total?: number } };
      toast.success(`Irregularidades recalculadas. ${result?.created?.total ?? 0} encontradas.`);
      queryClient.invalidateQueries({ queryKey: ["participation-irregularities", activeEventId] });
    },
    onError: (err: Error) => toast.error("Erro ao recalcular: " + err.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("participation_irregularities")
        .update({
          status,
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      queryClient.invalidateQueries({ queryKey: ["participation-irregularities", activeEventId] });
      setSelectedIrr(null);
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  const filtered = irregularities.filter((irr) => {
    if (filterRule !== "all" && irr.rule_code !== filterRule) return false;
    if (searchName) {
      const name = irr.participant?.person?.full_name?.toLowerCase() ?? "";
      const inst = irr.participant?.delegation?.institution?.name?.toLowerCase() ?? "";
      const q = searchName.toLowerCase();
      if (!name.includes(q) && !inst.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Irregularidades</h1>
          {activeEvent && (
            <p className="text-sm text-muted-foreground mt-1">
              Evento: <strong>{activeEvent.name}</strong> ({activeEvent.year})
            </p>
          )}
        </div>
        <Button onClick={() => recomputeMutation.mutate()} disabled={recomputeMutation.isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${recomputeMutation.isPending ? "animate-spin" : ""}`} />
          Recalcular irregularidades
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou escola…"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterRule} onValueChange={setFilterRule}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Todas as regras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as regras</SelectItem>
            {Object.entries(RULE_LABELS).map(([code, label]) => (
              <SelectItem key={code} value={code}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="flex gap-4">
        <Badge variant="outline" className="text-sm">
          {filtered.length} irregularidade{filtered.length !== 1 ? "s" : ""} aberta{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhuma irregularidade encontrada</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Clique em "Recalcular" para verificar novamente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((irr) => (
            <Card key={irr.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setSelectedIrr(irr)}>
              <CardContent className="flex items-center gap-4 py-4">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {irr.participant?.person?.full_name ?? "Participante"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {irr.participant?.delegation?.institution?.name ?? "—"} • {RULE_LABELS[irr.rule_code] ?? irr.rule_code}
                  </p>
                </div>
                <Badge variant={SEVERITY_COLORS[irr.severity] as "destructive" | "secondary" ?? "secondary"}>
                  {irr.severity}
                </Badge>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  Limite: {String((irr.context as Record<string, unknown>)?.limit ?? "?")} | Encontrado: {String((irr.context as Record<string, unknown>)?.count ?? "?")}
                </div>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedIrr} onOpenChange={(open) => !open && setSelectedIrr(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhe da Irregularidade</DialogTitle>
            <DialogDescription>
              {selectedIrr?.participant?.person?.full_name ?? "Participante"}
            </DialogDescription>
          </DialogHeader>
          {selectedIrr && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Atleta</p>
                  <p className="font-medium">{selectedIrr.participant?.person?.full_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Escola/Delegação</p>
                  <p className="font-medium">{selectedIrr.participant?.delegation?.institution?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Regra violada</p>
                  <p className="font-medium">{RULE_LABELS[selectedIrr.rule_code] ?? selectedIrr.rule_code}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Severidade</p>
                  <Badge variant={SEVERITY_COLORS[selectedIrr.severity] as "destructive" | "secondary" ?? "secondary"}>
                    {selectedIrr.severity}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Limite</p>
                  <p className="font-medium">{String((selectedIrr.context as Record<string, unknown>)?.limit ?? "—")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Encontrado</p>
                  <p className="font-medium">{String((selectedIrr.context as Record<string, unknown>)?.count ?? "—")}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Mensagem</p>
                <p className="text-sm bg-muted p-3 rounded-md">{selectedIrr.message}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Contexto (JSON)</p>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-32">
                  {JSON.stringify(selectedIrr.context, null, 2)}
                </pre>
              </div>

              {/* Links */}
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/admin/participantes/${selectedIrr.participant_id}`}>
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Abrir atleta
                  </Link>
                </Button>
                {selectedIrr.participant?.delegation?.id && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/delegacoes/${selectedIrr.participant.delegation.id}`}>
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Abrir delegação
                    </Link>
                  </Button>
                )}
              </div>

              {/* Actions */}
              {canEdit && (
                <div className="flex gap-3 pt-2 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatusMutation.mutate({ id: selectedIrr.id, status: "resolved" })}
                    disabled={updateStatusMutation.isPending}
                  >
                    <CheckCircle className="mr-1 h-4 w-4 text-green-600" />
                    Marcar resolvida
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatusMutation.mutate({ id: selectedIrr.id, status: "ignored" })}
                    disabled={updateStatusMutation.isPending}
                  >
                    <XCircle className="mr-1 h-4 w-4 text-yellow-600" />
                    Marcar ignorada
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
