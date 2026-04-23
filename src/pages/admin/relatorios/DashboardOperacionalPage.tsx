import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { useEventBranding } from "@/hooks/useEventBranding";
import { useDashboardData } from "./useDashboardData";
import { exportDashboardPdf } from "./dashboardPdfExporter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportShell } from "@/components/relatorios";
import { ReportPresetsButton } from "@/components/relatorios/ReportPresetsButton";
import {
  Users, BadgeCheck, Trophy, UtensilsCrossed, Bed, Bus,
  RefreshCw, Download, CalendarClock, Truck, MapPin,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { toast } from "sonner";

const PALETTE = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success, 142 71% 45%))", "hsl(var(--warning, 38 92% 50%))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

function fmtDate(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }
  catch { return d; }
}

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

export default function DashboardOperacionalPage() {
  const eventId = useActiveEventId();
  const { activeEvent } = useEventContext();
  const queryClient = useQueryClient();
  const { data: branding } = useEventBranding(eventId);
  const { data, isLoading, refetchAll, lastUpdated } = useDashboardData(eventId);
  const [showAllDel, setShowAllDel] = useState(false);
  const [exporting, setExporting] = useState(false);

  const r = data.resumo;
  const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0);

  const handleRefresh = async () => {
    await refetchAll();
    toast.success("Dados atualizados");
  };

  const handleExportPdf = async () => {
    if (!eventId) return;
    try {
      setExporting(true);
      const blob = await exportDashboardPdf(data, {
        eventName: activeEvent?.name || "Evento",
        branding: branding ?? null,
        generatedAt: new Date(),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `Dashboard_${(activeEvent?.name || "Evento").replace(/\s+/g, "_")}_${dateStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório exportado");
    } catch (e: any) {
      toast.error("Falha ao exportar: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setExporting(false);
    }
  };

  if (!eventId) {
    return (
      <div className="container mx-auto py-6">
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Selecione um evento ativo para visualizar o dashboard.</CardContent></Card>
      </div>
    );
  }

  const delegationsToShow = showAllDel ? data.credenciamento.by_delegation : data.credenciamento.by_delegation.slice(0, 10);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Dashboard Operacional</h1>
          <p className="text-sm text-muted-foreground">
            Monitoramento geral das operações — Última atualização:{" "}
            {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex gap-2">
          <ReportPresetsButton
            reportId="dashboard-operacional"
            eventId={eventId}
            currentFilters={{}}
            onApply={() => { /* sem filtros configuráveis hoje */ }}
          />
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar dados
          </Button>
          <Button size="sm" onClick={handleExportPdf} disabled={exporting || isLoading}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Exportando..." : "Exportar relatório do dia"}
          </Button>
        </div>
      </header>

      {/* Cards de Resumo */}
      <section>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[100px]" />)
          ) : (
            <>
              <KpiCard icon={Users} label="Participantes" value={r.participants_total}
                sub={`${r.credentialed} credenciados de ${r.participants_total} (${pct(r.credentialed, r.participants_total)}%)`}
                tint="bg-primary/10 text-primary" />
              <KpiCard icon={BadgeCheck} label="Credenciais Ativas" value={r.credentials_active}
                sub={`${r.credentials_today} emitidas hoje`}
                tint="bg-accent/10 text-accent-foreground" />
              <KpiCard icon={Trophy} label="Partidas" value={r.matches_total}
                sub={`${r.matches_done} concluídas · ${r.matches_published} publicadas`}
                tint="bg-amber-500/10 text-amber-600" />
              <KpiCard icon={UtensilsCrossed} label="Refeições Servidas" value={r.meals_total}
                sub={`${r.meals_today} servidas hoje`}
                tint="bg-emerald-500/10 text-emerald-600" />
              <KpiCard icon={Bed} label="Alojamento" value={`${r.lodging_occupied}/${r.lodging_capacity}`}
                sub={`${pct(r.lodging_occupied, r.lodging_capacity)}% de ocupação`}
                tint="bg-blue-500/10 text-blue-600" />
              <KpiCard icon={Bus} label="Transporte" value={r.transport_trips}
                sub={`${r.transport_passengers} passageiros transportados`}
                tint="bg-purple-500/10 text-purple-600" />
            </>
          )}
        </div>
      </section>

      {/* Credenciamento */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Credenciamento</h2>
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader><CardTitle className="text-sm">Credenciamentos por dia</CardTitle></CardHeader>
            <CardContent className="h-[260px]">
              {data.credenciamento.daily.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem credenciamentos registrados.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.credenciamento.daily.map((d) => ({ ...d, date: fmtDate(d.date) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm">Progresso por Delegação</CardTitle>
              {data.credenciamento.by_delegation.length > 10 && (
                <Button variant="ghost" size="sm" onClick={() => setShowAllDel((v) => !v)}>
                  {showAllDel ? "Mostrar 10" : "Ver todas"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {delegationsToShow.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem delegações registradas.</p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2">
                  {delegationsToShow.map((d) => (
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
        </div>
      </section>

      {/* Alimentação */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Alimentação</h2>
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader><CardTitle className="text-sm">Consumo por dia (por tipo)</CardTitle></CardHeader>
            <CardContent className="h-[260px]">
              {data.alimentacao.daily.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Nenhuma refeição registrada.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.alimentacao.daily.map((d) => ({ ...d, date: fmtDate(String(d.date)) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {data.alimentacao.meal_types.map((t, i) => (
                      <Bar key={t} dataKey={t} stackId="a" fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-sm">Consumo por Delegação</CardTitle></CardHeader>
            <CardContent>
              {data.alimentacao.by_delegation.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem consumos registrados.</p>
              ) : (
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-2 text-xs">
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
        </div>
      </section>

      {/* Transporte */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Transporte</h2>
        {r.transport_trips === 0 && r.transport_vehicles === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">Nenhuma viagem registrada.</CardContent></Card>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <KpiCard icon={Truck} label="Veículos cadastrados" value={r.transport_vehicles} tint="bg-purple-500/10 text-purple-600" />
            <KpiCard icon={Bus} label="Viagens realizadas" value={r.transport_trips} tint="bg-purple-500/10 text-purple-600" />
            <KpiCard icon={Users} label="Passageiros transportados" value={r.transport_passengers} tint="bg-purple-500/10 text-purple-600" />
          </div>
        )}
      </section>

      {/* Competição */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Competição</h2>
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader><CardTitle className="text-sm">Progresso por modalidade</CardTitle></CardHeader>
            <CardContent>
              {data.competicao.by_sport.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma partida cadastrada.</p>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
                  <div className="grid grid-cols-12 text-[10px] uppercase text-muted-foreground border-b pb-1">
                    <div className="col-span-5">Modalidade</div>
                    <div className="col-span-2 text-center">Total</div>
                    <div className="col-span-2 text-center">Concl.</div>
                    <div className="col-span-2 text-center">Publ.</div>
                    <div className="col-span-1 text-right">%</div>
                  </div>
                  {data.competicao.by_sport.map((row) => (
                    <div key={row.sport_event_id} className="space-y-1">
                      <div className="grid grid-cols-12 text-xs items-center">
                        <div className="col-span-5 truncate font-medium">{row.name}</div>
                        <div className="col-span-2 text-center tabular-nums">{row.total}</div>
                        <div className="col-span-2 text-center tabular-nums">{row.done}</div>
                        <div className="col-span-2 text-center tabular-nums">{row.published}</div>
                        <div className="col-span-1 text-right tabular-nums">{row.pct}%</div>
                      </div>
                      <Progress value={row.pct} className="h-1" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Partidas de hoje</CardTitle></CardHeader>
            <CardContent>
              {data.competicao.today.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma partida agendada para hoje.</p>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
                  {data.competicao.today.map((m) => (
                    <div key={m.id} className="border border-border rounded-md p-2 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="font-semibold">{m.start_time?.slice(0, 5) ?? "--:--"}</span>
                        <Badge variant={m.status === "completed" ? "default" : "outline"} className="text-[9px] h-5">{m.status}</Badge>
                      </div>
                      <p className="text-muted-foreground truncate">{m.sport_name}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
