import { useEffect, useState } from "react";
import { useEventContext } from "@/contexts/EventContext";
import { useStageContext } from "@/contexts/StageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import PwaLayout from "@/components/pwa/PwaLayout";
import { format } from "date-fns";
import { useTodayString } from "@/hooks/useTodayString";
import { dayRangeRoraima } from "@/lib/dayRangeRoraima";

interface ConsumptionItem {
  id: string;
  consumed_at: string;
  method: string;
  participant: { person: { full_name: string } | null } | null;
  meal_window: { meal_type: { name: string } | null } | null;
}

export default function AlimentacaoHistoricoPage() {
  const { activeEventId } = useEventContext();
  const { activeStageId } = useStageContext();
  const [items, setItems] = useState<ConsumptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const today = useTodayString();

  async function loadHistorico() {
    setLoading(true);
    const { startIso, endIsoExclusive } = dayRangeRoraima(today);
    let query = supabase
      .from("meal_consumptions")
      .select("id, consumed_at, method, participant:participants(person:people(full_name)), meal_window:meal_windows!inner(event_id, event_stage_id, meal_type:meal_types(name))")
      .eq("meal_windows.event_id", activeEventId)
      .gte("consumed_at", startIso)
      .lt("consumed_at", endIsoExclusive);

    if (activeStageId) {
      query = query.eq("meal_windows.event_stage_id", activeStageId);
    }

    const { data } = await query
      .order("consumed_at", { ascending: false })
      .limit(50);
    setItems((data as any) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadHistorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEventId, activeStageId, today]);

  // Realtime: a lista ficava parada até o próximo mount/troca de dia — um
  // consumo novo feito em outro dispositivo só aparecia depois de reabrir a
  // tela.
  useEffect(() => {
    if (!activeEventId) return;
    const channel = supabase
      .channel(`meal_historico_${activeEventId}_${activeStageId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meal_consumptions" }, () => loadHistorico())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEventId, activeStageId, today]);

  return (
    <PwaLayout backTo="/pwa/alimentacao" moduleTitle="Histórico de Hoje">
      <main className="p-4 max-w-md mx-auto space-y-3">
        {loading && [1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full" />)}

        {!loading && items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">Nenhum consumo registrado hoje</div>
        )}

        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{item.participant?.person?.full_name || "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {(item.meal_window as any)?.meal_type?.name || "Refeição"} • {item.method === "qr" ? "QR" : "Manual"}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {format(new Date(item.consumed_at), "HH:mm")}
              </span>
            </CardContent>
          </Card>
        ))}
      </main>
    </PwaLayout>
  );
}
