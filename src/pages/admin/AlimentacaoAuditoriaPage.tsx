import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";
import { useAuth } from "@/hooks/useAuth";
import { ShieldCheck, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ModuleStateBoundary } from "@/components/shared/ModuleStateBoundary";

type ActionFilter = "all" | "insert" | "update" | "delete" | "reverse";

const ACTION_BADGE: Record<string, { label: string; className: string }> = {
  insert: { label: "Inserção", className: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800" },
  update: { label: "Atualização", className: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-800" },
  delete: { label: "Exclusão", className: "bg-muted text-muted-foreground border-border" },
  reverse: { label: "Estorno", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

const REASON_LABELS: Record<string, string> = {
  duplicidade: "Duplicidade",
  participante_errado: "Participante errado",
  janela_errada: "Janela errada",
  lancamento_acidental: "Lançamento acidental",
  incidente_operacional: "Incidente operacional",
};

interface AuditRow {
  id: string;
  action: string;
  consumption_id: string | null;
  meal_window_id: string | null;
  participant_id: string | null;
  before_data: any;
  after_data: any;
  actor_id: string | null;
  actor_role: string | null;
  reason: string | null;
  created_at: string;
}

export default function AlimentacaoAuditoriaPage() {
  const eventId = useActiveEventId();
  const { stageId } = useStageScope();
  const { hasRole } = useAuth();
  const canView = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const logsQuery = useQuery({
    queryKey: ["meal_audit_logs", eventId, stageId, actionFilter],
    queryFn: async () => {
      let q = (supabase.from("meal_audit_logs") as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
    enabled: canView,
  });

  const windowIds = useMemo(
    () => Array.from(new Set((logsQuery.data ?? []).map((l) => l.meal_window_id).filter(Boolean) as string[])),
    [logsQuery.data],
  );
  const participantIds = useMemo(
    () => Array.from(new Set((logsQuery.data ?? []).map((l) => l.participant_id).filter(Boolean) as string[])),
    [logsQuery.data],
  );
  const actorIds = useMemo(
    () => Array.from(new Set((logsQuery.data ?? []).map((l) => l.actor_id).filter(Boolean) as string[])),
    [logsQuery.data],
  );

  const windowsQuery = useQuery({
    queryKey: ["meal_windows-for-audit", windowIds],
    queryFn: async () => {
      if (!windowIds.length) return [];
      const { data, error } = await supabase
        .from("meal_windows")
        .select("id, label, service_date, start_time, end_time, meal_type:meal_types(name), event_id, event_stage_id")
        .in("id", windowIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: windowIds.length > 0,
  });

  const peopleQuery = useQuery({
    queryKey: ["audit-people", participantIds],
    queryFn: async () => {
      if (!participantIds.length) return { participants: [], people: [] };
      const { data: parts } = await supabase.from("participants").select("id, person_id").in("id", participantIds);
      const personIds = (parts ?? []).map((p) => p.person_id);
      const { data: people } = personIds.length
        ? await supabase.from("people").select("id, full_name, cpf").in("id", personIds)
        : { data: [] as any[] };
      return { participants: parts ?? [], people: people ?? [] };
    },
    enabled: participantIds.length > 0,
  });

  const actorsQuery = useQuery({
    queryKey: ["audit-actors", actorIds],
    queryFn: async () => {
      if (!actorIds.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", actorIds);
      return data ?? [];
    },
    enabled: actorIds.length > 0,
  });

  const windowsMap = useMemo(() => new Map((windowsQuery.data ?? []).map((w: any) => [w.id, w])), [windowsQuery.data]);
  const partsMap = useMemo(
    () => new Map((peopleQuery.data?.participants ?? []).map((p: any) => [p.id, p])),
    [peopleQuery.data],
  );
  const peopleMap = useMemo(
    () => new Map((peopleQuery.data?.people ?? []).map((p: any) => [p.id, p])),
    [peopleQuery.data],
  );
  const actorsMap = useMemo(() => new Map((actorsQuery.data ?? []).map((a: any) => [a.id, a])), [actorsQuery.data]);

  const filteredRows = useMemo(() => {
    const rows = logsQuery.data ?? [];
    const eventScopedIds = new Set(
      (windowsQuery.data ?? [])
        .filter((w: any) => (eventId ? w.event_id === eventId : true) && (stageId ? w.event_stage_id === stageId : true))
        .map((w: any) => w.id),
    );

    return rows
      .filter((r) => {
        if (!r.meal_window_id) return false;
        return eventScopedIds.has(r.meal_window_id);
      })
      .filter((r) => {
        if (!searchTerm) return true;
        const part = r.participant_id ? partsMap.get(r.participant_id) : null;
        const person = part ? peopleMap.get(part.person_id) : null;
        const actor = r.actor_id ? actorsMap.get(r.actor_id) : null;
        const haystack = [person?.full_name, person?.cpf, actor?.full_name, r.reason].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(searchTerm.toLowerCase());
      });
  }, [logsQuery.data, windowsQuery.data, eventId, stageId, searchTerm, partsMap, peopleMap, actorsMap]);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" aria-hidden /> Auditoria de Alimentação
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trilha imutável de inserções, alterações, exclusões e estornos em consumos.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" aria-hidden /> Filtros
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar por participante, CPF, operador ou motivo…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full md:w-72"
              />
              <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as ActionFilter)}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="insert">Inserção</SelectItem>
                  <SelectItem value="update">Atualização</SelectItem>
                  <SelectItem value="delete">Exclusão</SelectItem>
                  <SelectItem value="reverse">Estorno</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ModuleStateBoundary
            isForbidden={!canView}
            isLoading={logsQuery.isLoading}
            isError={logsQuery.isError}
            error={logsQuery.error}
            isEmpty={!logsQuery.isLoading && filteredRows.length === 0}
            emptyMessage="Nenhum registro de auditoria encontrado."
            emptyHint={searchTerm || actionFilter !== "all" ? "Ajuste os filtros para ver mais resultados." : undefined}
            onRetry={() => logsQuery.refetch()}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Participante</TableHead>
                  <TableHead>Janela</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r) => {
                  const part = r.participant_id ? partsMap.get(r.participant_id) : null;
                  const person = part ? peopleMap.get(part.person_id) : null;
                  const win = r.meal_window_id ? (windowsMap.get(r.meal_window_id) as any) : null;
                  const actor = r.actor_id ? actorsMap.get(r.actor_id) : null;
                  const badge = ACTION_BADGE[r.action] ?? { label: r.action, className: "" };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${badge.className}`}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{person?.full_name ?? "—"}</span>
                          <span className="text-[10px] text-muted-foreground font-mono uppercase">
                            {person?.cpf || (r.participant_id ? r.participant_id.slice(0, 8) : "—")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">{win?.label || win?.meal_type?.name || "—"}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {win?.service_date
                              ? new Date(win.service_date + "T00:00:00").toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                })
                              : "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs">{actor?.full_name ?? "—"}</span>
                          {r.actor_role && (
                            <span className="text-[10px] text-muted-foreground">{r.actor_role}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.reason ? (
                          <Badge variant="outline" className="text-[10px]">
                            {REASON_LABELS[r.reason] ?? r.reason}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ModuleStateBoundary>
        </CardContent>
      </Card>
    </div>
  );
}
