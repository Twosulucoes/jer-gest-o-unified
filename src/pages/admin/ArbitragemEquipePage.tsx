import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Search, Users, Radio, ExternalLink, Calendar, MapPin, UserPlus, ListChecks, Download, FileText, FileSpreadsheet, Settings } from "lucide-react";
import { format, parse } from "date-fns";
import { EscalaLoteDialog, formatMatchLabel } from "@/components/admin/arbitragem/EscalaLoteDialog";
import { downloadCsv, downloadPdf, type EscalaExportRow, type EscalaColumnKey } from "@/components/admin/arbitragem/escalaExport";
import { ExportColumnsDialog } from "@/components/admin/arbitragem/ExportColumnsDialog";
import { ArbitrosTab } from "@/components/admin/arbitragem/ArbitrosTab";

const ROLE_LABELS: Record<string, string> = {
  mesario: "Mesário",
  arbitro_principal: "Árbitro Principal",
  arbitro_auxiliar: "Árbitro Auxiliar",
  fiscal: "Fiscal",
  anotador: "Anotador",
};
const roleLabel = (r: string) => ROLE_LABELS[r] ?? r;

type AssignmentRow = {
  id: string;
  user_id: string;
  role: string;
  match_id: string;
  created_at: string;
};

type MatchRow = {
  id: string;
  match_number: number | null;
  match_date: string | null;
  start_time: string | null;
  status: string | null;
  event_stage_id: string | null;
  sport_event_id: string | null;
  venues: { name: string | null } | null;
  competition_phases: { name: string | null } | null;
  sport_events: {
    id: string;
    gender: string | null;
    sports: { id: string; name: string | null } | null;
    categories: { name: string | null } | null;
  } | null;
};

export default function ArbitragemEquipePage() {
  const { activeEventId, activeEvent } = useEventContext();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (() => {
    const t = searchParams.get("tab");
    return t === "sports" || t === "lote" || t === "officials" || t === "arbitros" ? t : "arbitros";
  })();
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  useEffect(() => {
    const current = searchParams.get("tab");
    if (current !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", activeTab);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());
  const [escalaOpen, setEscalaOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Etapas do evento (para filtro)
  const { data: stages = [] } = useQuery({
    queryKey: ["arb-event-stages", activeEventId],
    enabled: !!activeEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_stages")
        .select("id, name")
        .eq("event_id", activeEventId!)
        .neq("status", "archived")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Designações do evento ativo
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ["arb-assignments", activeEventId],
    enabled: !!activeEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_user_assignments" as any)
        .select("id, user_id, role, match_id, created_at")
        .eq("event_id", activeEventId!);
      if (error) throw error;
      return (data ?? []) as unknown as AssignmentRow[];
    },
  });

  const matchIds = useMemo(
    () => Array.from(new Set(assignments.map((a) => a.match_id))),
    [assignments],
  );
  const userIds = useMemo(
    () => Array.from(new Set(assignments.map((a) => a.user_id))),
    [assignments],
  );

  // Partidas vinculadas
  const { data: matches = [], isLoading: loadingMatches } = useQuery({
    queryKey: ["arb-matches", matchIds.length, matchIds.slice(0, 5).join(",")],
    enabled: matchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_matches")
        .select(`
          id, match_number, match_date, start_time, status,
          event_stage_id, sport_event_id,
          venues(name),
          competition_phases(name),
          sport_events(
            id, gender,
            sports(id, name),
            categories(name)
          )
        `)
        .in("id", matchIds);
      if (error) throw error;
      return (data ?? []) as unknown as MatchRow[];
    },
  });

  // Partidas elegíveis para escala em lote (evento + filtro de modalidade)
  const { data: eligibleMatches = [], isLoading: loadingEligible } = useQuery({
    queryKey: ["arb-eligible-matches", activeEventId, sportFilter],
    enabled: !!activeEventId && activeTab === "lote",
    queryFn: async () => {
      let q = supabase
        .from("competition_matches")
        .select(`
          id, match_number, match_date, start_time, status,
          event_id, sport_event_id,
          venues(name),
          competition_phases(name),
          sport_events!inner(
            id, event_id, gender,
            sports(id, name),
            categories(name)
          )
        `)
        .eq("event_id", activeEventId!)
        .order("match_date", { ascending: true, nullsFirst: false })
        .order("start_time", { ascending: true, nullsFirst: false })
        .limit(500);
      if (sportFilter !== "all") q = q.eq("sport_events.sports.id", sportFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as MatchRow[];
    },
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["arb-profiles", userIds.length, userIds.slice(0, 5).join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const matchMap = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  // Filtros aplicados às designações
  const filteredAssignments = useMemo(() => {
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const term = norm(search.trim());

    return assignments.filter((a) => {
      const m = matchMap.get(a.match_id);
      if (stageFilter !== "all" && m?.event_stage_id !== stageFilter) return false;
      if (sportFilter !== "all" && m?.sport_events?.sports?.id !== sportFilter) return false;
      if (roleFilter !== "all" && a.role !== roleFilter) return false;

      if (term) {
        const profile = profileMap.get(a.user_id);
        const haystack = [
          profile?.full_name,
          m?.sport_events?.sports?.name,
          m?.sport_events?.categories?.name,
          m?.venues?.name,
        ]
          .filter(Boolean)
          .map((v) => norm(String(v)))
          .join(" ");
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [assignments, matchMap, profileMap, stageFilter, sportFilter, roleFilter, search]);

  // Modalidades únicas das partidas (para dropdown)
  const sportOptions = useMemo(() => {
    const map = new Map<string, string>();
    matches.forEach((m) => {
      const s = m.sport_events?.sports;
      if (s?.id && s.name) map.set(s.id, s.name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [matches]);

  // Agregação por árbitro
  const byOfficial = useMemo(() => {
    const grouped = new Map<
      string,
      {
        userId: string;
        name: string;
        roles: Map<string, number>;
        sports: Set<string>;
        stages: Set<string>;
        assignments: AssignmentRow[];
      }
    >();
    filteredAssignments.forEach((a) => {
      const profile = profileMap.get(a.user_id);
      const m = matchMap.get(a.match_id);
      if (!grouped.has(a.user_id)) {
        grouped.set(a.user_id, {
          userId: a.user_id,
          name: profile?.full_name ?? "Usuário",
          roles: new Map(),
          sports: new Set(),
          stages: new Set(),
          assignments: [],
        });
      }
      const g = grouped.get(a.user_id)!;
      g.roles.set(a.role, (g.roles.get(a.role) ?? 0) + 1);
      const sportName = m?.sport_events?.sports?.name;
      if (sportName) g.sports.add(sportName);
      if (m?.event_stage_id) g.stages.add(m.event_stage_id);
      g.assignments.push(a);
    });
    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredAssignments, profileMap, matchMap]);

  // Agregação por modalidade
  const bySport = useMemo(() => {
    const grouped = new Map<
      string,
      {
        sportId: string;
        sportName: string;
        officials: Set<string>;
        matches: Set<string>;
        assignments: AssignmentRow[];
      }
    >();
    filteredAssignments.forEach((a) => {
      const m = matchMap.get(a.match_id);
      const sport = m?.sport_events?.sports;
      const sportId = sport?.id ?? "_unknown";
      const sportName = sport?.name ?? "Sem modalidade";
      if (!grouped.has(sportId)) {
        grouped.set(sportId, {
          sportId,
          sportName,
          officials: new Set(),
          matches: new Set(),
          assignments: [],
        });
      }
      const g = grouped.get(sportId)!;
      g.officials.add(a.user_id);
      g.matches.add(a.match_id);
      g.assignments.push(a);
    });
    return Array.from(grouped.values()).sort((a, b) => a.sportName.localeCompare(b.sportName));
  }, [filteredAssignments, matchMap]);

  const stageMap = useMemo(() => new Map(stages.map((s) => [s.id, s.name])), [stages]);

  const formatMatchDate = (date: string | null, time: string | null) => {
    if (!date) return "Data a definir";
    try {
      const d = format(parse(date, "yyyy-MM-dd", new Date()), "dd/MM/yyyy");
      return time ? `${d} ${time.slice(0, 5)}` : d;
    } catch {
      return date;
    }
  };

  // Linhas para exportação (respeita filtros aplicados)
  const exportRows: EscalaExportRow[] = useMemo(() => {
    return filteredAssignments
      .map((a) => {
        const m = matchMap.get(a.match_id);
        const profile = profileMap.get(a.user_id);
        const stageName = m?.event_stage_id ? stageMap.get(m.event_stage_id) ?? "" : "";
        return {
          official_name: profile?.full_name ?? "Usuário",
          role_label: ROLE_LABELS[a.role] ?? a.role,
          stage: stageName,
          match_number: m?.match_number != null ? String(m.match_number) : "—",
          sport: m?.sport_events?.sports?.name ?? "—",
          category: m?.sport_events?.categories?.name ?? "",
          phase: m?.competition_phases?.name ?? "",
          match_date: m?.match_date
            ? (() => {
                try {
                  return format(parse(m.match_date, "yyyy-MM-dd", new Date()), "dd/MM/yyyy");
                } catch {
                  return m.match_date ?? "";
                }
              })()
            : "",
          start_time: m?.start_time ? m.start_time.slice(0, 5) : "",
          venue: m?.venues?.name ?? "",
        };
      })
      .sort((a, b) => {
        const k = a.stage.localeCompare(b.stage);
        if (k !== 0) return k;
        const k2 = a.sport.localeCompare(b.sport);
        if (k2 !== 0) return k2;
        const k3 = a.match_date.localeCompare(b.match_date);
        if (k3 !== 0) return k3;
        return a.official_name.localeCompare(b.official_name);
      });
  }, [filteredAssignments, matchMap, profileMap, stageMap]);

  const exportFilenameBase = useMemo(() => {
    const parts = ["escalas-arbitragem"];
    if (stageFilter !== "all") {
      const s = stages.find((x) => x.id === stageFilter)?.name;
      if (s) parts.push(s.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    }
    parts.push(format(new Date(), "yyyyMMdd-HHmm"));
    return parts.join("_");
  }, [stageFilter, stages]);

  const handleExport = async (fmt: "csv" | "pdf", selected: EscalaColumnKey[]) => {
    if (exportRows.length === 0) {
      toast.info("Nenhuma escala para exportar com os filtros atuais.");
      return;
    }
    if (fmt === "csv") {
      downloadCsv(exportRows, `${exportFilenameBase}.csv`, selected);
      toast.success(`CSV exportado (${exportRows.length} linha(s)).`);
      setExportOpen(false);
      return;
    }
    try {
      const stageName =
        stageFilter !== "all" ? stages.find((x) => x.id === stageFilter)?.name : undefined;
      await downloadPdf(exportRows, `${exportFilenameBase}.pdf`, {
        eventName: activeEvent?.name,
        stageName,
        activeEventId,
        userId: user?.id ?? null,
        selectedColumns: selected,
      });
      toast.success(`PDF gerado (${exportRows.length} linha(s)).`);
      setExportOpen(false);
    } catch (e) {
      toast.error("Falha ao gerar PDF: " + (e as Error).message);
    }
  };

  if (!activeEventId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Selecione um evento ativo para visualizar a equipe de arbitragem.
        </CardContent>
      </Card>
    );
  }

  const isLoading = loadingAssignments || loadingMatches;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            Equipe de Arbitragem
          </h1>
          <p className="text-sm text-muted-foreground">
            Lista consolidada de árbitros e mesários do evento, com escalas por modalidade e etapa.
            Para escalar oficiais em uma partida, abra o detalhe da partida.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="remuneracao">
              <Settings className="mr-1 h-4 w-4" />
              Remuneração
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="apuracao">
              <Calendar className="mr-1 h-4 w-4" />
              Apuração
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="mr-1 h-4 w-4" />
            Exportar escalas
          </Button>
        </div>
      </div>

      <ExportColumnsDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        rowCount={exportRows.length}
        onConfirm={handleExport}
      />

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Oficiais distintos</p>
            <p className="text-2xl font-bold">{byOfficial.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Designações ativas</p>
            <p className="text-2xl font-bold">{filteredAssignments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Partidas cobertas</p>
            <p className="text-2xl font-bold">
              {new Set(filteredAssignments.map((a) => a.match_id)).size}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Modalidades</p>
            <p className="text-2xl font-bold">{bySport.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar oficial, modalidade, local..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger><SelectValue placeholder="Etapa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sportFilter} onValueChange={setSportFilter}>
            <SelectTrigger><SelectValue placeholder="Modalidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as modalidades</SelectItem>
              {sportOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger><SelectValue placeholder="Função" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as funções</SelectItem>
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="arbitros" className="gap-2">
              <UserPlus className="h-4 w-4" />Árbitros
            </TabsTrigger>
            <TabsTrigger value="officials" className="gap-2">
              <Users className="h-4 w-4" />Por oficial
            </TabsTrigger>
            <TabsTrigger value="sports" className="gap-2">
              <Radio className="h-4 w-4" />Por modalidade
            </TabsTrigger>
            <TabsTrigger value="lote" className="gap-2">
              <ListChecks className="h-4 w-4" />Escala em lote
            </TabsTrigger>
          </TabsList>

          {/* Gestão da equipe de árbitros */}
          <TabsContent value="arbitros" className="mt-4">
            <ArbitrosTab />
          </TabsContent>

          {/* Lista por oficial */}
          <TabsContent value="officials" className="mt-4">
            {byOfficial.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhum oficial designado com os filtros atuais.
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" className="space-y-2">
                {byOfficial.map((o) => (
                  <AccordionItem key={o.userId} value={o.userId} className="border rounded-lg px-3">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-3">
                        <div className="font-semibold">{o.name}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from(o.roles.entries()).map(([r, c]) => (
                            <Badge key={r} variant="secondary" className="text-[10px]">
                              {roleLabel(r)} · {c}
                            </Badge>
                          ))}
                          <Badge variant="outline" className="text-[10px]">
                            {o.assignments.length} partida{o.assignments.length !== 1 ? "s" : ""}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {o.sports.size} modalidade{o.sports.size !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {o.assignments
                          .map((a) => ({ a, m: matchMap.get(a.match_id) }))
                          .sort((x, y) => {
                            const dx = x.m?.match_date ?? "";
                            const dy = y.m?.match_date ?? "";
                            return dx.localeCompare(dy);
                          })
                          .map(({ a, m }) => (
                            <MatchAssignmentRow
                              key={a.id}
                              role={a.role}
                              match={m}
                              stageName={m?.event_stage_id ? stageMap.get(m.event_stage_id) ?? null : null}
                              formatDate={formatMatchDate}
                            />
                          ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>

          {/* Lista por modalidade */}
          <TabsContent value="sports" className="mt-4">
            {bySport.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhuma escala encontrada para os filtros atuais.
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" className="space-y-2">
                {bySport.map((s) => (
                  <AccordionItem key={s.sportId} value={s.sportId} className="border rounded-lg px-3">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-3">
                        <div className="font-semibold">{s.sportName}</div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">
                            {s.officials.size} oficiais
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {s.matches.size} partidas
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {s.assignments.length} designações
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {s.assignments
                          .map((a) => ({
                            a,
                            m: matchMap.get(a.match_id),
                            profile: profileMap.get(a.user_id),
                          }))
                          .sort((x, y) => {
                            const dx = x.m?.match_date ?? "";
                            const dy = y.m?.match_date ?? "";
                            return dx.localeCompare(dy);
                          })
                          .map(({ a, m, profile }) => (
                            <MatchAssignmentRow
                              key={a.id}
                              role={a.role}
                              officialName={profile?.full_name ?? "Usuário"}
                              match={m}
                              stageName={m?.event_stage_id ? stageMap.get(m.event_stage_id) ?? null : null}
                              formatDate={formatMatchDate}
                            />
                          ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>

          {/* Escala em Lote */}
          <TabsContent value="lote" className="mt-4 space-y-3">
            <Card>
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <p className="font-medium">
                    {selectedMatchIds.size} partida(s) selecionada(s)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Use os filtros acima (modalidade) para refinar. Limite de 500 partidas listadas.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allIds = eligibleMatches.map((m) => m.id);
                      const next = new Set(selectedMatchIds);
                      const allSelected = allIds.every((id) => next.has(id));
                      if (allSelected) allIds.forEach((id) => next.delete(id));
                      else allIds.forEach((id) => next.add(id));
                      setSelectedMatchIds(next);
                    }}
                    disabled={eligibleMatches.length === 0}
                  >
                    {eligibleMatches.length > 0 &&
                    eligibleMatches.every((m) => selectedMatchIds.has(m.id))
                      ? "Limpar seleção"
                      : "Selecionar todas (visíveis)"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={selectedMatchIds.size === 0}
                    onClick={() => setEscalaOpen(true)}
                  >
                    <UserPlus className="mr-1 h-4 w-4" />
                    Escalar oficiais
                  </Button>
                </div>
              </CardContent>
            </Card>

            {loadingEligible ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : eligibleMatches.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhuma partida encontrada para os filtros atuais.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[600px]">
                    <ul className="divide-y">
                      {eligibleMatches.map((m) => {
                        const checked = selectedMatchIds.has(m.id);
                        return (
                          <li
                            key={m.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const next = new Set(selectedMatchIds);
                                if (v) next.add(m.id);
                                else next.delete(m.id);
                                setSelectedMatchIds(next);
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-sm">
                                  #{m.match_number ?? "—"}
                                </span>
                                {m.sport_events?.sports?.name && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {m.sport_events.sports.name}
                                    {m.sport_events.categories?.name
                                      ? ` · ${m.sport_events.categories.name}`
                                      : ""}
                                  </Badge>
                                )}
                                {m.competition_phases?.name && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {m.competition_phases.name}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatMatchDate(m.match_date ?? null, m.start_time ?? null)}
                                </span>
                                {m.venues?.name && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {m.venues.name}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button asChild size="icon" variant="ghost" className="h-7 w-7">
                              <Link to={`/admin/competicao/partida/${m.id}`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      <EscalaLoteDialog
        open={escalaOpen}
        onOpenChange={setEscalaOpen}
        matches={Array.from(selectedMatchIds)
          .map((id) => {
            const m = eligibleMatches.find((x) => x.id === id);
            return m ? { id: m.id, label: formatMatchLabel(m) } : null;
          })
          .filter((x): x is { id: string; label: string } => x !== null)}
        onSuccess={() => setSelectedMatchIds(new Set())}
      />
    </div>
  );
}

interface MatchAssignmentRowProps {
  role: string;
  officialName?: string;
  match?: MatchRow;
  stageName: string | null;
  formatDate: (d: string | null, t: string | null) => string;
}

function MatchAssignmentRow({
  role, officialName, match, stageName, formatDate,
}: MatchAssignmentRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 bg-muted/30">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {officialName && <span className="font-medium text-sm">{officialName}</span>}
          <Badge variant="secondary" className="text-[10px]">{roleLabel(role)}</Badge>
          {match?.sport_events?.sports?.name && (
            <Badge variant="outline" className="text-[10px]">
              {match.sport_events.sports.name}
              {match.sport_events.categories?.name ? ` · ${match.sport_events.categories.name}` : ""}
            </Badge>
          )}
          {stageName && <Badge variant="outline" className="text-[10px]">{stageName}</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Partida #{match?.match_number ?? "—"}</span>
          {match?.competition_phases?.name && <span>{match.competition_phases.name}</span>}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(match?.match_date ?? null, match?.start_time ?? null)}
          </span>
          {match?.venues?.name && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {match.venues.name}
            </span>
          )}
        </div>
      </div>
      {match?.id && (
        <Button asChild size="sm" variant="outline">
          <Link to={`/admin/competicao/partida/${match.id}`}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            Abrir partida
          </Link>
        </Button>
      )}
    </div>
  );
}
