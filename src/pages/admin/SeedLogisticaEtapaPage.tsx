import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Play, Trash2, Layers, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const SEED_PREFIX = "seed:logistica:stage:";

type StageRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
};

type StageCounts = {
  vehicles: number;
  lodging_locations: number;
  lodging_units: number;
  meal_types: number;
  meal_windows: number;
  routes: number;
  trips: number;
};

export default function SeedLogisticaEtapaPage() {
  const { events, activeEventId, setActiveEventId, eventsLoading } = useEventContext();
  const qc = useQueryClient();
  const [lastResult, setLastResult] = useState<any>(null);

  const { data: bootstrap, isLoading: bootstrapLoading } = useQuery({
    queryKey: ["seed-log-bootstrap", activeEventId],
    enabled: !!activeEventId,
    queryFn: async () => {
      const head = (q: any) => q.select("id", { count: "exact", head: true }).eq("event_id", activeEventId);
      const [stagesRes, dl, vn] = await Promise.all([
        (supabase.from("event_stages" as never) as any)
          .select("id,name,slug,status,sort_order,starts_at,ends_at")
          .eq("event_id", activeEventId)
          .eq("status", "active")
          .order("sort_order", { ascending: true }),
        head(supabase.from("delegations")),
        head(supabase.from("venues")),
      ]);
      if (stagesRes.error) throw stagesRes.error;
      return {
        stages: (stagesRes.data ?? []) as StageRow[],
        delegations: dl.count || 0,
        venues: vn.count || 0,
      };
    },
  });

  const stages = bootstrap?.stages ?? [];
  const stageTags = stages.map((s) => `${SEED_PREFIX}${s.slug}`);

  const { data: countsByStage, isLoading: countsLoading } = useQuery({
    queryKey: ["seed-log-counts-by-stage", activeEventId, stageTags.join(",")],
    enabled: !!activeEventId && stages.length > 0,
    queryFn: async () => {
      const map: Record<string, StageCounts> = {};
      await Promise.all(stages.map(async (s) => {
        const tag = `${SEED_PREFIX}${s.slug}`;
        const head = (table: string) =>
          (supabase.from(table as never) as any)
            .select("id", { count: "exact", head: true })
            .eq("event_id", activeEventId).eq("seed_tag", tag);
        const [v, ll, lu, mt, mw, r, t] = await Promise.all([
          head("transport_vehicles"), head("lodging_locations"), head("lodging_units"),
          head("meal_types"), head("meal_windows"), head("transport_routes"), head("transport_trips"),
        ]);
        map[s.id] = {
          vehicles: v.count || 0, lodging_locations: ll.count || 0, lodging_units: lu.count || 0,
          meal_types: mt.count || 0, meal_windows: mw.count || 0, routes: r.count || 0, trips: t.count || 0,
        };
      }));
      return map;
    },
  });

  const stagesWithSeed = stages.filter((s) => {
    const c = countsByStage?.[s.id];
    return c && (c.vehicles + c.lodging_locations + c.routes + c.trips) > 0;
  }).length;
  const stagesWithoutSeed = stages.length - stagesWithSeed;

  const canSeed = !!bootstrap && bootstrap.delegations > 0 && bootstrap.venues > 0 && stages.length > 0;

  const seedMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("seed_logistics_all_stages" as any, { p_event_id: activeEventId! });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      setLastResult({ kind: "generated", data });
      toast.success(`Seed gerado: ${data?.stages_processed ?? 0} etapa(s) processada(s), ${data?.stages_skipped ?? 0} pulada(s).`);
      qc.invalidateQueries({ queryKey: ["seed-log-counts-by-stage"] });
    },
    onError: (e: any) => toast.error("Erro ao gerar seed: " + e.message),
  });

  const clearMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("clear_logistics_seed_all_stages" as any, { p_event_id: activeEventId! });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      setLastResult({ kind: "cleared", data });
      toast.success("Seed de logística removido de todas as etapas.");
      qc.invalidateQueries({ queryKey: ["seed-log-counts-by-stage"] });
    },
    onError: (e: any) => toast.error("Erro ao limpar seed: " + e.message),
  });

  const isBusy = seedMut.isPending || clearMut.isPending;
  const activeEventName = events.find((e) => e.id === activeEventId)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Seed de Logística — todas as etapas</h1>
          <p className="text-sm text-muted-foreground">
            Gera dados de teste de transporte, alojamento e alimentação para <strong>cada etapa ativa</strong> do evento, isolados por{" "}
            <code className="text-xs bg-muted px-1 rounded">{`${SEED_PREFIX}{etapa-slug}`}</code>.
          </p>
        </div>
        <div className="min-w-[260px]">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evento</label>
          <Select value={activeEventId ?? ""} onValueChange={setActiveEventId} disabled={eventsLoading}>
            <SelectTrigger><SelectValue placeholder="Selecionar evento…" /></SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!activeEventId && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          Selecione um evento acima para começar.
        </CardContent></Card>
      )}

      {activeEventId && (
        <>
          {/* Pré-checagem */}
          {bootstrap && !canSeed && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 flex gap-3 items-start">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold">Evento sem dados base.</p>
                  <p className="text-muted-foreground">
                    Cadastre <strong>delegações</strong> ({bootstrap.delegations}),{" "}
                    <strong>venues</strong> ({bootstrap.venues}) e ao menos uma{" "}
                    <strong>etapa ativa</strong> ({stages.length}) antes de gerar o seed.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumo geral */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Etapas ativas</p><p className="text-lg font-bold">{bootstrapLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : stages.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Com seed</p><p className="text-lg font-bold">{countsLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : stagesWithSeed}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sem seed</p><p className="text-lg font-bold">{countsLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : stagesWithoutSeed}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Venues / Delegações</p><p className="text-lg font-bold">{bootstrap?.venues ?? 0} / {bootstrap?.delegations ?? 0}</p></CardContent></Card>
          </div>

          {/* Ações */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Ações</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={isBusy || !canSeed}>
                    {seedMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Gerar seed em todas as etapas
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Gerar seed em todas as etapas de "{activeEventName}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Para cada uma das {stages.length} etapas ativas serão criados: 5 veículos, 1 alojamento + 2 unidades por venue,
                      1 refeitório + 3 janelas/dia por venue, 4 rotas por venue e 4 viagens por delegação.
                      Etapas que já possuem seed serão <strong>puladas</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => seedMut.mutate()}>Gerar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isBusy || stagesWithSeed === 0}>
                    {clearMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Limpar seed de todas as etapas
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover seed de logística de todas as etapas?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Serão apagados <strong>somente</strong> os registros marcados com{" "}
                      <code>{`${SEED_PREFIX}*`}</code> neste evento. Dados manuais não serão afetados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clearMut.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Sim, remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* Detalhe por etapa */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4"/> Etapas</CardTitle></CardHeader>
            <CardContent>
              {stages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma etapa ativa cadastrada para este evento.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-3">Etapa</th>
                        <th className="py-2 px-2">Status</th>
                        <th className="py-2 px-2 text-right">Veíc.</th>
                        <th className="py-2 px-2 text-right">Alojam.</th>
                        <th className="py-2 px-2 text-right">Unid.</th>
                        <th className="py-2 px-2 text-right">Refeit.</th>
                        <th className="py-2 px-2 text-right">Janelas</th>
                        <th className="py-2 px-2 text-right">Rotas</th>
                        <th className="py-2 px-2 text-right">Viagens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stages.map((s) => {
                        const c = countsByStage?.[s.id];
                        const has = c && (c.vehicles + c.lodging_locations + c.routes + c.trips) > 0;
                        return (
                          <tr key={s.id} className="border-b last:border-0">
                            <td className="py-2 pr-3">
                              <div className="font-medium">{s.name}</div>
                              <code className="text-xs text-muted-foreground">{s.slug}</code>
                            </td>
                            <td className="py-2 px-2">
                              {has
                                ? <Badge className="bg-primary text-primary-foreground">Seed</Badge>
                                : <Badge variant="secondary">Vazio</Badge>}
                            </td>
                            <td className="py-2 px-2 text-right">{c?.vehicles ?? 0}</td>
                            <td className="py-2 px-2 text-right">{c?.lodging_locations ?? 0}</td>
                            <td className="py-2 px-2 text-right">{c?.lodging_units ?? 0}</td>
                            <td className="py-2 px-2 text-right">{c?.meal_types ?? 0}</td>
                            <td className="py-2 px-2 text-right">{c?.meal_windows ?? 0}</td>
                            <td className="py-2 px-2 text-right">{c?.routes ?? 0}</td>
                            <td className="py-2 px-2 text-right">{c?.trips ?? 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {lastResult && (
            <Card>
              <CardHeader><CardTitle className="text-base">Último resultado ({lastResult.kind === "cleared" ? "limpeza" : "geração"})</CardTitle></CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-80">
                  {JSON.stringify(lastResult.data, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
