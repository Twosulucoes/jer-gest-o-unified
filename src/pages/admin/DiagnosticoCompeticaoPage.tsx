import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useEventContext } from "@/contexts/EventContext";
import { useCompetitionDiagnostics } from "@/hooks/useCompetitionDiagnostics";
import { competitionFeatureCatalog } from "@/config/competitionFeatureCatalog";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Play, Download, Copy, ExternalLink, AlertTriangle, CheckCircle2, XCircle,
  Database, Route as RouteIcon, Layers, BarChart3
} from "lucide-react";

function KpiCard({ label, value, loading }: { label: string; value: number | null; loading: boolean }) {
  if (loading) return <Skeleton className="h-20 w-full" />;
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold mt-1">
          {value !== null ? value : <span className="text-muted-foreground text-sm">N/D</span>}
        </p>
      </CardContent>
    </Card>
  );
}

function JsonViewer({ data }: { data: unknown }) {
  return (
    <pre className="bg-muted rounded-lg p-4 text-xs overflow-auto max-h-[500px] border">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function DiagnosticoCompeticaoPage() {
  const { activeEvent } = useEventContext();
  const eventId = activeEvent?.id ?? null;
  const [triggered, setTriggered] = useState(false);
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useCompetitionDiagnostics(eventId, triggered);

  const handleGenerate = useCallback(() => {
    setTriggered(true);
    if (triggered) refetch();
  }, [triggered, refetch]);

  const handleExportJson = useCallback(() => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostico-competicao-${data.event_id ?? "global"}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON exportado!");
  }, [data]);

  const handleCopyJson = useCallback(async () => {
    if (!data) return;
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast.success("JSON copiado para a área de transferência!");
  }, [data]);

  const kpis = data?.diagnostics.kpis;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Diagnóstico da Competição</h1>
      <p className="text-sm text-muted-foreground">Visão auditável de rotas, entidades, tabelas e KPIs da competição.</p>

      {/* Header Actions */}
      <Card>
        <CardContent className="pt-4 pb-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm text-muted-foreground">
              {/* Event name removed */}
            </p>
          </div>
          <Button onClick={handleGenerate} disabled={isLoading}>
            <Play className="h-4 w-4 mr-2" />
            {triggered ? "Atualizar diagnóstico" : "Gerar diagnóstico"}
          </Button>
          <Button variant="outline" onClick={handleExportJson} disabled={!data}>
            <Download className="h-4 w-4 mr-2" />
            Exportar JSON
          </Button>
          <Button variant="outline" onClick={handleCopyJson} disabled={!data}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar JSON
          </Button>
        </CardContent>
      </Card>

      {/* Error state */}
      {isError && (
        <Card className="border-destructive">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-sm text-destructive">Erro ao gerar diagnóstico.</span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {isLoading && triggered && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      )}

      {/* Results */}
      {data && !isLoading && (
        <>
          {/* KPIs */}
          {kpis && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Indicadores {kpis.isGlobal && <Badge variant="secondary" className="text-[10px]">Global</Badge>}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <KpiCard label="Provas" value={kpis.sport_events} loading={false} />
                <KpiCard label="Participantes" value={kpis.participants} loading={false} />
                <KpiCard label="Inscrições" value={kpis.enrollments} loading={false} />
                <KpiCard label="Equipes" value={kpis.teams} loading={false} />
                <KpiCard label="Partidas (total)" value={kpis.matches_total} loading={false} />
                <KpiCard label="Agendadas" value={kpis.matches_scheduled} loading={false} />
                <KpiCard label="Finalizadas" value={kpis.matches_finished} loading={false} />
                <KpiCard label="Sem resultado" value={kpis.matches_no_result} loading={false} />
                <KpiCard label="Resultados" value={kpis.results_total} loading={false} />
                <KpiCard label="Boletins" value={kpis.bulletins_total} loading={false} />
                <KpiCard label="Boletins publicados" value={kpis.bulletins_published} loading={false} />
                <KpiCard label="Irregularidades abertas" value={kpis.irregularities_open} loading={false} />
              </div>
            </div>
          )}

          {/* Accordion sections */}
          <Accordion type="multiple" defaultValue={["routes", "entities", "tables", "alerts"]} className="space-y-2">
            {/* A) Rotas */}
            <AccordionItem value="routes" className="border rounded-lg">
              <AccordionTrigger className="px-4 text-sm font-semibold">
                <span className="flex items-center gap-2"><RouteIcon className="h-4 w-4" /> Rotas e Atalhos</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {data.routes.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => navigate(r.route)}
                      className="flex items-center gap-2 text-left p-2 rounded-md border hover:bg-accent transition-colors text-sm"
                    >
                      <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                      <div>
                        <span className="font-medium">{r.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{r.route}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* B) Entidades / Features */}
            <AccordionItem value="entities" className="border rounded-lg">
              <AccordionTrigger className="px-4 text-sm font-semibold">
                <span className="flex items-center gap-2"><Layers className="h-4 w-4" /> Entidades e Funcionalidades</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                {competitionFeatureCatalog.map((f) => (
                  <div key={f.key} className="border rounded-md p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{f.label}</span>
                      <Badge variant="outline" className="text-[10px]">{f.route}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{f.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {f.entities.map((e) => (
                        <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>

            {/* C) Tabelas Supabase */}
            <AccordionItem value="tables" className="border rounded-lg">
              <AccordionTrigger className="px-4 text-sm font-semibold">
                <span className="flex items-center gap-2"><Database className="h-4 w-4" /> Tabelas Supabase Detectadas</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {data.supabase.tables.map((t) => {
                    const found = data.diagnostics.found.tables.includes(t);
                    return (
                      <Badge
                        key={t}
                        variant={found ? "default" : "destructive"}
                        className="text-xs flex items-center gap-1"
                      >
                        {found ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {t}
                      </Badge>
                    );
                  })}
                </div>
                {data.supabase.rpcs.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">RPCs referenciadas:</p>
                    <div className="flex flex-wrap gap-2">
                      {data.supabase.rpcs.map((r) => (
                        <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* E) Alertas e lacunas */}
            <AccordionItem value="alerts" className="border rounded-lg">
              <AccordionTrigger className="px-4 text-sm font-semibold">
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Alertas e Lacunas</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-2">
                {data.diagnostics.missing.tables.length > 0 && (
                  <div className="border border-destructive/30 rounded-md p-3">
                    <p className="text-sm font-medium text-destructive mb-1">Tabelas não encontradas:</p>
                    <div className="flex flex-wrap gap-1">
                      {data.diagnostics.missing.tables.map((t) => (
                        <Badge key={t} variant="destructive" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {data.diagnostics.notes.length > 0 && (
                  <div className="border rounded-md p-3 bg-muted">
                  <p className="text-sm font-medium mb-1">Notas:</p>
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                      {data.diagnostics.notes.map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                  </div>
                )}
                {data.diagnostics.missing.tables.length === 0 && data.diagnostics.notes.length === 0 && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Nenhum alerta ou lacuna detectada.
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* JSON Viewer */}
            <AccordionItem value="json" className="border rounded-lg">
              <AccordionTrigger className="px-4 text-sm font-semibold">
                JSON Completo
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <JsonViewer data={data} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}

      {/* Empty state */}
      {!triggered && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Clique em "Gerar diagnóstico" para começar.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
