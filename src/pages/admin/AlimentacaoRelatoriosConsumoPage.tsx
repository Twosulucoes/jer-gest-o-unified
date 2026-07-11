import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  Download,
  Utensils,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiStatCard } from "@/components/shared/KpiStatCard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  useRelatorioConsumo,
  type RelatorioFiltros,
  type SyncStatus,
  type OrigemFilter,
} from "@/hooks/useRelatorioConsumo";

// ── Sorting helper ────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";

function useSortedRows<T>(rows: T[]) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const onSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: keyof T }) =>
    sortKey === col ? (
      sortDir === "asc" ? (
        <ChevronUp className="inline h-3 w-3 ml-1" />
      ) : (
        <ChevronDown className="inline h-3 w-3 ml-1" />
      )
    ) : null;

  return { sorted, onSort, SortIcon };
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm");
  } catch {
    return iso;
  }
}

function fmtTime(t: string | null) {
  return t ? t.slice(0, 5) : "—";
}

function fmtNum(n: number | null | undefined) {
  return n !== null && n !== undefined ? String(n) : "—";
}

function SyncBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    realtime: {
      label: "Tempo real",
      cls: "bg-green-100 text-green-800 border-green-200",
    },
    queue: {
      label: "Fila offline",
      cls: "bg-amber-100 text-amber-800 border-amber-200",
    },
    duplicidade: {
      label: "Duplicidade",
      cls: "bg-red-100 text-red-800 border-red-200",
    },
  };
  const cfg = map[status] ?? map.realtime;
  return (
    <Badge variant="outline" className={`text-xs ${cfg.cls}`}>
      {cfg.label}
    </Badge>
  );
}

function OrigemBadge({ origem }: { origem: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    scan_qr: {
      label: "QR",
      cls: "bg-blue-100 text-blue-800 border-blue-200",
    },
    busca_manual: {
      label: "Manual",
      cls: "bg-purple-100 text-purple-800 border-purple-200",
    },
    voucher: {
      label: "Voucher",
      cls: "bg-orange-100 text-orange-800 border-orange-200",
    },
  };
  const cfg = map[origem] ?? { label: origem, cls: "" };
  return (
    <Badge variant="outline" className={`text-xs ${cfg.cls}`}>
      {cfg.label}
    </Badge>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AlimentacaoRelatoriosConsumoPage() {
  const eventId = useActiveEventId();
  const { hasRole } = useAuth();
  const { isStageScoped, stageId } = useStageScope();

  const canExport =
    hasRole("admin") || hasRole("secretaria") || hasRole("alimentacao");

  // Filters
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [etapaId, setEtapaId] = useState(isStageScoped && stageId ? stageId : "");
  const [operadorId, setOperadorId] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("all");
  const [origem, setOrigem] = useState<OrigemFilter>("all");

  const [tab, setTab] = useState("dia");

  const filtros: RelatorioFiltros = {
    eventId,
    etapaId: etapaId || undefined,
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    operadorId: operadorId || undefined,
    syncStatus,
    origem,
    // A aba "Completo" é a única que usa a lista bruta (e seu botão de export
    // só existe lá) — carrega sob demanda para não puxar até 50k linhas em
    // toda visita à tela.
    loadCompleto: tab === "completo",
  };

  const { completo, porDia, porJanela, porOperador, erros, porEtapa, resumo, isLoading, exportCSV } =
    useRelatorioConsumo(filtros);

  // Reference data for filter selects
  const { data: etapas = [] } = useQuery({
    queryKey: ["event_stages", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_stages")
        .select("id, name")
        .eq("event_id", eventId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: operadores = [] } = useQuery({
    queryKey: ["meal-operadores", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vw_consumo_por_operador")
        .select("operador_id, operador_nome")
        .eq("event_id", eventId)
        .limit(20000);
      if (error) return [];
      const seen = new Set<string>();
      return (data ?? []).filter((r: any) => {
        if (seen.has(r.operador_id)) return false;
        seen.add(r.operador_id);
        return true;
      }) as Array<{ operador_id: string; operador_nome: string }>;
    },
  });

  const handleLimpar = () => {
    setDataInicio("");
    setDataFim("");
    setEtapaId(isStageScoped && stageId ? stageId : "");
    setOperadorId("");
    setSyncStatus("all");
    setOrigem("all");
  };

  // Quality badge
  const qualityOk = resumo.totalRefeicoes === 0 || resumo.totalDuplicidade === 0;

  if (!eventId) {
    return (
      <div className="p-6 text-muted-foreground">
        Nenhum evento ativo selecionado.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Utensils className="h-5 w-5 text-primary" />
            Relatórios de Consumo
          </h1>
          <p className="text-sm text-muted-foreground">
            Auditoria completa: operadores, janelas, sync e origem do dado
          </p>
        </div>
        {qualityOk ? (
          <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            100% sincronizado
          </Badge>
        ) : (
          <Badge className="bg-red-100 text-red-800 border-red-200 gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            {resumo.totalDuplicidade} registro(s) com alerta
          </Badge>
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Date range */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Data início</label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-36 h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Data fim</label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-36 h-8 text-sm"
              />
            </div>

            {/* Etapa */}
            {!isStageScoped && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Etapa</label>
                <Select value={etapaId || "all"} onValueChange={(v) => setEtapaId(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-44 h-8 text-sm">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as etapas</SelectItem>
                    {etapas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Operador */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Operador</label>
              <Select value={operadorId || "all"} onValueChange={(v) => setOperadorId(v === "all" ? "" : v)}>
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os operadores</SelectItem>
                  {operadores.map((o) => (
                    <SelectItem key={o.operador_id} value={o.operador_id}>
                      {o.operador_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sync status */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Status sync</label>
              <Select value={syncStatus} onValueChange={(v) => setSyncStatus(v as SyncStatus)}>
                <SelectTrigger className="w-36 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="realtime">Tempo real</SelectItem>
                  <SelectItem value="queue">Fila offline</SelectItem>
                  <SelectItem value="duplicidade">Duplicidade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Origem */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Origem</label>
              <Select value={origem} onValueChange={(v) => setOrigem(v as OrigemFilter)}>
                <SelectTrigger className="w-36 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="scan_qr">Scan QR</SelectItem>
                  <SelectItem value="busca_manual">Busca manual</SelectItem>
                  <SelectItem value="voucher">Voucher</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-muted-foreground"
              onClick={handleLimpar}
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Summary cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiStatCard
          label="Total Refeições"
          value={resumo.totalRefeicoes}
          icon={<Utensils className="h-4 w-4 text-muted-foreground" />}
          loading={isLoading}
        />
        <KpiStatCard
          label="Tempo real"
          value={resumo.totalRealtime}
          sub={resumo.totalRefeicoes > 0 ? `${resumo.pctRealtime}%` : undefined}
          icon={<Wifi className="h-4 w-4 text-green-600" />}
          loading={isLoading}
        />
        <KpiStatCard
          label="Em fila offline"
          value={resumo.totalQueue}
          icon={<WifiOff className="h-4 w-4 text-amber-600" />}
          loading={isLoading}
        />
        <KpiStatCard
          label="Duplicidades"
          value={resumo.totalDuplicidade}
          icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
          loading={isLoading}
        />
      </div>

      {/* ── Data quality indicator ────────────────────────────────────────────── */}
      {resumo.totalRefeicoes > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${resumo.pctRealtime}%` }}
            />
          </div>
          <span>
            {resumo.pctRealtime}% em tempo real · {100 - resumo.pctRealtime}% via fila
          </span>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="dia">Por Dia</TabsTrigger>
          <TabsTrigger value="janela">Por Janela</TabsTrigger>
          <TabsTrigger value="operador">Por Operador</TabsTrigger>
          <TabsTrigger value="etapa">Por Etapa</TabsTrigger>
          <TabsTrigger value="erros" className="data-[state=active]:text-red-600">
            Erros Sync
            {erros.length > 0 && (
              <span className="ml-1.5 rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-medium">
                {erros.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completo">Completo</TabsTrigger>
        </TabsList>

        {/* ── Por Dia ── */}
        <TabsContent value="dia">
          <TableCard
            title="Consumo por Dia"
            note="Totais agregados por dia — não são filtrados por Operador/Status de sync/Origem (esses filtros só afetam Completo, Por Operador e Erros Sync)."
            onExport={canExport ? exportCSV.porDia : undefined}
            loading={isLoading}
            empty={porDia.length === 0}
          >
            <PorDiaTable rows={porDia} />
          </TableCard>
        </TabsContent>

        {/* ── Por Janela ── */}
        <TabsContent value="janela">
          <TableCard
            title="Consumo por Janela"
            note="Totais agregados por janela — não são filtrados por Operador/Status de sync/Origem (esses filtros só afetam Completo, Por Operador e Erros Sync)."
            onExport={canExport ? exportCSV.porJanela : undefined}
            loading={isLoading}
            empty={porJanela.length === 0}
          >
            <PorJanelaTable rows={porJanela} />
          </TableCard>
        </TabsContent>

        {/* ── Por Operador ── */}
        <TabsContent value="operador">
          <TableCard
            title="Consumo por Operador"
            note="Não é filtrada por Status de sync/Origem — as colunas QR/Manual/Voucher já são a quebra por método."
            onExport={canExport ? exportCSV.porOperador : undefined}
            loading={isLoading}
            empty={porOperador.length === 0}
          >
            <PorOperadorTable rows={porOperador} />
          </TableCard>
        </TabsContent>

        {/* ── Por Etapa ── */}
        <TabsContent value="etapa">
          <TableCard
            title="Consumo por Etapa"
            note="Totais da etapa inteira — não são filtrados por Data início/fim nem por Operador/Status de sync/Origem."
            onExport={canExport ? exportCSV.porEtapa : undefined}
            loading={isLoading}
            empty={porEtapa.length === 0}
          >
            <PorEtapaTable rows={porEtapa} />
          </TableCard>
        </TabsContent>

        {/* ── Erros Sync ── */}
        <TabsContent value="erros">
          <TableCard
            title="Registros com Alerta de Sync"
            onExport={canExport ? exportCSV.erros : undefined}
            loading={isLoading}
            empty={erros.length === 0}
            emptyMsg="Nenhum registro com alerta de sincronização."
          >
            <ErrosSyncTable rows={erros} />
          </TableCard>
        </TabsContent>

        {/* ── Completo ── */}
        <TabsContent value="completo">
          <TableCard
            title="Todos os Consumos"
            onExport={canExport ? exportCSV.completo : undefined}
            loading={isLoading}
            empty={completo.length === 0}
          >
            <CompletoTable rows={completo} />
          </TableCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Shared card wrapper ───────────────────────────────────────────────────────

function TableCard({
  title,
  note,
  onExport,
  loading,
  empty,
  emptyMsg = "Nenhum dado para os filtros selecionados.",
  children,
}: {
  title: string;
  note?: string;
  onExport?: () => void;
  loading: boolean;
  empty: boolean;
  emptyMsg?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mt-2">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {note && <p className="text-[11px] text-muted-foreground mt-0.5">{note}</p>}
        </div>
        {onExport && (
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={onExport}>
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0 overflow-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : empty ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{emptyMsg}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// ── Por Dia table ─────────────────────────────────────────────────────────────

function PorDiaTable({ rows }: { rows: ReturnType<typeof useRelatorioConsumo>["porDia"] }) {
  const { sorted, onSort, SortIcon } = useSortedRows(rows);
  const totals = useMemo(
    () => ({
      total_consumos: rows.reduce((s, r) => s + r.total_consumos, 0),
      total_realtime: rows.reduce((s, r) => s + r.total_realtime, 0),
      total_queue: rows.reduce((s, r) => s + r.total_queue, 0),
      total_duplicidade: rows.reduce((s, r) => s + r.total_duplicidade, 0),
      usuarios_distintos: rows.reduce((s, r) => s + r.usuarios_distintos, 0),
      participantes_distintos: rows.reduce((s, r) => s + r.participantes_distintos, 0),
    }),
    [rows],
  );
  type Col = keyof (typeof rows)[0];
  const th = (col: Col, label: string, cls = "") => (
    <TableHead className={`cursor-pointer select-none ${cls}`} onClick={() => onSort(col)}>
      {label}
      <SortIcon col={col} />
    </TableHead>
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {th("data", "Data")}
          {th("etapa_nome", "Etapa")}
          {th("total_consumos", "Total", "text-right")}
          {th("total_realtime", "Tempo real", "text-right")}
          {th("total_queue", "Fila", "text-right")}
          {th("total_duplicidade", "Duplicid.", "text-right")}
          {th("usuarios_distintos", "Operadores", "text-right")}
          {th("participantes_distintos", "Participantes", "text-right")}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{r.data}</TableCell>
            <TableCell>{r.etapa_nome ?? "—"}</TableCell>
            <TableCell className="text-right font-medium">{r.total_consumos}</TableCell>
            <TableCell className="text-right text-green-700">{r.total_realtime}</TableCell>
            <TableCell className="text-right text-amber-700">{r.total_queue}</TableCell>
            <TableCell className="text-right text-red-700">{r.total_duplicidade}</TableCell>
            <TableCell className="text-right">{r.usuarios_distintos}</TableCell>
            <TableCell className="text-right">{r.participantes_distintos}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <tfoot>
        <tr className="border-t bg-muted/40 font-medium text-sm">
          <td className="px-4 py-2" colSpan={2}>
            Total ({rows.length} dias)
          </td>
          <td className="px-4 py-2 text-right">{totals.total_consumos}</td>
          <td className="px-4 py-2 text-right text-green-700">{totals.total_realtime}</td>
          <td className="px-4 py-2 text-right text-amber-700">{totals.total_queue}</td>
          <td className="px-4 py-2 text-right text-red-700">{totals.total_duplicidade}</td>
          <td className="px-4 py-2 text-right">—</td>
          <td className="px-4 py-2 text-right">—</td>
        </tr>
      </tfoot>
    </Table>
  );
}

// ── Por Janela table ──────────────────────────────────────────────────────────

function PorJanelaTable({ rows }: { rows: ReturnType<typeof useRelatorioConsumo>["porJanela"] }) {
  const { sorted, onSort, SortIcon } = useSortedRows(rows);
  const totals = useMemo(
    () => ({
      total: rows.reduce((s, r) => s + r.total_consumos, 0),
      realtime: rows.reduce((s, r) => s + r.total_realtime, 0),
      queue: rows.reduce((s, r) => s + r.total_queue, 0),
    }),
    [rows],
  );
  type Col = keyof (typeof rows)[0];
  const th = (col: Col, label: string, cls = "") => (
    <TableHead className={`cursor-pointer select-none ${cls}`} onClick={() => onSort(col)}>
      {label}
      <SortIcon col={col} />
    </TableHead>
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {th("data", "Data")}
          {th("etapa_nome", "Etapa")}
          {th("janela_nome", "Janela")}
          {th("refeicao_tipo", "Refeição")}
          <TableHead>Horário</TableHead>
          {th("total_consumos", "Total", "text-right")}
          {th("total_realtime", "Realtime", "text-right")}
          {th("total_queue", "Fila", "text-right")}
          {th("primeiro_consumo", "Primeiro", "text-right")}
          {th("ultimo_consumo", "Último", "text-right")}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{r.data}</TableCell>
            <TableCell>{r.etapa_nome ?? "—"}</TableCell>
            <TableCell>{r.janela_nome}</TableCell>
            <TableCell>{r.refeicao_tipo}</TableCell>
            <TableCell className="text-xs whitespace-nowrap">
              {fmtTime(r.horario_inicio)} – {fmtTime(r.horario_fim)}
            </TableCell>
            <TableCell className="text-right font-medium">{r.total_consumos}</TableCell>
            <TableCell className="text-right text-green-700">{r.total_realtime}</TableCell>
            <TableCell className="text-right text-amber-700">{r.total_queue}</TableCell>
            <TableCell className="text-right text-xs">{fmtDateTime(r.primeiro_consumo)}</TableCell>
            <TableCell className="text-right text-xs">{fmtDateTime(r.ultimo_consumo)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <tfoot>
        <tr className="border-t bg-muted/40 font-medium text-sm">
          <td className="px-4 py-2" colSpan={5}>
            Total ({rows.length} janelas)
          </td>
          <td className="px-4 py-2 text-right">{totals.total}</td>
          <td className="px-4 py-2 text-right text-green-700">{totals.realtime}</td>
          <td className="px-4 py-2 text-right text-amber-700">{totals.queue}</td>
          <td className="px-4 py-2" colSpan={2} />
        </tr>
      </tfoot>
    </Table>
  );
}

// ── Por Operador table ────────────────────────────────────────────────────────

function PorOperadorTable({ rows }: { rows: ReturnType<typeof useRelatorioConsumo>["porOperador"] }) {
  const { sorted, onSort, SortIcon } = useSortedRows(rows);
  const totals = useMemo(
    () => ({
      total: rows.reduce((s, r) => s + r.total_registrado, 0),
      qr: rows.reduce((s, r) => s + r.total_scan_qr, 0),
      manual: rows.reduce((s, r) => s + r.total_manual, 0),
      voucher: rows.reduce((s, r) => s + r.total_voucher, 0),
    }),
    [rows],
  );
  type Col = keyof (typeof rows)[0];
  const th = (col: Col, label: string, cls = "") => (
    <TableHead className={`cursor-pointer select-none ${cls}`} onClick={() => onSort(col)}>
      {label}
      <SortIcon col={col} />
    </TableHead>
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {th("operador_nome", "Operador")}
          {th("data", "Data")}
          {th("etapa_nome", "Etapa")}
          {th("janela_nome", "Janela")}
          {th("total_registrado", "Total", "text-right")}
          {th("total_scan_qr", "QR", "text-right")}
          {th("total_manual", "Manual", "text-right")}
          {th("total_voucher", "Voucher", "text-right")}
          {th("media_intervalo_segundos", "Intervalo médio (s)", "text-right")}
          {th("primeiro_scan", "Primeiro", "text-right")}
          {th("ultimo_scan", "Último", "text-right")}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{r.operador_nome}</TableCell>
            <TableCell>{r.data}</TableCell>
            <TableCell>{r.etapa_nome ?? "—"}</TableCell>
            <TableCell>{r.janela_nome}</TableCell>
            <TableCell className="text-right font-medium">{r.total_registrado}</TableCell>
            <TableCell className="text-right">{r.total_scan_qr}</TableCell>
            <TableCell className="text-right">{r.total_manual}</TableCell>
            <TableCell className="text-right">{r.total_voucher}</TableCell>
            <TableCell className="text-right text-xs">{fmtNum(r.media_intervalo_segundos)}</TableCell>
            <TableCell className="text-right text-xs">{fmtDateTime(r.primeiro_scan)}</TableCell>
            <TableCell className="text-right text-xs">{fmtDateTime(r.ultimo_scan)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <tfoot>
        <tr className="border-t bg-muted/40 font-medium text-sm">
          <td className="px-4 py-2" colSpan={4}>
            Total ({rows.length} linhas)
          </td>
          <td className="px-4 py-2 text-right">{totals.total}</td>
          <td className="px-4 py-2 text-right">{totals.qr}</td>
          <td className="px-4 py-2 text-right">{totals.manual}</td>
          <td className="px-4 py-2 text-right">{totals.voucher}</td>
          <td className="px-4 py-2" colSpan={3} />
        </tr>
      </tfoot>
    </Table>
  );
}

// ── Por Etapa table ───────────────────────────────────────────────────────────

function PorEtapaTable({ rows }: { rows: ReturnType<typeof useRelatorioConsumo>["porEtapa"] }) {
  const { sorted, onSort, SortIcon } = useSortedRows(rows);
  const totals = useMemo(
    () => ({
      refeicoes: rows.reduce((s, r) => s + r.total_refeicoes, 0),
      participantes: rows.reduce((s, r) => s + r.total_participantes_distintos, 0),
      erros: rows.reduce((s, r) => s + r.total_erros, 0),
      queue: rows.reduce((s, r) => s + r.total_queue, 0),
    }),
    [rows],
  );
  type Col = keyof (typeof rows)[0];
  const th = (col: Col, label: string, cls = "") => (
    <TableHead className={`cursor-pointer select-none ${cls}`} onClick={() => onSort(col)}>
      {label}
      <SortIcon col={col} />
    </TableHead>
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {th("etapa_nome", "Etapa")}
          {th("data_inicio", "Início")}
          {th("data_fim", "Fim")}
          {th("total_refeicoes", "Refeições", "text-right")}
          {th("total_participantes_distintos", "Participantes", "text-right")}
          {th("media_por_dia", "Média/dia", "text-right")}
          {th("total_realtime", "Realtime", "text-right")}
          {th("total_queue", "Fila", "text-right")}
          {/* "Erros"/"% Erro" medem só duplicidade_detectada — fila offline
              já tem coluna própria ("Fila") ao lado. O rótulo "% Duplic."
              deixa isso explícito (evita confusão com a aba "Erros Sync",
              que soma fila OU duplicidade sob o mesmo rótulo "erro"). */}
          {th("total_erros", "Duplicidades", "text-right")}
          {th("taxa_erro_percent", "% Duplic.", "text-right")}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r) => (
          <TableRow key={r.etapa_id}>
            <TableCell className="font-medium">{r.etapa_nome}</TableCell>
            <TableCell>{r.data_inicio ?? "—"}</TableCell>
            <TableCell>{r.data_fim ?? "—"}</TableCell>
            <TableCell className="text-right font-medium">{r.total_refeicoes}</TableCell>
            <TableCell className="text-right">{r.total_participantes_distintos}</TableCell>
            <TableCell className="text-right">{r.media_por_dia}</TableCell>
            <TableCell className="text-right text-green-700">{r.total_realtime}</TableCell>
            <TableCell className="text-right text-amber-700">{r.total_queue}</TableCell>
            <TableCell className="text-right text-red-700">{r.total_erros}</TableCell>
            <TableCell className="text-right text-xs">
              {r.taxa_erro_percent > 0 ? (
                <span className="text-red-600">{r.taxa_erro_percent}%</span>
              ) : (
                <span className="text-green-600">0%</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <tfoot>
        <tr className="border-t bg-muted/40 font-medium text-sm">
          <td className="px-4 py-2" colSpan={3}>
            Total ({rows.length} etapas)
          </td>
          <td className="px-4 py-2 text-right">{totals.refeicoes}</td>
          <td className="px-4 py-2 text-right">{totals.participantes}</td>
          <td className="px-4 py-2">—</td>
          <td className="px-4 py-2">—</td>
          <td className="px-4 py-2 text-right text-amber-700">{totals.queue}</td>
          <td className="px-4 py-2 text-right text-red-700">{totals.erros}</td>
          <td className="px-4 py-2">—</td>
        </tr>
      </tfoot>
    </Table>
  );
}

// ── Erros Sync table ──────────────────────────────────────────────────────────

function ErrosSyncTable({ rows }: { rows: ReturnType<typeof useRelatorioConsumo>["erros"] }) {
  const { sorted, onSort, SortIcon } = useSortedRows(rows);
  type Col = keyof (typeof rows)[0];
  const th = (col: Col, label: string, cls = "") => (
    <TableHead className={`cursor-pointer select-none ${cls}`} onClick={() => onSort(col)}>
      {label}
      <SortIcon col={col} />
    </TableHead>
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {th("consumed_at", "Consumido em")}
          {th("participante_nome", "Participante")}
          {th("etapa_nome", "Etapa")}
          {th("janela_nome", "Janela")}
          {th("sync_status", "Status")}
          {th("sync_delay_segundos", "Delay sync (s)", "text-right")}
          {th("registrado_por_nome", "Operador")}
          {th("method", "Método")}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(r.consumed_at)}</TableCell>
            <TableCell className="font-medium">{r.participante_nome}</TableCell>
            <TableCell>{r.etapa_nome ?? "—"}</TableCell>
            <TableCell>{r.janela_nome}</TableCell>
            <TableCell>
              <SyncBadge status={r.sync_status} />
            </TableCell>
            <TableCell className="text-right">
              {fmtNum(r.sync_delay_segundos)}
            </TableCell>
            <TableCell>{r.registrado_por_nome ?? "—"}</TableCell>
            <TableCell>
              <OrigemBadge origem={r.method === "qr_scan" ? "scan_qr" : r.method === "manual" ? "busca_manual" : r.method} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Completo table ────────────────────────────────────────────────────────────

function CompletoTable({ rows }: { rows: ReturnType<typeof useRelatorioConsumo>["completo"] }) {
  const { sorted, onSort, SortIcon } = useSortedRows(rows);
  type Col = keyof (typeof rows)[0];
  const th = (col: Col, label: string, cls = "") => (
    <TableHead className={`cursor-pointer select-none ${cls}`} onClick={() => onSort(col)}>
      {label}
      <SortIcon col={col} />
    </TableHead>
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {th("consumed_at", "Consumido em")}
          {th("participante_nome", "Participante")}
          {th("participante_cpf", "CPF")}
          {th("etapa_nome", "Etapa")}
          {th("janela_nome", "Janela")}
          {th("refeicao_tipo", "Refeição")}
          {th("registrado_por_nome", "Operador")}
          {th("sync_status", "Sync")}
          {th("origem", "Origem")}
          {th("duplicidade_detectada", "Dupl.")}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(r.consumed_at)}</TableCell>
            <TableCell className="font-medium">{r.participante_nome}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{r.participante_cpf ?? "—"}</TableCell>
            <TableCell>{r.etapa_nome ?? "—"}</TableCell>
            <TableCell>{r.janela_nome}</TableCell>
            <TableCell>{r.refeicao_tipo}</TableCell>
            <TableCell>{r.registrado_por_nome ?? "—"}</TableCell>
            <TableCell>
              <SyncBadge status={r.sync_status} />
            </TableCell>
            <TableCell>
              <OrigemBadge origem={r.origem} />
            </TableCell>
            <TableCell>
              {r.duplicidade_detectada ? (
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">
                  Sim
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
