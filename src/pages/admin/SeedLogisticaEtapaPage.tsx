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
  Loader2, Play, Trash2, Bus, Building2, BedDouble, Utensils, Route as RouteIcon, MapPinned, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const SEED_TAG = "seed:logistica:stage";

type Counts = {
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

  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["seed-logistica-counts", activeEventId],
    queryFn: async (): Promise<Counts & { delegations: number; venues: number }> => {
      if (!activeEventId) return { vehicles:0, lodging_locations:0, lodging_units:0, meal_types:0, meal_windows:0, routes:0, trips:0, delegations:0, venues:0 };
      const head = (q: any) => q.select("id", { count: "exact", head: true }).eq("event_id", activeEventId);
      const tag = (q: any) => head(q).eq("seed_tag", SEED_TAG);
      const [veh, loc, uni, mt, mw, rt, tr, dl, vn] = await Promise.all([
        tag(supabase.from("transport_vehicles")),
        tag(supabase.from("lodging_locations")),
        tag(supabase.from("lodging_units")),
        tag(supabase.from("meal_types")),
        tag(supabase.from("meal_windows")),
        tag(supabase.from("transport_routes")),
        tag(supabase.from("transport_trips")),
        head(supabase.from("delegations")),
        head(supabase.from("venues")),
      ]);
      return {
        vehicles: veh.count || 0,
        lodging_locations: loc.count || 0,
        lodging_units: uni.count || 0,
        meal_types: mt.count || 0,
        meal_windows: mw.count || 0,
        routes: rt.count || 0,
        trips: tr.count || 0,
        delegations: dl.count || 0,
        venues: vn.count || 0,
      };
    },
    enabled: !!activeEventId,
  });

  const hasSeed = !!counts && (counts.vehicles + counts.lodging_locations + counts.routes + counts.trips) > 0;
  const canSeed = !!counts && counts.delegations > 0 && counts.venues > 0;

  const seedMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("seed_logistics_by_stage" as any, { p_event_id: activeEventId! });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      setLastResult({ kind: "generated", data });
      toast.success("Seed de logística gerado com sucesso");
      qc.invalidateQueries({ queryKey: ["seed-logistica-counts"] });
    },
    onError: (e: any) => toast.error("Erro ao gerar seed: " + e.message),
  });

  const clearMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("clear_logistics_seed_by_stage" as any, { p_event_id: activeEventId! });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      setLastResult({ kind: "cleared", data });
      toast.success("Seed de logística removido");
      qc.invalidateQueries({ queryKey: ["seed-logistica-counts"] });
    },
    onError: (e: any) => toast.error("Erro ao limpar seed: " + e.message),
  });

  const isBusy = seedMut.isPending || clearMut.isPending;
  const activeEventName = events.find((e) => e.id === activeEventId)?.name ?? "—";

  const cards = [
    { label: "Veículos",      value: counts?.vehicles,           icon: Bus },
    { label: "Alojamentos",   value: counts?.lodging_locations,  icon: Building2 },
    { label: "Unidades",      value: counts?.lodging_units,      icon: BedDouble },
    { label: "Refeitórios",   value: counts?.meal_types,         icon: Utensils },
    { label: "Rotas",         value: counts?.routes,             icon: RouteIcon },
    { label: "Viagens",       value: counts?.trips,              icon: MapPinned },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Seed de Logística por Etapa</h1>
          <p className="text-sm text-muted-foreground">
            Gera dados de teste de transporte, alojamento e alimentação isolados por evento, com nomenclatura{" "}
            <code className="text-xs bg-muted px-1 rounded">{`{TIPO}-{SEDE}-{NNN}`}</code>.
          </p>
        </div>
        <div className="min-w-[260px]">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evento / Etapa</label>
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
          {counts && !canSeed && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 flex gap-3 items-start">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold">Evento sem dados base.</p>
                  <p className="text-muted-foreground">
                    Cadastre <strong>delegações</strong> ({counts.delegations}) e <strong>locais de competição / venues</strong> ({counts.venues}) antes de gerar o seed.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <c.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className="text-lg font-bold">
                      {countsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (c.value ?? 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Status: {hasSeed
                  ? <Badge className="bg-primary text-primary-foreground ml-2">Seed ativo</Badge>
                  : <Badge variant="secondary" className="ml-2">Sem seed</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={isBusy || !canSeed || hasSeed}>
                    {seedMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Gerar seed de logística
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Gerar seed de logística para "{activeEventName}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Serão criados: 5 veículos, 1 alojamento + 2 unidades por venue, 1 refeitório + 3 janelas/dia por venue,
                      4 rotas por venue e 4 viagens por delegação. Todos marcados como seed e isolados a este evento.
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
                  <Button variant="destructive" disabled={isBusy || !hasSeed}>
                    {clearMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Limpar seed de logística
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover seed de logística de "{activeEventName}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Serão apagados <strong>somente</strong> os registros marcados como seed neste evento:{" "}
                      {counts?.vehicles ?? 0} veículos, {counts?.lodging_locations ?? 0} alojamentos,{" "}
                      {counts?.lodging_units ?? 0} unidades, {counts?.meal_types ?? 0} refeitórios,{" "}
                      {counts?.meal_windows ?? 0} janelas, {counts?.routes ?? 0} rotas, {counts?.trips ?? 0} viagens.
                      Dados manuais não serão afetados.
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
