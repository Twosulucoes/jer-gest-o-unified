import { useState, useCallback, useMemo } from "react";
import { useEvent } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ModuleHeader from "@/components/admin/ModuleHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, FileSpreadsheet, Loader2, Eye } from "lucide-react";
import { listReportsForRoles, getDefaultFilters } from "../core/registry";
import { normalizeFilters, validateFilters, applyDependsOn } from "../core/filters";
import { loadReportRows } from "../core/formatters";
import { renderPdf } from "../renderers/pdf/pdfRenderer";
import { downloadExcel } from "../renderers/excel/excelRenderer";
import { ReportFiltersPanel } from "./ReportFiltersPanel";
import { ReportColumnsPicker } from "./ReportColumnsPicker";
import { ReportPreviewTable } from "./ReportPreviewTable";
import { ReportPresets } from "./ReportPresets";
import type { ReportContext, ReportDefinition } from "../core/types";

export default function ReportCenterPage() {
  const { activeEvent } = useEvent();
  const { user, roles } = useAuth();
  const { toast } = useToast();

  const ctx: ReportContext = useMemo(() => ({
    activeEventId: activeEvent?.id || null,
    userId: user?.id || null,
    roles: roles || [],
    baseUrl: window.location.origin,
  }), [activeEvent, user, roles]);

  const reports = useMemo(() => listReportsForRoles(roles || []), [roles]);

  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [filterValues, setFilterValues] = useState<Record<string, unknown>>({});
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  const selectedReport = useMemo(() => reports.find((r) => r.id === selectedReportId) || null, [reports, selectedReportId]);

  const handleSelectReport = useCallback((id: string) => {
    setSelectedReportId(id);
    const report = reports.find((r) => r.id === id);
    if (report) {
      setFilterValues(getDefaultFilters(report, ctx));
      setVisibleColumns(report.columns.filter((c) => c.visibleByDefault !== false).map((c) => c.key));
      setPreviewRows([]);
    }
  }, [reports, ctx]);

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handlePreview = useCallback(async () => {
    if (!selectedReport) return;
    const errors = validateFilters(selectedReport.filters, filterValues);
    if (Object.keys(errors).length > 0) {
      toast({ title: 'Filtros inválidos', description: Object.values(errors).join(', '), variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const normalized = normalizeFilters(selectedReport.filters, filterValues);
      const rows = await loadReportRows(selectedReport, normalized, ctx, supabase, 50);
      setPreviewRows(rows as Record<string, unknown>[]);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar dados', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedReport, filterValues, ctx, toast]);

  const handleExportPdf = useCallback(async () => {
    if (!selectedReport) return;
    setExporting('pdf');
    try {
      const normalized = normalizeFilters(selectedReport.filters, filterValues);
      const rows = await loadReportRows(selectedReport, normalized, ctx, supabase);
      const blob = await renderPdf(selectedReport, rows as any[], normalized, ctx, visibleColumns, activeEvent?.name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedReport.id}_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'PDF gerado com sucesso' });
    } catch (err: any) {
      toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  }, [selectedReport, filterValues, ctx, visibleColumns, activeEvent, toast]);

  const handleExportExcel = useCallback(async () => {
    if (!selectedReport) return;
    setExporting('excel');
    try {
      const normalized = normalizeFilters(selectedReport.filters, filterValues);
      const rows = await loadReportRows(selectedReport, normalized, ctx, supabase);
      await downloadExcel(selectedReport, rows as any[], normalized, ctx, visibleColumns, activeEvent?.name);
      toast({ title: 'Excel exportado com sucesso' });
    } catch (err: any) {
      toast({ title: 'Erro ao gerar Excel', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  }, [selectedReport, filterValues, ctx, visibleColumns, activeEvent, toast]);

  const handleApplyPreset = useCallback((filters: Record<string, unknown>, columns: string[] | null) => {
    setFilterValues(filters);
    if (columns) setVisibleColumns(columns);
    toast({ title: 'Preset aplicado' });
  }, [toast]);

  const activeFilters = selectedReport
    ? applyDependsOn(selectedReport.filters, filterValues)
    : [];

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Central de Relatórios"
        description="Gere relatórios PDF e Excel com filtros dinâmicos."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Relatório</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedReportId} onValueChange={handleSelectReport}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar relatório" />
                </SelectTrigger>
                <SelectContent>
                  {reports.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedReport && (
                <p className="text-xs text-muted-foreground mt-2">{selectedReport.description}</p>
              )}
            </CardContent>
          </Card>

          {selectedReport && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Presets</CardTitle>
              </CardHeader>
              <CardContent>
                <ReportPresets
                  reportId={selectedReport.id}
                  eventId={ctx.activeEventId}
                  currentFilters={filterValues}
                  currentColumns={visibleColumns}
                  onApply={handleApplyPreset}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main */}
        <div className="lg:col-span-3 space-y-4">
          {!selectedReport ? (
            <Card>
              <CardContent className="flex items-center justify-center h-48 text-muted-foreground">
                Selecione um relatório para começar.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Filtros</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ReportFiltersPanel
                    filters={activeFilters}
                    values={filterValues}
                    onChange={handleFilterChange}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handlePreview} disabled={loading} className="gap-1.5">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                      Visualizar
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={!!exporting} className="gap-1.5">
                      {exporting === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      Gerar PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={!!exporting} className="gap-1.5">
                      {exporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                      Exportar Excel
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Colunas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ReportColumnsPicker
                    columns={selectedReport.columns}
                    visible={visibleColumns}
                    onChange={setVisibleColumns}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    Prévia {previewRows.length > 0 && `(${previewRows.length} registros)`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                    </div>
                  ) : (
                    <ReportPreviewTable
                      columns={selectedReport.columns}
                      rows={previewRows}
                      visibleColumns={visibleColumns}
                    />
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
