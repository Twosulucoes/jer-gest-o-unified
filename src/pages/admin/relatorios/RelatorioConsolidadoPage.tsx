import { useState } from "react";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { useEventBranding } from "@/hooks/useEventBranding";
import { useDashboardData } from "./useDashboardData";
import { exportConsolidadoPdf } from "./consolidadoPdfExporter";
import { exportConsolidadoXlsx } from "./consolidadoXlsxExporter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, BadgeCheck, ClipboardList, UtensilsCrossed, Bed, Bus,
  RefreshCw, FileText, FileSpreadsheet, Layers,
} from "lucide-react";
import { toast } from "sonner";

function KpiCard({ icon: Icon, label, value, sub, tint }: { icon: any; label: string; value: string | number; sub?: string; tint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1 truncate">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${tint}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RelatorioConsolidadoPage() {
  const eventId = useActiveEventId();
  const { activeEvent } = useEventContext();
  const { data: branding } = useEventBranding(eventId);
  const { data, isLoading, refetchAll, lastUpdated } = useDashboardData(eventId);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  const r = data.resumo;
  const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0);
  const totalInscritosEtapas = data.inscricoes.by_stage.reduce((acc, s) => acc + s.count, 0);

  const handleRefresh = async () => {
    await refetchAll();
    toast.success("Dados atualizados");
  };

  const handleExportPdf = async () => {
    if (!eventId) return;
    try {
      setExporting("pdf");
      const blob = await exportConsolidadoPdf(data, {
        eventName: activeEvent?.name || "Evento",
        branding: branding ?? null,
        generatedAt: new Date(),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `Consolidado_Etapas_${(activeEvent?.name || "Evento").replace(/\s+/g, "_")}_${dateStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório PDF exportado");
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
      await exportConsolidadoXlsx(data, {
        eventName: activeEvent?.name || "Evento",
        generatedAt: new Date(),
      });
      toast.success("Planilha Excel exportada");
    } catch (e: any) {
      toast.error("Falha ao exportar Excel: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setExporting(null);
    }
  };

  if (!eventId) {
    return (
      <div className="container mx-auto py-6">
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Selecione um evento ativo para visualizar o relatório consolidado.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Relatório Consolidado de Etapas</h1>
          <p className="text-sm text-muted-foreground">
            Totais agregados de todas as etapas do evento (sem duplicar participante) — Última atualização:{" "}
            {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={exporting !== null || isLoading}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {exporting === "xlsx" ? "Exportando..." : "Excel"}
          </Button>
          <Button size="sm" onClick={handleExportPdf} disabled={exporting !== null || isLoading}>
            <FileText className="h-4 w-4 mr-2" />
            {exporting === "pdf" ? "Exportando..." : "PDF"}
          </Button>
        </div>
      </header>

      {/* Indicadores consolidados */}
      <section>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[100px]" />)
          ) : (
            <>
              <KpiCard icon={Users} label="Atletas" value={r.athletes_total}
                sub={`${r.participants_total} participantes`}
                tint="bg-primary/10 text-primary" />
              <KpiCard icon={BadgeCheck} label="Credenciados" value={r.credentialed}
                sub={`${pct(r.credentialed, r.participants_total)}% dos participantes`}
                tint="bg-accent/10 text-accent-foreground" />
              <KpiCard icon={ClipboardList} label="Inscrições em Provas" value={data.inscricoes.total_provas}
                sub={`${data.inscricoes.pendentes_documentacao} pendentes de doc.`}
                tint="bg-amber-500/10 text-amber-600" />
              <KpiCard icon={UtensilsCrossed} label="Refeições Servidas" value={r.meals_total}
                sub="Acumulado de todas as etapas"
                tint="bg-emerald-500/10 text-emerald-600" />
              <KpiCard icon={Bed} label="Alojamento" value={`${r.lodging_occupied}/${r.lodging_capacity}`}
                sub={`${pct(r.lodging_occupied, r.lodging_capacity)}% de ocupação`}
                tint="bg-blue-500/10 text-blue-600" />
              <KpiCard icon={Bus} label="Transporte" value={r.transport_trips}
                sub={`${r.transport_passengers} passageiros`}
                tint="bg-purple-500/10 text-purple-600" />
            </>
          )}
        </div>
      </section>

      {/* Inscrições por etapa (quebra que compõe o total) */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
          <Layers className="h-5 w-5" /> Inscrições por Etapa
        </h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {data.inscricoes.by_stage.length} etapa(s) · {totalInscritosEtapas} vínculos no total
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[160px]" />
            ) : data.inscricoes.by_stage.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>
            ) : (
              <div className="space-y-2">
                {data.inscricoes.by_stage.map((s) => {
                  const sharePct = totalInscritosEtapas > 0 ? Math.round((s.count / totalInscritosEtapas) * 100) : 0;
                  return (
                    <div key={s.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="truncate font-medium">{s.name}</span>
                        <span className="text-muted-foreground tabular-nums">{s.count} ({sharePct}%)</span>
                      </div>
                      <Progress value={sharePct} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Credenciamento + Alimentação por delegação */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Credenciamento por Delegação</CardTitle></CardHeader>
          <CardContent>
            {data.credenciamento.by_delegation.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem delegações registradas.</p>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
                {data.credenciamento.by_delegation.map((d) => (
                  <div key={d.delegation_id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="truncate font-medium">{d.name}</span>
                      <span className="text-muted-foreground tabular-nums">{d.credentialed}/{d.total} ({d.pct}%)</span>
                    </div>
                    <Progress value={d.pct} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Refeições por Delegação</CardTitle></CardHeader>
          <CardContent>
            {data.alimentacao.by_delegation.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem consumos registrados.</p>
            ) : (
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-2 text-xs">
                {data.alimentacao.by_delegation.map((d, i) => (
                  <div key={i} className="flex justify-between border-b border-border/50 pb-1">
                    <span className="truncate">{d.name}</span>
                    <span className="font-semibold tabular-nums">{d.total}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
