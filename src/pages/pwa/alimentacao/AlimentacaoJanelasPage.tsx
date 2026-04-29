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

  useEffect(() => {
    (async () => {
      let query = supabase
        .from("meal_windows")
        .select(`
          id,
          start_time,
          end_time,
          service_date,
          capacity,
          location,
          meal_locations!meal_window_location_id(name),
          meal_type:meal_types(name)
        `)
        .eq("event_id", eventId);

      if (stageId) {
        query = query.eq("event_stage_id", stageId);
      }

      const { data } = await query.order("start_time");
      setWindows((data as any) || []);
      setLoading(false);

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
    const today = new Date().toISOString().slice(0, 10);
    const date = w.service_date || today;
    const start = new Date(`${date}T${w.start_time}`);
    const end = new Date(`${date}T${w.end_time}`);
    const now = new Date();
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
          const today = new Date().toISOString().slice(0, 10);
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
