import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import { useStageScope } from "@/hooks/useStageScope";
import { format } from "date-fns";
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

      let linkedQ = supabase
        .from("meal_consumptions")
        .select(`
          *,
          meal_windows!inner(id, label, service_date, meal_type_id, event_id, event_stage_id, meal_types(name)),
          participants(person:people(full_name), delegation_id, delegations(institutions(name)))
        `)
        .eq("meal_windows.event_id", eventId)
        .not("meal_window_id", "is", null)
        .order("consumed_at", { ascending: false });

      let unlinkedQ = (supabase as any)
        .from("meal_consumptions_unlinked")
        .select(`
          *,
          meal_windows!inner(id, label, service_date, meal_type_id, event_id, event_stage_id, meal_types(name))
        `)
        .eq("meal_windows.event_id", eventId)
        .not("meal_window_id", "is", null)
        .order("consumed_at", { ascending: false });

      if (isStageScoped && stageId) {
        linkedQ = linkedQ.eq("meal_windows.event_stage_id", stageId);
        unlinkedQ = unlinkedQ.eq("meal_windows.event_stage_id", stageId);
      }

      if (startDate) {
        linkedQ = linkedQ.gte("consumed_at", `${startDate}T00:00:00`);
        unlinkedQ = unlinkedQ.gte("consumed_at", `${startDate}T00:00:00`);
      }

      if (endDate) {
        linkedQ = linkedQ.lte("consumed_at", `${endDate}T23:59:59`);
        unlinkedQ = unlinkedQ.lte("consumed_at", `${endDate}T23:59:59`);
      }

      if (delegationFilter !== "all") {
        linkedQ = linkedQ.eq("participants.delegation_id", delegationFilter);
        // QR não vinculado não tem delegação. Então não entra quando filtra delegação.
        unlinkedQ = unlinkedQ.eq("id", "00000000-0000-0000-0000-000000000000");
      }

      const [
        { data: linkedData, error: linkedError },
        { data: unlinkedData, error: unlinkedError },
      ] = await Promise.all([linkedQ, unlinkedQ]);

      if (linkedError) throw linkedError;
      if (unlinkedError) throw unlinkedError;

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

      if (mealTypeFilter !== "all") {
        linked = linked.filter((c: any) => c.meal_windows?.meal_type_id === mealTypeFilter);
        unlinked = unlinked.filter((c: any) => c.meal_windows?.meal_type_id === mealTypeFilter);
      }

      return [...linked, ...unlinked].sort(
        (a: any, b: any) =>
          new Date(b.consumed_at).getTime() - new Date(a.consumed_at).getTime(),
      );
    },
  });

  const linkedConsumptions = consumptions.filter((c: any) => c.source_type === "linked");
  const unlinkedConsumptions = consumptions.filter((c: any) => c.source_type === "unlinked");

  const totalByType = new Map<string, number>();
  const totalByDelegation = new Map<string, number>();
  const totalBySource = new Map<string, number>();

  consumptions.forEach((c: any) => {
    const typeName = c.meal_windows?.meal_types?.name || "Outro";
    totalByType.set(typeName, (totalByType.get(typeName) || 0) + 1);

    const delName = c.display_delegation || "Sem delegação";
    totalByDelegation.set(delName, (totalByDelegation.get(delName) || 0) + 1);

    const sourceName = c.source_type === "unlinked" ? "Consumos avulsos" : "Vinculados";
    totalBySource.set(sourceName, (totalBySource.get(sourceName) || 0) + 1);
  });

  const exportCsv = () => {
    if (!consumptions.length) return;

    const rows = ["Tipo,Participante/QR,Delegação,Refeição,Data/Hora,Método,QR"];

    for (const c of consumptions) {
      rows.push([
        `"${c.source_type === "unlinked" ? "CONSUMO AVULSO" : "VINCULADO"}"`,
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

const detalheData = consumptions.map((c: any) => ({
  Tipo: c.source_type === "unlinked" ? "CONSUMO AVULSO" : "VINCULADO",
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
  c.source_type === "unlinked" ? "CONSUMO AVULSO" : "VINCULADO",
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
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{consumptions.length}</p>
              <p className="text-xs text-muted-foreground">Total consumos</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-green-500">{linkedConsumptions.length}</p>
              <p className="text-xs text-muted-foreground">Vinculados</p>
            </CardContent>
          </Card>

<Card>
  <CardContent className="pt-4 text-center">
    <p className="text-2xl font-bold text-yellow-500">
      {unlinkedConsumptions.length}
    </p>
    <p className="text-xs text-muted-foreground">
      Consumos avulsos
    </p>
  </CardContent>
</Card>

          {Array.from(totalByType.entries()).slice(0, 1).map(([k, v]) => (
            <Card key={k}>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{v}</p>
                <p className="text-xs text-muted-foreground">{k}</p>
              </CardContent>
            </Card>
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
