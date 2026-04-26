import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { format } from "date-fns";

interface ConsumptionItem {
  id: string;
  consumed_at: string;
  method: string;
  participant: { person: { full_name: string } | null } | null;
  meal_window: { meal_type: { name: string } | null } | null;
}

export default function AlimentacaoHistoricoPage() {
  const [items, setItems] = useState<ConsumptionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("meal_consumptions")
        .select("id, consumed_at, method, participant:participants(person:people(full_name)), meal_window:meal_windows(meal_type:meal_types(name))")
        .gte("consumed_at", today + "T00:00:00")
        .order("consumed_at", { ascending: false })
        .limit(50);
      setItems((data as any) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader title="Histórico de Hoje" icon={BarChart3} backTo="/pwa/alimentacao" />

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
    </div>
  );
}
