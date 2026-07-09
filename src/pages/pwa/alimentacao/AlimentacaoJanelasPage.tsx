import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useActiveStageId } from "@/contexts/StageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import PwaLayout from "@/components/pwa/PwaLayout";
import { readMealWindowsCache, writeMealWindowsCache } from "@/lib/mealWindowsCache";
import { useTodayString } from "@/hooks/useTodayString";
import { mealWindowStatus } from "@/lib/mealWindowStatus";

interface WindowItem {
  id: string;
  start_time: string;
  end_time: string;
  service_date?: string;
  meal_type: { name: string } | null;
  consumption_count?: number;
  capacity?: number;
  location?: string;
  meal_locations?: { name: string } | null;
}

export default function AlimentacaoJanelasPage() {
  const eventId = useActiveEventId();
  const stageId = useActiveStageId();
  const [windows, setWindows] = useState<WindowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  const today = useTodayString();

  // Cache chaveado por evento+etapa (auditoria L bloqueador 4): leitura
  // imediata para feedback rápido + fetch de rede em seguida. Trocar de
  // contexto (evento/etapa) hidrata a partir do cache certo, não do lixo
  // do contexto anterior.
  useEffect(() => {
    const cached = readMealWindowsCache<WindowItem>(eventId, stageId);
    if (cached?.windows?.length) {
      setWindows(cached.windows);
    } else {
      setWindows([]);
    }
  }, [eventId, stageId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setQueryError(null);
      let query = supabase
        .from("meal_windows")
        .select(`
          id,
          start_time,
          end_time,
          service_date,
          capacity,
          location,
          meal_locations(name),
          meal_type:meal_types(name)
        `)
        .eq("event_id", eventId);

      if (stageId) {
        query = query.eq("event_stage_id", stageId);
      }

      const { data, error } = await query.order("service_date").order("start_time");
      if (error) {
        setQueryError(error.message);
        setLoading(false);
        return;
      }
      let list = (data as WindowItem[]) || [];

      if (list.length > 0) {
        const windowIds = list.map((w) => w.id);

        // vw_consumo_por_janela já agrega meal_consumptions por janela —
        // reaproveita em vez de buscar linha a linha.
        let consumoQ = (supabase as any)
          .from("vw_consumo_por_janela")
          .select("janela_id, total_consumos")
          .eq("event_id", eventId)
          .in("janela_id", windowIds);
        if (stageId) consumoQ = consumoQ.eq("event_stage_id", stageId);

        const [{ data: consumoRows }, { data: unlinkedRows }] = await Promise.all([
          consumoQ,
          (supabase as any)
            .from("meal_consumptions_unlinked")
            .select("meal_window_id")
            .in("meal_window_id", windowIds),
        ]);

        const consumoMap = new Map<string, number>(
          (consumoRows ?? []).map((r: any) => [r.janela_id, r.total_consumos ?? 0]),
        );
        const unlinkedMap = new Map<string, number>();
        for (const row of unlinkedRows ?? []) {
          unlinkedMap.set(row.meal_window_id, (unlinkedMap.get(row.meal_window_id) ?? 0) + 1);
        }

        list = list.map((w) => ({
          ...w,
          consumption_count: (consumoMap.get(w.id) ?? 0) + (unlinkedMap.get(w.id) ?? 0),
        }));
      }

      setWindows(list);
      setLoading(false);
      if (list.length > 0) writeMealWindowsCache(eventId, stageId, list);
    })();
  }, [eventId, stageId]);

  const getStatus = (w: WindowItem) => {
    const date = w.service_date || today;
    const status = mealWindowStatus(date, w.start_time, w.end_time);
    if (status === "futura") return { label: "Agendada", variant: "outline" as const };
    if (status === "ativa") return { label: "Aberta", variant: "default" as const };
    return { label: "Encerrada", variant: "secondary" as const };
  };

  return (
    <PwaLayout backTo="/pwa/alimentacao" moduleTitle="Janelas da Etapa">
      <main className="p-4 max-w-md mx-auto space-y-3">
        {(() => {
          const cached = readMealWindowsCache(eventId, stageId);
          if (!cached) return null;
          return (
            <div className="text-[10px] text-center text-muted-foreground uppercase tracking-wider mb-2">
              Última atualização: {format(new Date(cached.updated_at), "dd/MM HH:mm")}
            </div>
          );
        })()}
        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}

        {!loading && queryError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">Erro ao carregar janelas: {queryError}</p>
          </div>
        )}

        {!loading && !queryError && windows.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">Nenhuma janela cadastrada para esta etapa</div>
        )}

        {windows.map((w) => {
          const status = getStatus(w);
          const date = w.service_date || today;
          return (
            <Card key={w.id}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{w.meal_type?.name || "Refeição"}</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(`${date}T${w.start_time}`), "dd/MM")} • {w.start_time.slice(0, 5)} — {w.end_time.slice(0, 5)}
                </p>
                {(w.meal_locations?.name || w.location) && (
                  <p className="text-[10px] text-muted-foreground italic">
                    Local: {w.meal_locations?.name || w.location}
                  </p>
                )}
                {(w.consumption_count !== undefined || w.capacity) && (
                  <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    {w.capacity
                      ? `Consumo: ${w.consumption_count ?? 0}/${w.capacity}`
                      : `Consumo: ${w.consumption_count ?? 0}`}
                    {w.capacity && (w.consumption_count ?? 0) >= w.capacity && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400">· lotada</span>
                    )}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </main>
    </PwaLayout>
  );
}
