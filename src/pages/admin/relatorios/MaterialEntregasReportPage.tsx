import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { useEventBranding } from "@/hooks/useEventBranding";
import {
  useMaterialEntregasRelatorio,
  ptLabel,
  type MaterialDeliveryRow,
} from "./useMaterialEntregasRelatorio";
import { exportMaterialPdf } from "./materialPdfExporter";
import { exportMaterialXlsx } from "./materialXlsxExporter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  PackageCheck,
  RotateCcw,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  School,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  tint: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 truncate text-2xl font-bold">{value}</p>
            {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tint}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const TODOS = "__todos__";

export default function MaterialEntregasReportPage() {
  const eventId = useActiveEventId();
  const { activeEvent } = useEventContext();
  const { data: branding } = useEventBranding(eventId);
  const { kits, deliveries, schoolBreakdown, isLoading, refetchAll } =
    useMaterialEntregasRelatorio(eventId);

  const [kitFilter, setKitFilter] = useState<string>(TODOS);
  const [escolaFilter, setEscolaFilter] = useState<string>(TODOS);
  const [statusFilter, setStatusFilter] = useState<"active" | "revoked" | "all">("active");
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  const escolas = useMemo(
    () => Array.from(new Set(deliveries.map((d) => d.escola))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [deliveries],
  );

  const filteredDeliveries = useMemo<MaterialDeliveryRow[]>(() => {
    return deliveries.filter((d) => {
      if (kitFilter !== TODOS && d.kit_id !== kitFilter) return false;
      if (escolaFilter !== TODOS && d.escola !== escolaFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      return true;
    });
  }, [deliveries, kitFilter, escolaFilter, statusFilter]);

  const filteredSchoolBreakdown = useMemo(
    () => schoolBreakdown.filter((r) => kitFilter === TODOS || r.kit_id === kitFilter),
    [schoolBreakdown, kitFilter],
  );

  const totals = useMemo(() => {
    const today = new Date().toDateString();
    return {
      kitsAtivos: kits.filter((k) => k.is_active).length,
      entregues: kits.reduce((s, k) => s + k.delivered, 0),
      estornadas: kits.reduce((s, k) => s + k.revoked, 0),
      naoVinculadas: deliveries.filter((d) => !d.linked).length,
      hoje: deliveries.filter((d) => d.status === "active" && new Date(d.delivered_at).toDateString() === today)
        .length,
    };
  }, [kits, deliveries]);

  const handleRefresh = async () => {
    await refetchAll();
    toast.success("Dados atualizados");
  };

  const handleExportPdf = async () => {
    if (!eventId) return;
    try {
      setExporting("pdf");
      const blob = await exportMaterialPdf(
        { kits, deliveries: filteredDeliveries, schoolBreakdown: filteredSchoolBreakdown },
        {
          eventName: activeEvent?.name || "Evento",
          branding: branding ?? null,
          generatedAt: new Date(),
        },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `Entregas_Material_${(activeEvent?.name || "Evento").replace(/\s+/g, "_")}_${dateStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF exportado");
    } catch (e: any) {
      toast.error("Falha ao exportar PDF: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setExporting(null);
    }
  };

  const handleExportXlsx = async () => {
    if (!eventId) return;
    try {
      setExporting("xlsx");
      await exportMaterialXlsx(
        { kits, deliveries: filteredDeliveries, schoolBreakdown: filteredSchoolBreakdown },
        { eventName: activeEvent?.name || "Evento", generatedAt: new Date() },
      );
      toast.success("Planilha exportada");
    } catch (e: any) {
      toast.error("Falha ao exportar planilha: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setExporting(null);
    }
  };

  if (!eventId) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Selecione um evento ativo para visualizar o relatório de entregas de material.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Relatório de Entregas de Material</h1>
          <p className="text-sm text-muted-foreground">
            {activeEvent?.name ?? "Evento"} — kits, entregas e pendências por escola
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={isLoading || !!exporting}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {exporting === "xlsx" ? "Exportando..." : "Excel"}
          </Button>
          <Button size="sm" onClick={handleExportPdf} disabled={isLoading || !!exporting}>
            <FileText className="mr-2 h-4 w-4" />
            {exporting === "pdf" ? "Exportando..." : "PDF"}
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <section>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[100px]" />)
          ) : (
            <>
              <KpiCard icon={Package} label="Kits Ativos" value={totals.kitsAtivos} tint="bg-primary/10 text-primary" />
              <KpiCard
                icon={PackageCheck}
                label="Entregues"
                value={totals.entregues}
                sub="inclui crachás não vinculados"
                tint="bg-emerald-500/10 text-emerald-600"
              />
              <KpiCard
                icon={AlertTriangle}
                label="Não Vinculadas"
                value={totals.naoVinculadas}
                sub="crachá bipado, sem nome ainda"
                tint="bg-amber-500/10 text-amber-600"
              />
              <KpiCard
                icon={RotateCcw}
                label="Estornadas"
                value={totals.estornadas}
                tint="bg-red-500/10 text-red-600"
              />
              <KpiCard
                icon={PackageCheck}
                label="Entregues Hoje"
                value={totals.hoje}
                tint="bg-blue-500/10 text-blue-600"
              />
            </>
          )}
        </div>
      </section>

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Kit</label>
            <Select value={kitFilter} onValueChange={setKitFilter}>
              <SelectTrigger className="h-8 w-52 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os kits</SelectItem>
                {kits.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Escola</label>
            <Select value={escolaFilter} onValueChange={setEscolaFilter}>
              <SelectTrigger className="h-8 w-52 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas as escolas</SelectItem>
                {escolas.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-8 w-40 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Entregues</SelectItem>
                <SelectItem value="revoked">Estornadas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Progresso por kit */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4" /> Progresso por Kit
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : kits.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum kit de material cadastrado para este evento.
            </p>
          ) : (
            <div className="space-y-3">
              {kits.map((k) => {
                const pct =
                  k.credentialed && k.credentialed > 0
                    ? Math.min(100, Math.round((k.delivered / k.credentialed) * 100))
                    : null;
                return (
                  <div key={k.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-1.5 truncate font-medium">
                        {k.name}
                        {k.stage_name && (
                          <Badge variant="outline" className="text-[10px]">
                            {k.stage_name}
                          </Badge>
                        )}
                        {!k.is_active && (
                          <Badge variant="outline" className="text-[10px]">
                            inativo
                          </Badge>
                        )}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {k.credentialed !== null ? `${k.delivered}/${k.credentialed}` : k.delivered}
                        {k.revoked > 0 && ` · ${k.revoked} estornada(s)`}
                      </span>
                    </div>
                    {pct !== null && <Progress value={pct} className="h-1.5" />}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Por escola */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <School className="h-4 w-4" /> Entregas por Escola
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : filteredSchoolBreakdown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem dados para os filtros selecionados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left uppercase text-[10px] text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Kit</th>
                    <th className="py-2 pr-4 font-medium">Escola</th>
                    <th className="px-2 py-2 text-center font-medium">Entregues</th>
                    <th className="px-2 py-2 text-center font-medium">Credenciados</th>
                    <th className="py-2 text-right font-medium">Faltam</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchoolBreakdown.map((r, i) => (
                    <tr key={`${r.kit_id}-${r.escola}-${i}`} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-2 pr-4">{r.kit_name}</td>
                      <td className="py-2 pr-4 font-medium">{r.escola}</td>
                      <td className="px-2 py-2 text-center tabular-nums text-emerald-600">{r.delivered}</td>
                      <td className="px-2 py-2 text-center tabular-nums">{r.total ?? "—"}</td>
                      <td className="py-2 text-right tabular-nums text-amber-600">{r.faltam ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalhado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <PackageCheck className="h-4 w-4" /> Entregas Detalhadas
            <span className="font-normal text-muted-foreground">({filteredDeliveries.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma entrega para os filtros selecionados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Participante</th>
                    <th className="px-2 py-2 font-medium">Escola</th>
                    <th className="px-2 py-2 font-medium">Kit</th>
                    <th className="px-2 py-2 font-medium">Tipo</th>
                    <th className="px-2 py-2 font-medium">Data/Hora</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeliveries.map((d) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        {d.linked ? (
                          <>
                            <p className="font-medium">{d.full_name || "—"}</p>
                            {d.cpf && <p className="text-xs text-muted-foreground">{d.cpf}</p>}
                          </>
                        ) : (
                          <>
                            <p className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5" /> Crachá não vinculado
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">{d.qr_code}</p>
                          </>
                        )}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{d.escola}</td>
                      <td className="px-2 py-2 text-muted-foreground">{d.kit_name}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {d.linked ? ptLabel(d.participant_type) : "—"}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {format(new Date(d.delivered_at), "dd/MM/yyyy HH:mm")}
                      </td>
                      <td className="px-2 py-2">
                        {d.status === "active" ? (
                          <Badge className="bg-emerald-600 text-[10px] hover:bg-emerald-600">entregue</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-red-600">
                            estornada
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
