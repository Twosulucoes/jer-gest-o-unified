import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useEventBySlug, useConsolidatedSportEventRules } from "@/hooks/useEventRulesCenter";
import { RuleStatusBadge, DisciplineTypeBadge } from "@/components/regras/RuleBadges";
import { SportEventRuleDrawer } from "@/components/regras/SportEventRuleDrawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Download, Layers, Eye, Check, X } from "lucide-react";
import { humanizeDisciplineType } from "@/lib/rulesTransform";
import type { RuleSportEventView } from "@/types/rulesSportEvent";

export default function EventoModalidadesPage() {
  const { eventSlug = "jer-2026" } = useParams();
  const { data: event, isLoading: eventLoading } = useEventBySlug(eventSlug);
  const { data: rules = [], isLoading: rulesLoading, error } = useConsolidatedSportEventRules(event?.id);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCref, setFilterCref] = useState<string>("all");
  const [selectedRule, setSelectedRule] = useState<RuleSportEventView | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  const isLoading = eventLoading || rulesLoading;

  const filtered = useMemo(() => {
    let result = rules;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.sport_name.toLowerCase().includes(q) ||
        r.category_name.toLowerCase().includes(q) ||
        r.sport_event_slug.toLowerCase().includes(q)
      );
    }
    if (filterType !== "all") {
      if (filterType === "paralympic") result = result.filter((r) => r.is_paralympic);
      else result = result.filter((r) => r.discipline_type === filterType);
    }
    if (filterCref === "yes") result = result.filter((r) => r.requires_cref_for_technician);
    if (filterCref === "no") result = result.filter((r) => !r.requires_cref_for_technician);
    return result;
  }, [rules, search, filterType, filterCref]);

  const exportCsv = () => {
    const headers = ["Modalidade", "Categoria", "Slug", "Tipo", "Gêneros", "Limite Masc.", "Limite Fem.", "Equipe Mín", "Equipe Máx", "Substituições", "CREF", "Técnico Ext.", "Aut. Escola", "Status Nacional", "Método Seleção", "Observações"];
    const rows = filtered.map((r) => [
      r.sport_name, r.category_name, r.sport_event_slug,
      humanizeDisciplineType(r.discipline_type),
      r.allowed_genders_list.join("/"),
      r.institution_max_male ?? "", r.institution_max_female ?? "",
      r.team_min_size ?? "", r.team_max_size ?? "",
      r.substitution_cap ?? "",
      r.requires_cref_for_technician ? "Sim" : "Não",
      r.allows_external_technician ? "Sim" : "Não",
      r.requires_school_authorization_for_external_technician ? "Sim" : "Não",
      r.national_flow_label, r.selection_method_label, r.notes ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modalidades-${eventSlug}.csv`;
    a.click();
  };

  const BoolIcon = ({ val }: { val: boolean | null }) =>
    val ? <Check className="h-3.5 w-3.5 text-success" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />;

  if (error) {
    return <div className="p-6"><Alert variant="destructive"><AlertDescription>Erro: {(error as Error).message}</AlertDescription></Alert></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
          <Layers className="h-6 w-6 text-primary" />
          Catálogo Operacional por Modalidade
        </h1>
        {event && <p className="text-sm text-muted-foreground mt-1">{event.name} ({event.year})</p>}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <>
          {/* Filtros */}
          <Card>
            <CardContent className="py-3">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="collective">Coletiva</SelectItem>
                    <SelectItem value="individual_paralympic">Paralímpica</SelectItem>
                    <SelectItem value="paralympic">Todas paralímpicas</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterCref} onValueChange={setFilterCref}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="CREF" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">CREF: Todos</SelectItem>
                    <SelectItem value="yes">Exige CREF</SelectItem>
                    <SelectItem value="no">Não exige</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setCompact(!compact)}>
                  {compact ? "Detalhado" : "Compacto"}
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="h-3.5 w-3.5 mr-1" /> CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabela */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Modalidades ({filtered.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Modalidade</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tipo</TableHead>
                      {!compact && <TableHead>Gêneros</TableHead>}
                      <TableHead>Limite Inst.</TableHead>
                      {!compact && <TableHead>Equipe</TableHead>}
                      {!compact && <TableHead>Subst.</TableHead>}
                      {!compact && <TableHead>CREF</TableHead>}
                      {!compact && <TableHead>Téc. Ext.</TableHead>}
                      <TableHead>Nacional</TableHead>
                      {!compact && <TableHead>Seleção</TableHead>}
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={compact ? 6 : 12} className="text-center text-muted-foreground py-8">Nenhuma modalidade encontrada</TableCell></TableRow>
                    ) : filtered.map((r) => (
                      <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedRule(r); setDrawerOpen(true); }}>
                        <TableCell className="font-medium text-sm">{r.sport_name}</TableCell>
                        <TableCell className="text-sm">{r.category_name}</TableCell>
                        <TableCell><DisciplineTypeBadge type={r.discipline_type} /></TableCell>
                        {!compact && <TableCell className="text-xs">{r.allowed_genders_list.join(", ")}</TableCell>}
                        <TableCell className="text-xs">{r.institution_limit_summary}</TableCell>
                        {!compact && <TableCell className="text-xs">{r.team_size_summary}</TableCell>}
                        {!compact && <TableCell className="text-xs">{r.substitution_summary}</TableCell>}
                        {!compact && <TableCell><BoolIcon val={r.requires_cref_for_technician} /></TableCell>}
                        {!compact && <TableCell><BoolIcon val={r.allows_external_technician} /></TableCell>}
                        <TableCell><RuleStatusBadge status={r.national_flow_status} /></TableCell>
                        {!compact && <TableCell className="text-xs max-w-[120px] truncate">{r.selection_method_label !== "Não informado" ? r.selection_method_label : "—"}</TableCell>}
                        <TableCell><Eye className="h-4 w-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <SportEventRuleDrawer rule={selectedRule} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
