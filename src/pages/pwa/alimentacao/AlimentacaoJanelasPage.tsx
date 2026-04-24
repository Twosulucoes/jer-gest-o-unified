import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useActiveStageId } from "@/contexts/StageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock } from "lucide-react";
import { format } from "date-fns";

interface WindowItem {
  id: string;
  window_start: string;
  window_end: string;
  meal_type: { name: string } | null;
  consumption_count?: number;
}

export default function AlimentacaoJanelasPage() {
  const navigate = useNavigate();
  const eventId = useActiveEventId();
  const stageId = useActiveStageId();
  const [windows, setWindows] = useState<WindowItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      let query = supabase
        .from("meal_windows")
        .select("id, window_start, window_end, meal_type:meal_types(name)")
        .eq("event_id", eventId)
        .gte("window_start", today + "T00:00:00");

      if (stageId) {
        query = query.eq("event_stage_id", stageId);
      }

      const { data } = await query.order("window_start");
      setWindows((data as any) || []);
      setLoading(false);
    })();
  }, [eventId, stageId]);

  const getStatus = (w: WindowItem) => {
    const now = new Date();
    const start = new Date(w.window_start);
    const end = new Date(w.window_end);
    if (now < start) return { label: "Agendada", variant: "outline" as const };
    if (now >= start && now <= end) return { label: "Aberta", variant: "default" as const };
    return { label: "Encerrada", variant: "secondary" as const };
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button onClick={() => navigate("/pwa/alimentacao")} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Clock className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Janelas de Hoje</span>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-3">
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
                  {format(new Date(w.window_start), "HH:mm")} — {format(new Date(w.window_end), "HH:mm")}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
