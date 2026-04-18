import { useState, useMemo } from "react";
import { useActiveEventId } from "@/contexts/EventContext";
import { useConsolidatedSportEventRules, useQualificationRules, useRuleSummary, useEventParticipationRules } from "@/hooks/useEventRulesCenter";
import { RuleInfoCard } from "@/components/regras/RuleInfoCard";
import { RuleStatusBadge, DisciplineTypeBadge, ManualConfirmationBadge } from "@/components/regras/RuleBadges";
import { SportEventRuleDrawer } from "@/components/regras/SportEventRuleDrawer";
import { RuleJsonAccordion } from "@/components/regras/RuleJsonAccordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Download, Trophy, Users, ShieldAlert, Eye } from "lucide-react";
import { humanizeDisciplineType } from "@/lib/rulesTransform";
import type { RuleSportEventView } from "@/types/rulesSportEvent";

export default function RegrasCentroTab() {
  const eventId = useActiveEventId();
  const { data: rules = [], isLoading, error } = useConsolidatedSportEventRules(eventId);
  const { data: qualRules = [] } = useQualificationRules(eventId);
  const { data: participationRules } = useEventParticipationRules(eventId);
  const summary = useRuleSummary(rules, qualRules.length);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterNational, setFilterNational] = useState<string>("all");
  const [selectedRule, setSelectedRule] = useState<RuleSportEventView | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    if (filterNational !== "all") result = result.filter((r) => r.national_flow_status === filterNational);
    return result;
  }, [rules, search, filterType, filterNational]);

  const manualCases = useMemo(() => rules.filter((r) => r.manual_confirmation_required), [rules]);

  const exportCsv = () => {
    const headers = ["Modalidade", "Categoria", "Slug", "Tipo", "Gêneros", "Limite Instituição", "Status Nacional", "Método Seleção"];
    const rows = filtered.map((r) => [
      r.sport_name, r.category_name, r.sport_event_slug,
      humanizeDisciplineType(r.discipline_type), r.allowed_genders_list.join("/"),
      r.institution_limit_summary, r.national_flow_label, r.selection_method_label,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `regras-consolidadas.csv`;
    a.click();
  };

  if (error) return <Alert variant="destructive"><AlertDescription>Erro ao carregar: {(error as Error).message}</AlertDescription></Alert>;

  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <RuleInfoCard title="Modalidades/Categorias" value={summary.total} icon={<Trophy className="h-4 w-4" />} />
        <RuleInfoCard title="Individuais" value={summary.individual} icon={<Users className="h-4 w-4" />} />
        <RuleInfoCard title="Coletivas" value={summary.collective} icon={<Users className="h-4 w-4" />} />
        <RuleInfoCard title="Paralímpicas" value={summary.paralympic} />
        <RuleInfoCard title="Elegíveis ao nacional" value={summary.eligible} description="Encaminhamento automático" />
        <RuleInfoCard title="Somente estadual" value={summary.stateOnly} />
        <RuleInfoCard title="Não elegíveis" value={summary.notEligible} />
        <RuleInfoCard title="Confirmação manual" value={summary.manualConfirmation} icon={<ShieldAlert className="h-4 w-4" />} />
      </div>

      {/* Regras gerais de participação */}
      {participationRules && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Regras Gerais de Participação</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div><span className="text-muted-foreground">Máx. esportes individuais/atleta:</span> <strong>{participationRules.max_individual_sports_per_athlete}</strong></div>
              <div><span className="text-muted-foreground">Máx. provas/esporte individual:</span> <strong>{participationRules.max_events_per_individual_sport}</strong></div>
              <div><span className="text-muted-foreground">Máx. equipes coletivas/atleta:</span> <strong>{participationRules.max_collective_teams_per_athlete}</strong></div>
              <div><span className="text-muted-foreground">Doação alimentos (kg):</span> <strong>{participationRules.food_donation_kg ?? "—"}</strong></div>
              <div><span className="text-muted-foreground">WO (min):</span> <strong>{participationRules.wo_minutes ?? "—"}</strong></div>
              <div><span className="text-muted-foreground">WxO (min):</span> <strong>{participationRules.wxo_minutes ?? "—"}</strong></div>
              <div><span className="text-muted-foreground">Prazo protesto (min):</span> <strong>{participationRules.protest_deadline_minutes ?? "—"}</strong></div>
            </div>
            <RuleJsonAccordion label="Regras de participação (JSON completo)" data={participationRules as unknown as Record<string, unknown>} />
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar modalidade, categoria ou slug..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="collective">Coletiva</SelectItem>
                <SelectItem value="individual_paralympic">Paralímpica</SelectItem>
                <SelectItem value="paralympic">Todas paralímpicas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterNational} onValueChange={setFilterNational}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status nacional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="eligible">Elegível</SelectItem>
                <SelectItem value="not_eligible">Não elegível</SelectItem>
                <SelectItem value="state_only">Somente estadual</SelectItem>
                <SelectItem value="manual_confirmation">Confirmação manual</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela regulatória */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Tabela Regulatória Consolidada ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Gêneros</TableHead>
                  <TableHead>Limite Inst.</TableHead>
                  <TableHead>Status Nacional</TableHead>
                  <TableHead>Seleção</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma regra encontrada</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => { setSelectedRule(r); setDrawerOpen(true); }}>
                    <TableCell className="font-medium text-sm">{r.sport_name}</TableCell>
                    <TableCell className="text-sm">{r.category_name}</TableCell>
                    <TableCell><DisciplineTypeBadge type={r.discipline_type} /></TableCell>
                    <TableCell className="text-xs">{r.allowed_genders_list.join(", ")}</TableCell>
                    <TableCell className="text-xs">{r.institution_limit_summary}</TableCell>
                    <TableCell><RuleStatusBadge status={r.national_flow_status} /></TableCell>
                    <TableCell className="text-xs">{r.selection_method_label !== "Não informado" ? r.selection_method_label : "—"}</TableCell>
                    <TableCell><Eye className="h-4 w-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Casos de confirmação manual */}
      {manualCases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Casos que Exigem Decisão Manual ({manualCases.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>As modalidades abaixo possuem elegibilidade nacional que depende de regulamento específico. Não automatizar decisão.</AlertDescription>
            </Alert>
            <div className="space-y-2">
              {manualCases.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setSelectedRule(r); setDrawerOpen(true); }}>
                  <div>
                    <span className="text-sm font-medium">{r.sport_name} — {r.category_name}</span>
                    <p className="text-xs text-muted-foreground">{r.sport_event_slug}</p>
                  </div>
                  <ManualConfirmationBadge />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Qualificação resumo */}
      {qualRules.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Regras de Qualificação ({qualRules.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Vagas</TableHead>
                    <TableHead>Auto-classificação</TableHead>
                    <TableHead>Remanejamento</TableHead>
                    <TableHead>Prioridade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qualRules.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="text-sm font-medium">{q.sport_name ?? q.sport_event_slug ?? "—"}</TableCell>
                      <TableCell className="text-sm">{q.phase_name ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{q.host_scope_code}</Badge></TableCell>
                      <TableCell className="text-sm">{q.base_slots ?? "—"}</TableCell>
                      <TableCell>
                        {q.auto_qualify_if_registered_teams_eq != null ? (
                          <Badge variant="outline" className="bg-success/15 text-success border-success/30">Se {q.auto_qualify_if_registered_teams_eq} equipe(s)</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{q.reallocate_to_scope_code ?? "—"}</TableCell>
                      <TableCell className="text-xs">{q.priority_order ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <SportEventRuleDrawer rule={selectedRule} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
