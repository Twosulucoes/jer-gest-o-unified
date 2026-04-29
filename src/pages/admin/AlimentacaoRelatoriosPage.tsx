import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import { useStageScope } from "@/hooks/useStageScope";
import { format } from "date-fns";
import { Download, Utensils, AlertCircle, Info, FileText, Table as TableIcon, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadCsv, downloadXlsxSheets, downloadXlsx } from "@/lib/reportExport";

export default function AlimentacaoRelatoriosPage() {
  const eventId = useActiveEventId();
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
        .select("id, school_name")
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
      const { data, error } = await supabase.from("meal_types").select("id, name").eq("event_id", eventId!).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: consumptions, isLoading, isError } = useQuery({
    queryKey: ["food-report", eventId, stageId, startDate, endDate, delegationFilter, mealTypeFilter],
    enabled: !!eventId,
    queryFn: async () => {
      let q = supabase
        .from("meal_consumptions")
        .select(`
          *,
          meal_windows!inner(id, label, service_date, meal_type_id, event_id, event_stage_id, meal_types(name)),
          participants(person:people(full_name), delegation_id, delegations(school_name))
        `)
        .eq("meal_windows.event_id", eventId)
        .order("consumed_at", { ascending: false });

      if (isStageScoped && stageId) {
        q = q.eq("meal_windows.event_stage_id", stageId);
      }

      // Filter by event through meal_windows
      q = q.not("meal_window_id", "is", null);

      if (startDate) q = q.gte("consumed_at", `${startDate}T00:00:00`);
      if (endDate) q = q.lte("consumed_at", `${endDate}T23:59:59`);
      if (delegationFilter !== "all") q = q.eq("participants.delegation_id", delegationFilter);

      const { data, error } = await q;
      if (error) throw error;

      let filtered = data as any[];
      if (mealTypeFilter !== "all") {
        filtered = filtered.filter((c) => c.meal_windows?.meal_type_id === mealTypeFilter);
      }
      return filtered;
    },
  });

  // Totals
  const totalByType = new Map<string, number>();
  const totalByDelegation = new Map<string, number>();
  (consumptions || []).forEach((c: any) => {
    const typeName = c.meal_windows?.meal_types?.name || "Outro";
    totalByType.set(typeName, (totalByType.get(typeName) || 0) + 1);
    const delName = c.participants?.delegations?.school_name || "Sem delegação";
    totalByDelegation.set(delName, (totalByDelegation.get(delName) || 0) + 1);
  });

  const exportCsv = () => {
    if (!consumptions?.length) return;
    const rows = ["Participante,Delegação,Refeição,Data/Hora,Método"];
    for (const c of consumptions) {
      rows.push([
        `"${c.participants?.person?.full_name || ""}"`,
        `"${c.participants?.delegations?.school_name || ""}"`,
        `"${c.meal_windows?.label || ""}"`,
        c.consumed_at ? format(new Date(c.consumed_at), "dd/MM/yyyy HH:mm") : "",
        c.method || "scan",
      ].join(","));
    }
    // Add totals
    rows.push("");
    rows.push("TOTAIS POR TIPO");
    totalByType.forEach((v, k) => rows.push(`${k},${v}`));
    rows.push("");
    rows.push("TOTAIS POR DELEGAÇÃO");
    totalByDelegation.forEach((v, k) => rows.push(`"${k}",${v}`));

    downloadCsv(rows, `relatorio_alimentacao_${startDate || "todos"}.csv`);
    toast.success("CSV exportado com sucesso");
  };

  const exportXlsx = () => {
    if (!consumptions?.length) return;
    setIsExporting(true);
    try {
      const detailData = consumptions.map(c => ({
        "Participante": c.participants?.person?.full_name || "",
        "Delegação": c.participants?.delegations?.school_name || "",
        "Refeição": c.meal_windows?.label || "",
        "Data/Hora": c.consumed_at ? format(new Date(c.consumed_at), "dd/MM/yyyy HH:mm") : "",
        "Método": c.method || "scan"
      }));

      const summaryData: any[] = [];
      summaryData.push({ "Categoria": "TOTAIS POR TIPO", "Valor": "" });
      totalByType.forEach((v, k) => summaryData.push({ "Categoria": k, "Valor": v }));
      summaryData.push({ "Categoria": "", "Valor": "" });
      summaryData.push({ "Categoria": "TOTAIS POR DELEGAÇÃO", "Valor": "" });
      totalByDelegation.forEach((v, k) => summaryData.push({ "Categoria": k, "Valor": v }));

      const filename = `relatorio_alimentacao_${startDate || "geral"}${signature ? "_" + signature : ""}.xlsx`;
      downloadXlsxSheets([{ name: "Resumo", rows: summaryData }, { name: "Detalhe", rows: detailData }], filename);
      toast.success("XLSX exportado com sucesso");
    } catch (e) {
      toast.error("Erro ao exportar XLSX");
    } finally {
      setIsExporting(false);
    }
  };

  const exportPdf = () => {
    if (!consumptions?.length) return;
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFontSize(18);
      doc.text("Relatório de Alimentação", pageWidth / 2, 20, { align: "center" });
      doc.setFontSize(10);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, 28, { align: "center" });
      if (stage?.name) {
        doc.text(`Etapa: ${stage.name}`, pageWidth / 2, 34, { align: "center" });
      }

      // Totals
      doc.setFontSize(12);
      doc.text("Resumo de Consumo", 14, 45);
      const totalsTable = Array.from(totalByType.entries()).map(([k, v]) => [k, v.toString()]);
      autoTable(doc, {
        startY: 50,
        head: [["Tipo de Refeição", "Total"]],
        body: totalsTable,
        theme: "striped",
        headStyles: { fillColor: [41, 128, 185] }
      });

      // Details
      doc.text("Detalhamento", 14, (doc as any).lastAutoTable.finalY + 10);
      const detailsTable = consumptions.map(c => [
        c.participants?.person?.full_name || "",
        c.participants?.delegations?.school_name || "",
        c.meal_windows?.label || "",
        c.consumed_at ? format(new Date(c.consumed_at), "dd/MM/yyyy HH:mm") : ""
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [["Participante", "Delegação", "Refeição", "Data/Hora"]],
        body: detailsTable,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] }
      });

      // Signature & Footer
      const finalY = (doc as any).lastAutoTable.finalY + 20;
      if (signature) {
        doc.setFontSize(10);
        doc.text("__________________________________________", pageWidth / 2, finalY, { align: "center" });
        doc.text(`Responsável: ${signature}`, pageWidth / 2, finalY + 7, { align: "center" });
      }

      // Page numbers
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 20, doc.internal.pageSize.getHeight() - 10);
      }

      const filename = `relatorio_alimentacao_${startDate || "geral"}${signature ? "_" + signature : ""}.pdf`;
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
    if (!consumptions?.length) return;
    setIsExporting(true);
    try {
      // Group by window
      const windowsMap = new Map<string, any[]>();
      consumptions.forEach(c => {
        const winId = c.meal_window_id;
        if (!windowsMap.has(winId)) windowsMap.set(winId, []);
        windowsMap.get(winId)?.push(c);
      });

      const data: any[] = [];
      windowsMap.forEach((items, winId) => {
        const win = items[0].meal_windows;
        data.push({
          "Janela": win.label || win.meal_types?.name,
          "Data": format(new Date(win.service_date + "T00:00:00"), "dd/MM/yyyy"),
          "Tipo": win.meal_types?.name,
          "Total Realizado": items.length,
          "Status": "Finalizado"
        });
        
        // Add detail rows
        items.forEach(i => {
          data.push({
            "Janela": "",
            "Data": "",
            "Tipo": "Detalhe",
            "Participante": i.participants?.person?.full_name,
            "Instante": format(new Date(i.consumed_at), "HH:mm:ss"),
            "Método": i.method
          });
        });
        data.push({}); // Empty line between windows
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Relatório de Alimentação</h1>
          <p className="text-sm text-muted-foreground mt-1">Consumos por refeição, delegação e período</p>
      </div>

      {isStageScoped && stage && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
          <Info className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-primary">Relatório filtrado por etapa: {stage.name}</p>
            <p className="text-xs text-muted-foreground">Exibindo apenas consumos registrados em janelas desta etapa.</p>
          </div>
        </div>
      )}
        {canExport && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!consumptions?.length || isExporting}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportXlsx} disabled={!consumptions?.length || isExporting}>
              <TableIcon className="mr-2 h-4 w-4" /> XLSX
            </Button>
            <Button variant="outline" size="sm" onClick={exportBuffetRealized} disabled={!consumptions?.length || isExporting} title="Exportar realizado para buffet">
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Buffet (Realizado)
            </Button>
            <Button size="sm" onClick={exportPdf} disabled={!consumptions?.length || isExporting}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Filtros</CardTitle></CardHeader>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {delegations.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.school_name || d.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-52">
            <label className="text-xs font-medium mb-1 block">Tipo de refeição</label>
            <Select value={mealTypeFilter} onValueChange={setMealTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {mealTypes.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
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

      {/* Totals */}
      {consumptions && consumptions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{consumptions.length}</p>
              <p className="text-xs text-muted-foreground">Total consumos</p>
            </CardContent>
          </Card>
          {Array.from(totalByType.entries()).slice(0, 3).map(([k, v]) => (
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
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : isError ? (
        <div className="flex flex-col items-center py-16 text-center border border-dashed rounded-lg bg-muted/30">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <p className="text-muted-foreground font-medium">Erro ao carregar dados de alimentação</p>
        </div>
      ) : !consumptions?.length ? (
        <div className="flex flex-col items-center py-16 text-center border border-dashed rounded-lg bg-muted/30">
          <Utensils className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum consumo encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou registre consumos</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participante</TableHead>
                <TableHead>Delegação</TableHead>
                <TableHead>Refeição</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Método</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumptions.slice(0, 200).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.participants?.person?.full_name || "—"}</TableCell>
                  <TableCell>{c.participants?.delegations?.school_name || "—"}</TableCell>
                  <TableCell>{c.meal_windows?.label || "—"}</TableCell>
                  <TableCell>{c.consumed_at ? format(new Date(c.consumed_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                  <TableCell>{c.method || "scan"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {consumptions.length > 200 && (
            <p className="text-xs text-muted-foreground text-center py-2">Mostrando 200 de {consumptions.length}. Exporte CSV para ver todos.</p>
          )}
        </div>
      )}
    </div>
  );
}
