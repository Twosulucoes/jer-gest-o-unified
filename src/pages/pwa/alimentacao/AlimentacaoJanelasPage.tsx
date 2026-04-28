import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useActiveStageId } from "@/contexts/StageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import PwaLayout from "@/components/pwa/PwaLayout";

interface WindowItem {
  id: string;
  window_start: string;
  window_end: string;
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

  useEffect(() => {
    (async () => {
      // Fetch all windows for the current stage to ensure offline availability
      let query = supabase
        .from("meal_windows")
        .select(`
          id, 
          window_start, 
          window_end, 
          capacity,
          location,
          meal_locations(name),
          meal_type:meal_types(name)
        `)
        .eq("event_id", eventId);

      if (stageId) {
        query = query.eq("event_stage_id", stageId);
      }

      const { data } = await query.order("window_start");
      setWindows((data as any) || []);
      setLoading(false);

      // Persist to local storage for offline use
      if (data) {
        localStorage.setItem("pwa_meal_windows_cache", JSON.stringify({
          updated_at: new Date().toISOString(),
          windows: data
        }));
      }
    })();
  }, [eventId, stageId]);

  // Load from cache initially
  useEffect(() => {
    const cached = localStorage.getItem("pwa_meal_windows_cache");
    if (cached) {
      try {
        const { windows: cachedWindows } = JSON.parse(cached);
        if (cachedWindows && windows.length === 0) {
          setWindows(cachedWindows);
        }
      } catch (e) {
        console.error("Error parsing windows cache", e);
      }
    }
  }, []);

  const getStatus = (w: WindowItem) => {
    const now = new Date();
    const start = new Date(w.window_start);
    const end = new Date(w.window_end);
    if (now < start) return { label: "Agendada", variant: "outline" as const };
    if (now >= start && now <= end) return { label: "Aberta", variant: "default" as const };
    return { label: "Encerrada", variant: "secondary" as const };
  };

  return (
    <PwaLayout backTo="/pwa/alimentacao" moduleTitle="Janelas da Etapa">
      <main className="p-4 max-w-md mx-auto space-y-3">
        {(() => {
          const cached = localStorage.getItem("pwa_meal_windows_cache");
          if (!cached) return null;
          try {
            const { updated_at } = JSON.parse(cached);
            return (
              <div className="text-[10px] text-center text-muted-foreground uppercase tracking-wider mb-2">
                Última atualização: {format(new Date(updated_at), "dd/MM HH:mm")}
              </div>
            );
          } catch (e) { return null; }
        })()}
        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}

        {!loading && windows.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">Nenhuma janela para hoje</div>
        )}

        {windows.map((w) => {
          const status = getStatus(w);
          return (
            <Card key={w.id}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{w.meal_type?.name || "Refeição"}</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(w.window_start), "dd/MM")} • {format(new Date(w.window_start), "HH:mm")} — {format(new Date(w.window_end), "HH:mm")}
                </p>
                {(w.meal_locations?.name || w.location) && (
                  <p className="text-[10px] text-muted-foreground italic">
                    Local: {w.meal_locations?.name || w.location}
                  </p>
                )}
                {w.capacity && (
                  <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    Capacidade: {w.capacity}
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
