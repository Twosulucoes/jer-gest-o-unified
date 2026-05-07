import { useState } from "react";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { useDashboardData } from "./useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, BadgeCheck, RefreshCw, ShieldCheck, CalendarCheck } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { toast } from "sonner";

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

export default function RelatoriosCredenciamentoPage() {
  const eventId = useActiveEventId();
  const { activeEvent } = useEventContext();
  const { data, isLoading, refetchAll, lastUpdated } = useDashboardData(eventId);
  const [showAll, setShowAll] = useState(false);

  const r = data.resumo;
  const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0);
  const credPct = pct(r.credentialed, r.athletes_total);

  const delegationsToShow = showAll
    ? data.credenciamento.by_delegation
    : data.credenciamento.by_delegation.slice(0, 15);

  const handleRefresh = async () => {
    await refetchAll();
    toast.success("Dados atualizados");
  };

  if (!eventId) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Selecione um evento ativo para visualizar o relatório de credenciamento.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Relatório de Credenciamento</h1>
          <p className="text-sm text-muted-foreground">
            {activeEvent?.name ?? "Evento"} — Última atualização:{" "}
            {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar dados
        </Button>
      </header>

      {/* KPIs */}
      <section>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[100px]" />)
          ) : (
            <>
              <KpiCard
                icon={Users}
                label="Total de Atletas"
                value={r.athletes_total}
                sub="participantes cadastrados"
                tint="bg-primary/10 text-primary"
              />
              <KpiCard
                icon={BadgeCheck}
                label="Credenciados"
                value={r.credentialed}
                sub={`${credPct}% do total`}
                tint="bg-emerald-500/10 text-emerald-600"
              />
              <KpiCard
                icon={ShieldCheck}
                label="Credenciais Ativas"
                value={r.credentials_active}
                sub="credenciais em vigor"
                tint="bg-accent/10 text-accent-foreground"
              />
              <KpiCard
                icon={CalendarCheck}
                label="Emitidas Hoje"
                value={r.credentials_today}
                sub="novas credenciais no dia"
                tint="bg-blue-500/10 text-blue-600"
              />
            </>
          )}
        </div>
      </section>

      {/* Barra de progresso geral */}
      {!isLoading && r.athletes_total > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Progresso geral de credenciamento</span>
              <span className="tabular-nums">{r.credentialed}/{r.athletes_total} ({credPct}%)</span>
            </div>
            <Progress value={credPct} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {r.athletes_total - r.credentialed} participantes ainda não credenciados
            </p>
          </CardContent>
        </Card>
      )}

      {/* Gráfico + Por delegação */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Credenciamentos por dia</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : data.credenciamento.daily.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Sem credenciamentos registrados.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.credenciamento.daily.map((d) => ({ ...d, date: fmtDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Credenciados" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">Progresso por Delegação</CardTitle>
            <div className="flex items-center gap-2">
              {!isLoading && (
                <Badge variant="secondary" className="text-xs">
                  {data.credenciamento.by_delegation.length} delegações
                </Badge>
              )}
              {data.credenciamento.by_delegation.length > 15 && (
                <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Mostrar 15" : "Ver todas"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
              </div>
            ) : delegationsToShow.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem delegações registradas.</p>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-2">
                {delegationsToShow.map((d) => (
                  <div key={d.delegation_id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="truncate font-medium">{d.name}</span>
                      <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                        {d.credentialed}/{d.total} ({d.pct}%)
                      </span>
                    </div>
                    <Progress value={d.pct} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela completa por delegação */}
      {!isLoading && data.credenciamento.by_delegation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Detalhamento por Delegação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground uppercase text-[10px]">
                    <th className="text-left py-2 pr-4 font-medium">Delegação</th>
                    <th className="text-center py-2 px-2 font-medium">Total</th>
                    <th className="text-center py-2 px-2 font-medium">Credenciados</th>
                    <th className="text-center py-2 px-2 font-medium">Pendentes</th>
                    <th className="text-right py-2 font-medium">Progresso</th>
                  </tr>
                </thead>
                <tbody>
                  {data.credenciamento.by_delegation.map((d) => (
                    <tr key={d.delegation_id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-2 pr-4 font-medium">{d.name}</td>
                      <td className="py-2 px-2 text-center tabular-nums">{d.total}</td>
                      <td className="py-2 px-2 text-center tabular-nums text-emerald-600 font-semibold">{d.credentialed}</td>
                      <td className="py-2 px-2 text-center tabular-nums text-amber-600">{d.total - d.credentialed}</td>
                      <td className="py-2 text-right">
                        <span className={`font-semibold tabular-nums ${d.pct === 100 ? "text-emerald-600" : d.pct >= 50 ? "text-amber-600" : "text-destructive"}`}>
                          {d.pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold text-xs">
                    <td className="py-2 pr-4">Total geral</td>
                    <td className="py-2 px-2 text-center tabular-nums">{r.athletes_total}</td>
                    <td className="py-2 px-2 text-center tabular-nums text-emerald-600">{r.credentialed}</td>
                    <td className="py-2 px-2 text-center tabular-nums text-amber-600">{r.athletes_total - r.credentialed}</td>
                    <td className="py-2 text-right text-primary">{credPct}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
