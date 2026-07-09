import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import { useStageScope } from "@/hooks/useStageScope";
import { format } from "date-fns";
import { dayRangeRoraima } from "@/lib/dayRangeRoraima";
import {
  Download,
  Utensils,
  AlertCircle,
  Info,
  FileText,
  Table as TableIcon,
  FileSpreadsheet,
  BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiStatCard } from "@/components/shared/KpiStatCard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadCsv, downloadXlsxSheets, downloadXlsx } from "@/lib/reportExport";

export default function AlimentacaoRelatoriosPage() {
  const eventId = useActiveEventId();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { isStageScoped, stageId, stage } = useStageScope();

  const canExport = hasRole("admin") || hasRole("secretaria") || hasRole("alimentacao");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [delegationFilter, setDelegationFilter] = useState("all");
  const [mealTypeFilter, setMealTypeFilter] = useState("all");
  const [signature, setSignature] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const { data: delegations = [] } = useQuery({
    queryKey: ["delegations-list", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegations")
        .select("id, institutions(name)")
        .eq("event_id", eventId!)
        .order("created_at");

      if (error) throw error;
      return data as any[];
    },
  });

  const { data: mealTypes = [] } = useQuery({
    queryKey: ["meal-types", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_types")
        .select("id, name")
        .eq("event_id", eventId!)
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: consumptions = [], isLoading, isError } = useQuery({
    queryKey: [
      "food-report",
      eventId,
      stageId,
      startDate,
      endDate,
      delegationFilter,
      mealTypeFilter,
    ],
    enabled: !!eventId,
    queryFn: async () => {
      if (!eventId) return [];

      // Janelas do evento/etapa — usadas para (a) escopar service_voucher_uses
      // por context_id (a tabela não tem FK declarada para meal_windows, então
      // o embed `meal_windows!inner()` do PostgREST não funciona nela — tem
      // que ser um lookup manual) e (b) resolver os campos de exibição do
      // voucher (janela/tipo de refeição), mesmo padrão já usado em
      // AlimentacaoListaConsumosPage.tsx.
      let windowsQ = supabase
        .from("meal_windows")
        .select("id, label, service_date, meal_type_id, event_stage_id, meal_types(name)")
        .eq("event_id", eventId)
        .limit(5000);
      if (isStageScoped && stageId) windowsQ = windowsQ.eq("event_stage_id", stageId);
      const { data: windowsData, error: windowsError } = await windowsQ;
      if (windowsError) throw windowsError;
      const windowList = windowsData ?? [];
      const windowMap = new Map(windowList.map((w: any) => [w.id, w]));
      const windowIds = windowList.map((w: any) => w.id);

      // .limit() explícito: sem ele, as 3 queries ficam sujeitas ao corte
      // padrão de 1000 linhas do PostgREST, subcontando silenciosamente
      // "Total consumos"/os exports em eventos grandes.
      let linkedQ = supabase
        .from("meal_consumptions")
        .select(`
          *,
          meal_windows!inner(id, label, service_date, meal_type_id, event_id, event_stage_id, meal_types(name)),
          participants(person:people(full_name), delegation_id, delegations(institutions(name)))
        `)
        .eq("meal_windows.event_id", eventId)
        .not("meal_window_id", "is", null)
        .order("consumed_at", { ascending: false })
        .limit(20000);

      let unlinkedQ = (supabase as any)
        .from("meal_consumptions_unlinked")
        .select(`
          *,
          meal_windows!inner(id, label, service_date, meal_type_id, event_id, event_stage_id, meal_types(name))
        `)
        .eq("meal_windows.event_id", eventId)
        .not("meal_window_id", "is", null)
        .order("consumed_at", { ascending: false })
        .limit(20000);

      let voucherQ = windowIds.length > 0
        ? supabase
            .from("service_voucher_uses")
            .select(`
              id, used_at, context_id,
              service_vouchers!inner(label, voucher_type, is_nominal, service_eventual_people(full_name))
            `)
            .eq("service_kind", "meals")
            .in("context_id", windowIds)
            .order("used_at", { ascending: false })
            .limit(20000)
        : null;

      if (isStageScoped && stageId) {
        linkedQ = linkedQ.eq("meal_windows.event_stage_id", stageId);
        unlinkedQ = unlinkedQ.eq("meal_windows.event_stage_id", stageId);
      }

      // consumed_at/used_at são timestamptz; limites sem offset eram
      // interpretados no fuso da sessão (tipicamente UTC), deslocando o
      // "dia" filtrado em 4h em relação ao horário local de Roraima e
      // cortando consumos do fim da noite (ex.: jantar após ~20h local) do
      // dia a que pertencem.
      if (startDate) {
        const { startIso } = dayRangeRoraima(startDate);
        linkedQ = linkedQ.gte("consumed_at", startIso);
        unlinkedQ = unlinkedQ.gte("consumed_at", startIso);
        if (voucherQ) voucherQ = voucherQ.gte("used_at", startIso);
      }

      if (endDate) {
        const { endIsoExclusive } = dayRangeRoraima(endDate);
        linkedQ = linkedQ.lt("consumed_at", endIsoExclusive);
        unlinkedQ = unlinkedQ.lt("consumed_at", endIsoExclusive);
        if (voucherQ) voucherQ = voucherQ.lt("used_at", endIsoExclusive);
      }

      if (delegationFilter !== "all") {
        linkedQ = linkedQ.eq("participants.delegation_id", delegationFilter);
        // QR não vinculado e voucher não têm delegação atribuível. Então não
        // entram quando filtra delegação.
        unlinkedQ = unlinkedQ.eq("id", "00000000-0000-0000-0000-000000000000");
        voucherQ = null;
      }

      const [
        { data: linkedData, error: linkedError },
        { data: unlinkedData, error: unlinkedError },
        voucherRes,
      ] = await Promise.all([linkedQ, unlinkedQ, voucherQ ?? Promise.resolve({ data: [], error: null })]);

      if (linkedError) throw linkedError;
      if (unlinkedError) throw unlinkedError;
      if (voucherRes.error) throw voucherRes.error;

      let linked = (linkedData ?? []).map((c: any) => ({
        ...c,
        source_type: "linked",
        display_name: c.participants?.person?.full_name || "—",
        display_delegation:
          c.participants?.delegations?.institutions?.name || "Sem delegação",
        display_method: c.method || "scan",
        qr_code: null,
      }));

      let unlinked = (unlinkedData ?? []).map((c: any) => ({
        ...c,
        source_type: "unlinked",
        participants: null,
display_name: `Consumo avulso: ${c.qr_code}`,
display_delegation: "Não informado",
        display_method: c.method || "qr_scan",
        qr_code: c.qr_code,
      }));

      let vouchers = ((voucherRes.data as any[]) ?? []).map((u: any) => {
        const win = windowMap.get(u.context_id);
        const sv = u.service_vouchers;
        const personName = sv?.service_eventual_people?.full_name || sv?.label || "Portador de Voucher";
        return {
          id: u.id,
          consumed_at: u.used_at,
          meal_window_id: u.context_id,
          meal_windows: win ?? null,
          source_type: "voucher",
          participants: null,
          display_name: personName,
          display_delegation: "Não informado",
          display_method: "voucher",
          method: "voucher",
          qr_code: null,
        };
      });

      if (mealTypeFilter !== "all") {
        linked = linked.filter((c: any) => c.meal_windows?.meal_type_id === mealTypeFilter);
        unlinked = unlinked.filter((c: any) => c.meal_windows?.meal_type_id === mealTypeFilter);
        vouchers = vouchers.filter((c: any) => c.meal_windows?.meal_type_id === mealTypeFilter);
      }

      return [...linked, ...unlinked, ...vouchers].sort(
        (a: any, b: any) =>
          new Date(b.consumed_at).getTime() - new Date(a.consumed_at).getTime(),
      );
    },
  });

  const linkedConsumptions = consumptions.filter((c: any) => c.source_type === "linked");
  const unlinkedConsumptions = consumptions.filter((c: any) => c.source_type === "unlinked");
  const voucherConsumptions = consumptions.filter((c: any) => c.source_type === "voucher");

  const totalByType = new Map<string, number>();
  const totalByDelegation = new Map<string, number>();
  const totalBySource = new Map<string, number>();

  const sourceLabel = (sourceType: string) =>
    sourceType === "unlinked" ? "Consumos avulsos" : sourceType === "voucher" ? "Voucher" : "Vinculados";

  consumptions.forEach((c: any) => {
    const typeName = c.meal_windows?.meal_types?.name || "Outro";
    totalByType.set(typeName, (totalByType.get(typeName) || 0) + 1);

    const delName = c.display_delegation || "Sem delegação";
    totalByDelegation.set(delName, (totalByDelegation.get(delName) || 0) + 1);

    const sourceName = sourceLabel(c.source_type);
    totalBySource.set(sourceName, (totalBySource.get(sourceName) || 0) + 1);
  });

  const exportCsv = () => {
    if (!consumptions.length) return;

    const rows = ["Tipo,Participante/QR,Delegação,Refeição,Data/Hora,Método,QR"];

    for (const c of consumptions) {
      const tipo = c.source_type === "unlinked" ? "CONSUMO AVULSO" : c.source_type === "voucher" ? "VOUCHER" : "VINCULADO";
      rows.push([
        `"${tipo}"`,
        `"${c.display_name || ""}"`,
        `"${c.display_delegation || ""}"`,
        `"${c.meal_windows?.label || c.meal_windows?.meal_types?.name || ""}"`,
        c.consumed_at ? format(new Date(c.consumed_at), "dd/MM/yyyy HH:mm") : "",
        c.display_method || "scan",
        c.qr_code || "",
      ].join(","));
    }

rows.push("");
rows.push("RESUMO GERAL");
rows.push(`Credenciais vinculadas,${linkedConsumptions.length}`);
rows.push(`Leituras avulsas,${unlinkedConsumptions.length}`);
rows.push(`Vouchers,${voucherConsumptions.length}`);
rows.push(`Total de consumos,${consumptions.length}`);

    rows.push("");
    rows.push("TOTAIS POR TIPO");
    totalByType.forEach((v, k) => rows.push(`"${k}",${v}`));

    rows.push("");
    rows.push("TOTAIS POR DELEGAÇÃO");
    totalByDelegation.forEach((v, k) => rows.push(`"${k}",${v}`));

    downloadCsv(rows, `relatorio_alimentacao_${startDate || "todos"}.csv`);
    toast.success("CSV exportado com sucesso");
  };

  const exportXlsx = () => {
    if (!consumptions.length) return;

    setIsExporting(true);

try {
  const summaryData: any[] = [
    { Categoria: "RESUMO GERAL", Valor: "" },
    { Categoria: "Credenciais vinculadas", Valor: linkedConsumptions.length },
    { Categoria: "Consumos avulsos", Valor: unlinkedConsumptions.length },
    { Categoria: "Vouchers", Valor: voucherConsumptions.length },
    { Categoria: "Total de consumos", Valor: consumptions.length },
    { Categoria: "", Valor: "" },
    { Categoria: "TOTAIS POR TIPO", Valor: "" },
  ];

      totalByType.forEach((v, k) => summaryData.push({ Categoria: k, Valor: v }));

      summaryData.push({ Categoria: "", Valor: "" });
      summaryData.push({ Categoria: "TOTAIS POR DELEGAÇÃO", Valor: "" });
      totalByDelegation.forEach((v, k) => summaryData.push({ Categoria: k, Valor: v }));

      const vinculadosData = linkedConsumptions.map((c: any) => ({
        Participante: c.display_name || "",
        Delegação: c.display_delegation || "",
        Refeição: c.meal_windows?.label || c.meal_windows?.meal_types?.name || "",
        "Data/Hora": c.consumed_at
          ? format(new Date(c.consumed_at), "dd/MM/yyyy HH:mm")
          : "",
        Método: c.display_method || "scan",
      }));

      const naoVinculadosData = unlinkedConsumptions.map((c: any) => ({
        QR: c.qr_code || "",
        Refeição: c.meal_windows?.label || c.meal_windows?.meal_types?.name || "",
        "Data/Hora": c.consumed_at
          ? format(new Date(c.consumed_at), "dd/MM/yyyy HH:mm")
          : "",
        Método: c.display_method || "qr_scan",
      }));

      const vouchersData = voucherConsumptions.map((c: any) => ({
        Portador: c.display_name || "",
        Refeição: c.meal_windows?.label || c.meal_windows?.meal_types?.name || "",
        "Data/Hora": c.consumed_at
          ? format(new Date(c.consumed_at), "dd/MM/yyyy HH:mm")
          : "",
      }));

const detalheData = consumptions.map((c: any) => ({
  Tipo: c.source_type === "unlinked" ? "CONSUMO AVULSO" : c.source_type === "voucher" ? "VOUCHER" : "VINCULADO",
  "Participante/QR": c.display_name || "",
  Delegação: c.display_delegation || "",
  Refeição: c.meal_windows?.label || c.meal_windows?.meal_types?.name || "",
  "Data/Hora": c.consumed_at
    ? format(new Date(c.consumed_at), "dd/MM/yyyy HH:mm")
    : "",
  Método: c.display_method || "scan",
  QR: c.qr_code || "",
}));

      const filename = `relatorio_alimentacao_${startDate || "geral"}${
        signature ? "_" + signature : ""
      }.xlsx`;

      downloadXlsxSheets(
        [
          { name: "Resumo", rows: summaryData },
          { name: "Detalhe Geral", rows: detalheData },
          { name: "Vinculados", rows: vinculadosData },
          { name: "QR Nao Vinculados", rows: naoVinculadosData },
          { name: "Vouchers", rows: vouchersData },
        ],
        filename,
      );

      toast.success("XLSX exportado com sucesso");
    } catch (e) {
      toast.error("Erro ao exportar XLSX");
    } finally {
      setIsExporting(false);
    }
  };

  const exportPdf = () => {
    if (!consumptions.length) return;

    setIsExporting(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(18);
      doc.text("Relatório de Alimentação", pageWidth / 2, 20, { align: "center" });

      doc.setFontSize(10);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, 28, {
        align: "center",
      });

      if (stage?.name) {
        doc.text(`Etapa: ${stage.name}`, pageWidth / 2, 34, { align: "center" });
      }

      doc.setFontSize(12);
      doc.text("Resumo Geral", 14, 45);

autoTable(doc, {
  startY: 50,
  head: [["Indicador", "Total"]],
  body: [
    ["Participantes vinculados", linkedConsumptions.length.toString()],
    ["Consumos avulsos", unlinkedConsumptions.length.toString()],
    ["Vouchers", voucherConsumptions.length.toString()],
    ["Total geral", consumptions.length.toString()],
  ],
  theme: "striped",
  headStyles: { fillColor: [41, 128, 185] },
});

      doc.text("Resumo por Tipo de Refeição", 14, (doc as any).lastAutoTable.finalY + 10);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [["Tipo de Refeição", "Total"]],
        body: Array.from(totalByType.entries()).map(([k, v]) => [k, v.toString()]),
        theme: "striped",
        headStyles: { fillColor: [41, 128, 185] },
      });

      doc.text("Detalhamento", 14, (doc as any).lastAutoTable.finalY + 10);

const detailsTable = consumptions.map((c: any) => [
  c.source_type === "unlinked" ? "CONSUMO AVULSO" : c.source_type === "voucher" ? "VOUCHER" : "VINCULADO",
  c.display_name || "",
  c.display_delegation || "",
  c.meal_windows?.label || c.meal_windows?.meal_types?.name || "",
  c.consumed_at
    ? format(new Date(c.consumed_at), "dd/MM/yyyy HH:mm")
    : "",
]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [["Tipo", "Participante/QR", "Delegação", "Refeição", "Data/Hora"]],
        body: detailsTable,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [41, 128, 185] },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 20;

      if (signature) {
        doc.setFontSize(10);
        doc.text("__________________________________________", pageWidth / 2, finalY, {
          align: "center",
        });
        doc.text(`Responsável: ${signature}`, pageWidth / 2, finalY + 7, {
          align: "center",
        });
      }

      const pageCount = (doc as any).internal.getNumberOfPages();

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Página ${i} de ${pageCount}`,
          pageWidth - 20,
          doc.internal.pageSize.getHeight() - 10,
        );
      }

      const filename = `relatorio_alimentacao_${startDate || "geral"}${
        signature ? "_" + signature : ""
      }.pdf`;

      doc.save(filename);
      toast.success("PDF exportado com sucesso");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao exportar PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const exportBuffetRealized = () => {
    if (!consumptions.length) return;

    setIsExporting(true);

    try {
      const windowsMap = new Map<string, any[]>();

      consumptions.forEach((c: any) => {
        const winId = c.meal_window_id;
        if (!windowsMap.has(winId)) windowsMap.set(winId, []);
        windowsMap.get(winId)?.push(c);
      });

      const data: any[] = [];

      windowsMap.forEach((items) => {
        const win = items[0].meal_windows;

data.push({
  Janela: win.label || win.meal_types?.name,
  Data: format(new Date(win.service_date + "T00:00:00"), "dd/MM/yyyy"),
  Tipo: win.meal_types?.name,
  "Total Realizado": items.length,
  Vinculados: items.filter((i: any) => i.source_type === "linked").length,
  "Consumos Avulsos": items.filter((i: any) => i.source_type === "unlinked").length,
  Vouchers: items.filter((i: any) => i.source_type === "voucher").length,
  Status: "Finalizado",
});

        items.forEach((i: any) => {
          data.push({
            Janela: "",
            Data: "",
            Tipo: "Detalhe",
            Participante: i.display_name,
            Delegação: i.display_delegation,
            Instante: format(new Date(i.consumed_at), "HH:mm:ss"),
            Método: i.display_method,
            QR: i.qr_code || "",
          });
        });

        data.push({});
      });

      downloadXlsx(data, `realizado_buffet_${startDate || "geral"}.xlsx`, "Realizado Buffet");
      toast.success("Exportação Buffet gerada");
    } catch (e) {
      toast.error("Falha ao exportar");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Relatório de Alimentação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consumos por refeição, delegação e período
          </p>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(
                stageId
                  ? `/admin/etapa/${stageId}/alimentacao/relatorios/consumo`
                  : "/admin/alimentacao/relatorios/consumo",
              )
            }
          >
            <BarChart2 className="mr-2 h-4 w-4" /> Análise avançada
          </Button>

          {canExport && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={!consumptions.length || isExporting}
              >
                <Download className="mr-2 h-4 w-4" /> CSV
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={exportXlsx}
                disabled={!consumptions.length || isExporting}
              >
                <TableIcon className="mr-2 h-4 w-4" /> XLSX
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={exportBuffetRealized}
                disabled={!consumptions.length || isExporting}
                title="Exportar realizado para buffet"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Buffet (Realizado)
              </Button>

              <Button
                size="sm"
                onClick={exportPdf}
                disabled={!consumptions.length || isExporting}
              >
                <FileText className="mr-2 h-4 w-4" /> PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {isStageScoped && stage && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
          <Info className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-primary">
              Relatório filtrado por etapa: {stage.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Exibindo apenas consumos registrados em janelas desta etapa.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-wrap gap-4">
          <div className="w-40">
            <label className="text-xs font-medium mb-1 block">Data início</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div className="w-40">
            <label className="text-xs font-medium mb-1 block">Data fim</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <div className="w-52">
            <label className="text-xs font-medium mb-1 block">Delegação</label>
            <Select value={delegationFilter} onValueChange={setDelegationFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {delegations.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.institutions?.name || d.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-52">
            <label className="text-xs font-medium mb-1 block">Tifffpo de refeição</label>
            <Select value={mealTypeFilter} onValueChange={setMealTypeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {mealTypes.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-52">
            <label className="text-xs font-medium mb-1 block">Assinatura (Relatório)</label>
            <Input
              placeholder="Nome do responsável"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {consumptions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiStatCard label="Total consumos" value={consumptions.length} align="center" />

          <KpiStatCard
            label="Vinculados"
            value={linkedConsumptions.length}
            tone="success"
            align="center"
          />

          <KpiStatCard
            label="Consumos avulsos"
            value={unlinkedConsumptions.length}
            tone="warning"
            align="center"
          />

          <KpiStatCard
            label="Voucher"
            value={voucherConsumptions.length}
            tone="info"
            align="center"
          />

          {/* totalByType é um Map na ordem de primeira ocorrência (consumptions
              vem ordenado por consumed_at desc) — sem o sort, este card mostrava
              o tipo de refeição mais recente, não o de maior volume. */}
          {Array.from(totalByType.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 1)
            .map(([k, v]) => (
              <KpiStatCard key={k} label={k} value={v} align="center" />
            ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center py-16 text-center border border-dashed rounded-lg bg-muted/30">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <p className="text-muted-foreground font-medium">
            Erro ao carregar dados de alimentação
          </p>
        </div>
      ) : !consumptions.length ? (
        <div className="flex flex-col items-center py-16 text-center border border-dashed rounded-lg bg-muted/30">
          <Utensils className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum consumo encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ajuste os filtros ou registre consumos
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Participante / QR</TableHead>
                <TableHead>Delhegação</TableHead>
                <TableHead>Refeição</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Método</TableHead>
              </TableRow>
            </TableHeader>

<TableBody>
  {consumptions.slice(0, 200).map((c: any) => (
    <TableRow key={`${c.source_type}-${c.id}`}>
      <TableCell>
        {c.source_type === "unlinked"
          ? "Consumo avulso"
          : "Vinculado"}
      </TableCell>

      <TableCell className="font-medium">
        {c.display_name || "—"}
      </TableCell>

      <TableCell>
        {c.display_delegation || "—"}
      </TableCell>

      <TableCell>
        {c.meal_windows?.label ||
          c.meal_windows?.meal_types?.name ||
          "—"}
      </TableCell>

      <TableCell>
        {c.consumed_at
          ? format(new Date(c.consumed_at), "dd/MM/yyyy HH:mm")
          : "—"}
      </TableCell>

      <TableCell>
        {c.display_method || "scan"}
      </TableCell>
    </TableRow>
  ))}
</TableBody>
          </Table>
        
          {consumptions.length > 200 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Mostrando 200 de {consumptions.length}. Exporte CSV/XLSX para ver todos.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
