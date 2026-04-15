import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useEventBySlug, useQualificationRules } from "@/hooks/useEventRulesCenter";
import { RuleJsonAccordion } from "@/components/regras/RuleJsonAccordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Download, Map, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function EventoQualificacaoPage() {
  const { eventSlug = "jer-2026" } = useParams();
  const { data: event, isLoading: eventLoading } = useEventBySlug(eventSlug);
  const { data: qualRules = [], isLoading, error } = useQualificationRules(event?.id);

  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<"sport" | "scope" | "priority">("sport");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!search) return qualRules;
    const q = search.toLowerCase();
    return qualRules.filter((r) =>
      (r.sport_name ?? "").toLowerCase().includes(q) ||
      (r.sport_event_slug ?? "").toLowerCase().includes(q) ||
      r.host_scope_code.toLowerCase().includes(q)
    );
  }, [qualRules, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const r of filtered) {
      let key: string;
      if (groupBy === "sport") key = r.sport_name ?? r.sport_event_slug ?? "Sem modalidade";
      else if (groupBy === "scope") key = r.host_scope_code;
      else key = `Prioridade ${r.priority_order ?? "?"}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, groupBy]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setExpandedGroups(new Set(grouped.map(([k]) => k)));
  const collapseAll = () => setExpandedGroups(new Set());

  const exportCsv = () => {
    const headers = ["Modalidade", "Fase", "Sede", "Vagas", "Auto-classificação", "Remanejamento", "Prioridade"];
    const rows = filtered.map((r) => [
      r.sport_name ?? r.sport_event_slug ?? "", r.phase_name ?? "",
      r.host_scope_code, r.base_slots ?? "", r.auto_qualify_if_registered_teams_eq ?? "",
      r.reallocate_to_scope_code ?? "", r.priority_order ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qualificacao-${eventSlug}.csv`;
    a.click();
  };

  if (error) {
    return <div className="p-6"><Alert variant="destructive"><AlertDescription>Erro: {(error as Error).message}</AlertDescription></Alert></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
          <Map className="h-6 w-6 text-primary" />
          Mapa de Qualificação
        </h1>
        {event && <p className="text-sm text-muted-foreground mt-1">{event.name} ({event.year})</p>}
      </div>

      {eventLoading || isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <>
          <Card>
            <CardContent className="py-3">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar modalidade ou sede..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sport">Agrupar por modalidade</SelectItem>
                    <SelectItem value="scope">Agrupar por sede</SelectItem>
                    <SelectItem value="priority">Agrupar por prioridade</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={expandAll}>Expandir tudo</Button>
                <Button variant="outline" size="sm" onClick={collapseAll}>Recolher</Button>
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="h-3.5 w-3.5 mr-1" /> CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {filtered.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma regra de qualificação encontrada</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {grouped.map(([groupKey, items]) => (
                <Collapsible key={groupKey} open={expandedGroups.has(groupKey)} onOpenChange={() => toggleGroup(groupKey)}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
                        <div className="flex items-center gap-2">
                          {expandedGroups.has(groupKey) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <CardTitle className="text-sm">{groupKey}</CardTitle>
                          <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {groupBy !== "sport" && <TableHead>Modalidade</TableHead>}
                              <TableHead>Fase</TableHead>
                              <TableHead>Sede</TableHead>
                              <TableHead>Vagas</TableHead>
                              <TableHead>Auto-classificação</TableHead>
                              <TableHead>Remanejamento</TableHead>
                              <TableHead>Prioridade</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((q) => (
                              <TableRow key={q.id}>
                                {groupBy !== "sport" && <TableCell className="text-sm font-medium">{q.sport_name ?? "—"}</TableCell>}
                                <TableCell className="text-sm">{q.phase_name ?? "—"}</TableCell>
                                <TableCell><Badge variant="outline">{q.host_scope_code}</Badge></TableCell>
                                <TableCell className="text-sm font-medium">{q.base_slots ?? "—"}</TableCell>
                                <TableCell>
                                  {q.auto_qualify_if_registered_teams_eq != null ? (
                                    <Badge variant="outline" className="bg-success/15 text-success border-success/30">
                                      ≤ {q.auto_qualify_if_registered_teams_eq}
                                    </Badge>
                                  ) : "—"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {q.reallocate_to_scope_code ? (
                                    <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">{q.reallocate_to_scope_code}</Badge>
                                  ) : "—"}
                                </TableCell>
                                <TableCell className="text-xs">{q.priority_order ?? "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {items.some((i) => i.special_rule_json) && (
                          <div className="px-4 pb-3">
                            {items.filter((i) => i.special_rule_json).map((i) => (
                              <RuleJsonAccordion key={i.id} label={`Regra especial — ${i.host_scope_code}`} data={i.special_rule_json} />
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
