import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import ModuleHeader from "@/components/admin/ModuleHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Zap, RefreshCw, Eye, ExternalLink, Settings, CheckCircle, AlertTriangle, XCircle, Accessibility } from "lucide-react";
import { SPORT_PRESET_CATALOG, PRESET_CATEGORIES } from "@/config/sportPresetCatalog";
import { FAMILIES } from "@/types/sportEventRules";

interface SportEventRow {
  id: string;
  name: string;
  sport_name: string;
  category_name: string;
  gender_scope: string;
  is_collective: boolean;
  rules: Record<string, unknown> | null;
  is_active: boolean | null;
  preset_key: string | null;
  family: string | null;
  format: string | null;
  has_rules: boolean;
  is_jerpa: boolean;
  minimo_participantes: number;
}

interface SeedReport {
  event_id: string;
  total_sport_events: number;
  created: number;
  updated: number;
  skipped: number;
  by_preset: Record<string, number>;
  dry_run: boolean;
}

export default function RegrasLotePage() {
  const eventId = useActiveEventId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterFamily, setFilterFamily] = useState<string>("all");
  const [filterPreset, setFilterPreset] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSport, setFilterSport] = useState<string>("all");
  const [filterJerpa, setFilterJerpa] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [lastReport, setLastReport] = useState<SeedReport | null>(null);

  const { data: rows = [], isLoading, error, refetch } = useQuery({
    queryKey: ["batch-rules-list", eventId],
    queryFn: async () => {
      const { data: sportEvents, error: seErr } = await supabase
        .from("sport_events")
        .select("id, name, slug, sport_id, category_id, is_active, sports!inner(name, is_collective), categories!inner(name, gender_scope)")
        .eq("event_id", eventId!)
        .eq("is_active", true)
        .order("name");
      if (seErr) throw seErr;

      const seIds = (sportEvents || []).map((se: any) => se.id);
      let rulesMap: Record<string, any> = {};
      if (seIds.length > 0) {
        const { data: rulesRows } = await supabase
          .from("sport_event_rules")
          .select("sport_event_id, rules, is_active")
          .in("sport_event_id", seIds);
        if (rulesRows) {
          for (const r of rulesRows) {
            rulesMap[r.sport_event_id] = r;
          }
        }
      }

      return (sportEvents || []).map((se: any): SportEventRow => {
        const ruleRow = rulesMap[se.id];
        const rules = ruleRow?.rules as Record<string, unknown> | null;
        const disPolicy = rules?.disability_policy as Record<string, unknown> | undefined;
        return {
          id: se.id,
          name: se.name,
          sport_name: se.sports?.name ?? "",
          category_name: se.categories?.name ?? "",
          gender_scope: se.categories?.gender_scope ?? "mixed",
          is_collective: se.sports?.is_collective ?? false,
          rules,
          is_active: ruleRow?.is_active ?? null,
          preset_key: (rules?.preset_key as string) ?? null,
          family: (rules?.family as string) ?? null,
          format: (rules?.format as string) ?? null,
          has_rules: !!ruleRow,
          is_jerpa: !!disPolicy?.class_required,
          minimo_participantes: (rules?.minimo_participantes as number) ?? 2,
        };
      });
    },
    enabled: !!eventId,
  });

  const seedMutation = useMutation({
    mutationFn: async ({ mode, dryRun }: { mode: string; dryRun: boolean }) => {
      const { data, error } = await supabase.rpc("rpc_seed_sport_event_rules_for_event", {
        p_event_id: eventId!,
        p_mode: mode,
        p_dry_run: dryRun,
      });
      if (error) throw error;
      return data as unknown as SeedReport;
    },
    onSuccess: (report) => {
      setLastReport(report);
      if (!report.dry_run) {
        queryClient.invalidateQueries({ queryKey: ["batch-rules-list", eventId] });
        toast.success(`Regras geradas: ${report.created} criadas, ${report.updated} atualizadas, ${report.skipped} ignoradas`);
      } else {
        toast.info(`Dry run: ${report.created} seriam criadas, ${report.updated} seriam atualizadas`);
      }
    },
    onError: (err: Error) => {
      toast.error("Erro: " + err.message);
    },
  });

  const sportNames = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.sport_name) set.add(r.sport_name); });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.sport_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterFamily !== "all" && r.family !== filterFamily) return false;
      if (filterPreset !== "all" && r.preset_key !== filterPreset) return false;
      if (filterStatus === "missing" && r.has_rules) return false;
      if (filterStatus === "configured" && !r.has_rules) return false;
      if (filterSport !== "all" && r.sport_name !== filterSport) return false;
      if (filterJerpa === "jerpa" && !r.is_jerpa) return false;
      if (filterJerpa === "jer" && r.is_jerpa) return false;
      if (filterCategory !== "all") {
        const preset = SPORT_PRESET_CATALOG.find((p) => p.key === r.preset_key);
        if (!preset || preset.category !== filterCategory) return false;
      }
      return true;
    });
  }, [rows, search, filterFamily, filterPreset, filterStatus, filterSport, filterJerpa, filterCategory]);

  const usedPresets = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.preset_key) set.add(r.preset_key); });
    return Array.from(set).sort();
  }, [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const configured = rows.filter((r) => r.has_rules).length;
    const missing = total - configured;
    const jerpa = rows.filter((r) => r.is_jerpa).length;
    return { total, configured, missing, jerpa };
  }, [rows]);

  function getStatusBadge(row: SportEventRow) {
    if (!row.has_rules) return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Sem regra</Badge>;
    if (row.is_active === false) return <Badge variant="secondary" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Inativa</Badge>;
    return <Badge variant="default" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />Configurada</Badge>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <ModuleHeader route="/admin/competicao/regras/lote" title="Regras em Lote" />
        <Alert variant="destructive"><AlertDescription>{String(error)}</AlertDescription></Alert>
        <Button onClick={() => refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader route="/admin/competicao/regras/lote" title="Regras em Lote" />

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Provas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.configured}</p>
            <p className="text-xs text-muted-foreground">Configuradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.missing}</p>
            <p className="text-xs text-muted-foreground">Sem regra</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.jerpa}</p>
            <p className="text-xs text-muted-foreground">JERPA</p>
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Ações em Massa</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => seedMutation.mutate({ mode: "missing_only", dryRun: true })} disabled={seedMutation.isPending}>
            <Eye className="h-4 w-4 mr-1" />Dry Run
          </Button>
          <Button size="sm" onClick={() => seedMutation.mutate({ mode: "missing_only", dryRun: false })} disabled={seedMutation.isPending}>
            <Zap className="h-4 w-4 mr-1" />Gerar (somente faltantes)
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={seedMutation.isPending}>
                <RefreshCw className="h-4 w-4 mr-1" />Regerar (sobrescrever)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sobrescrever regras existentes?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isto vai substituir TODAS as regras existentes para as {stats.total} provas do evento.
                  As configurações manuais serão perdidas. Esta ação requer perfil admin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => seedMutation.mutate({ mode: "overwrite", dryRun: false })}>Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Report */}
      {lastReport && (
        <Alert>
          <AlertDescription className="text-xs">
            <strong>{lastReport.dry_run ? "Simulação" : "Resultado"}:</strong>{" "}
            {lastReport.created} criadas, {lastReport.updated} atualizadas, {lastReport.skipped} ignoradas.
            {" — "}Presets: {Object.entries(lastReport.by_preset).map(([k, v]) => `${k}: ${v}`).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar prova..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="missing">Sem regra</SelectItem>
            <SelectItem value="configured">Configuradas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterFamily} onValueChange={setFilterFamily}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Família" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas famílias</SelectItem>
            {FAMILIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSport} onValueChange={setFilterSport}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Modalidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas modalidades</SelectItem>
            {sportNames.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterJerpa} onValueChange={setFilterJerpa}>
          <SelectTrigger className="w-32"><SelectValue placeholder="JER/JERPA" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">JER + JERPA</SelectItem>
            <SelectItem value="jer">JER</SelectItem>
            <SelectItem value="jerpa">JERPA</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo de preset" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {PRESET_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPreset} onValueChange={setFilterPreset}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Preset" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos presets</SelectItem>
            {usedPresets.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            {SPORT_PRESET_CATALOG.map((sp) =>
              !usedPresets.includes(sp.key) ? <SelectItem key={sp.key} value={sp.key}>{sp.label}</SelectItem> : null
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modalidade</TableHead>
                <TableHead>Prova</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preset</TableHead>
                <TableHead>Família</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead className="text-center">Mín.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma prova encontrada</TableCell></TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs font-medium">
                      {row.sport_name}
                      {row.is_jerpa && (
                        <Badge variant="outline" className="ml-1 text-[9px] border-blue-400 text-blue-600">
                          <Accessibility className="h-2.5 w-2.5 mr-0.5" />JERPA
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{row.name}</TableCell>
                    <TableCell className="text-xs">{row.category_name} ({row.gender_scope})</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{row.preset_key || "—"}</Badge></TableCell>
                    <TableCell className="text-xs">{row.family || "—"}</TableCell>
                    <TableCell className="text-xs">{row.format || "—"}</TableCell>
                    <TableCell className="text-center text-xs font-medium">{row.minimo_participantes}</TableCell>
                    <TableCell>{getStatusBadge(row)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/admin/competicao/regras?sport_event_id=${row.id}`}>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Preset catalog reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Catálogo de Presets Disponíveis ({SPORT_PRESET_CATALOG.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {PRESET_CATEGORIES.map((cat) => {
            const presets = SPORT_PRESET_CATALOG.filter((p) => p.category === cat.value);
            if (presets.length === 0) return null;
            return (
              <div key={cat.value} className="mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{cat.label}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {presets.map((preset) => (
                    <div key={preset.key} className="border rounded-md p-3 space-y-1">
                      <p className="text-sm font-medium">{preset.label}</p>
                      <p className="text-xs text-muted-foreground">{preset.description}</p>
                      <div className="flex gap-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{preset.rules.family}</Badge>
                        <Badge variant="outline" className="text-[10px]">{preset.rules.format}</Badge>
                        {preset.category === "paralimpica" && (
                          <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-600">JERPA</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
