import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { History, Filter, Download, Clock, User } from "lucide-react";

interface Props {
  eventId: string;
  sportEventId: string;
}

// Action labels for human-readable display
const ACTION_LABELS: Record<string, string> = {
  dispute_builder_save: "Disputas salvas (montador)",
  inline_result_save: "Resultado lançado (inline)",
  winner_progression_save: "Progressão de vencedor",
  homologar_classificado_unico_apto: "Homologação — classificado direto",
  dispute_publish: "Disputas publicadas",
  dispute_unpublish: "Publicação revertida",
  heat_builder_save: "Baterias salvas (montador)",
  generate_knockout: "Chave eliminatória gerada",
  match_create: "Partida criada",
  match_update: "Partida atualizada",
  result_launch: "Resultado lançado",
  result_validate: "Resultado validado",
  result_publish: "Resultado publicado",
  agenda_update: "Agenda atualizada",
  seeding_save: "Sorteio/seeding salvo",
  structure_save: "Estrutura salva",
  phase_transition: "Transição de fase",
};

const ACTION_FILTERS = [
  { value: "all", label: "Todas as ações" },
  { value: "dispute", label: "Montagem / Disputas" },
  { value: "result", label: "Resultados" },
  { value: "agenda", label: "Agenda" },
  { value: "publish", label: "Publicação" },
  { value: "homolog", label: "Homologação" },
  { value: "progression", label: "Progressão" },
];

function actionCategory(action: string): string {
  if (action.includes("dispute") || action.includes("builder") || action.includes("heat") || action.includes("structure") || action.includes("seeding") || action.includes("knockout")) return "dispute";
  if (action.includes("result") || action.includes("inline_result")) return "result";
  if (action.includes("agenda")) return "agenda";
  if (action.includes("publish") || action.includes("unpublish")) return "publish";
  if (action.includes("homolog")) return "homolog";
  if (action.includes("progression") || action.includes("winner")) return "progression";
  return "other";
}

function formatPayload(action: string, payload: any): string {
  if (!payload) return "";
  const parts: string[] = [];

  if (payload.groups_count != null) parts.push(`${payload.groups_count} grupo(s)`);
  if (payload.heats_count != null) parts.push(`${payload.heats_count} bateria(s)`);
  if (payload.assignments != null) {
    const count = typeof payload.assignments === "object" ? Object.keys(payload.assignments).length : 0;
    parts.push(`${count} movimentação(ões)`);
  }
  if (payload.status) parts.push(`Status: ${payload.status}`);
  if (payload.winnerId) parts.push("Vencedor definido");
  if (payload.scoreHome != null && payload.scoreAway != null) parts.push(`Placar: ${payload.scoreHome} × ${payload.scoreAway}`);
  if (payload.item_name) parts.push(payload.item_name);
  if (payload.item_type) parts.push(payload.item_type === "team" ? "(Equipe)" : "(Atleta)");
  if (payload.justification) parts.push(`"${payload.justification}"`);
  if (payload.phase_name) parts.push(`Fase: ${payload.phase_name}`);

  return parts.join(" · ");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function CentralAuditTab({ eventId, sportEventId }: Props) {
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ["central-audit", eventId, sportEventId, actionFilter, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("audit_events")
        .select("id, action, table_name, record_id, payload, created_at, created_by")
        .or(`record_id.eq.${sportEventId},payload->>sport_event_id.eq.${sportEventId}`)
        .order("created_at", { ascending: false })
        .limit(200);

      if (dateFrom) {
        query = query.gte("created_at", new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59);
        query = query.lte("created_at", to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by action category client-side
      let filtered = data ?? [];
      if (actionFilter !== "all") {
        filtered = filtered.filter((e: any) => actionCategory(e.action) === actionFilter);
      }

      return filtered;
    },
  });

  // Fetch user profiles for display names
  const userIds = [...new Set(events.map((e: any) => e.created_by).filter(Boolean))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["audit-user-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      return data ?? [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = new Map(profiles.map((p: any) => [p.id, p.full_name]));

  const exportCSV = () => {
    if (events.length === 0) return;
    const rows = [["Data/Hora", "Ação", "Tabela", "Autor", "Detalhes"].join(",")];
    for (const e of events as any[]) {
      rows.push([
        formatDate(e.created_at),
        `"${ACTION_LABELS[e.action] ?? e.action}"`,
        e.table_name,
        `"${profileMap.get(e.created_by) ?? e.created_by ?? "Sistema"}"`,
        `"${formatPayload(e.action, e.payload)}"`,
      ].join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "auditoria-modalidade.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5" />
          Auditoria da Modalidade
        </h3>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={events.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            <Filter className="h-3 w-3 inline mr-0.5" /> Tipo
          </label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-xs">
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">De</label>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Até</label>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>Erro ao carregar auditoria.</AlertDescription>
        </Alert>
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma ação registrada para esta modalidade.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-1">
            {(events as any[]).map((evt) => {
              const label = ACTION_LABELS[evt.action] ?? evt.action;
              const details = formatPayload(evt.action, evt.payload);
              const author = profileMap.get(evt.created_by) ?? "Sistema";
              const cat = actionCategory(evt.action);

              const badgeVariant = cat === "result" ? "default" as const
                : cat === "publish" ? "secondary" as const
                : cat === "homolog" ? "secondary" as const
                : "outline" as const;

              return (
                <div key={evt.id} className="relative pl-10 py-2">
                  {/* Dot */}
                  <div className="absolute left-[11px] top-4 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />

                  <Card className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={badgeVariant} className="text-[10px] h-4 px-1.5 shrink-0">
                            {label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{evt.table_name}</span>
                        </div>
                        {details && (
                          <p className="text-xs text-muted-foreground mt-1">{details}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDate(evt.created_at)}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
                          <User className="h-2.5 w-2.5" />
                          {author}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
