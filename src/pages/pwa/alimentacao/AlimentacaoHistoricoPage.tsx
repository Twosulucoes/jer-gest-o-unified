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
  origem: string;
  participante_nome: string | null;
  refeicao_tipo: string | null;
}

const ORIGEM_LABEL: Record<string, string> = {
  scan_qr: "QR",
  busca_manual: "Manual",
  voucher: "Voucher",
};

export default function AlimentacaoHistoricoPage() {
  const { activeEventId } = useEventContext();
  const { activeStageId } = useStageContext();
  const [items, setItems] = useState<ConsumptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const today = useTodayString();

  async function loadHistorico() {
    setLoading(true);
    const { startIso, endIsoExclusive } = dayRangeRoraima(today);
    // vw_consumo_completo unifica as TRÊS fontes de consumo (vinculado +
    // QR avulso + voucher, ver vw_meal_consumptions_all) e já resolve nome
    // do participante ("Consumo avulso: {qr}" quando não vinculado) e tipo
    // de refeição. Antes esta tela lia só meal_consumptions e bipes avulsos/
    // voucher nunca apareciam no histórico do operador.
    let query = (supabase as any)
      .from("vw_consumo_completo")
      .select("id, consumed_at, origem, participante_nome, refeicao_tipo")
      .eq("event_id", activeEventId)
      .gte("consumed_at", startIso)
      .lt("consumed_at", endIsoExclusive);

    if (activeStageId) {
      query = query.eq("event_stage_id", activeStageId);
    }

    const { data } = await query
      .order("consumed_at", { ascending: false })
      .limit(50);
    setItems((data as ConsumptionItem[]) || []);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "meal_consumptions_unlinked" }, () => loadHistorico())
      .on("postgres_changes", { event: "*", schema: "public", table: "service_voucher_uses" }, () => loadHistorico())
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
                <p className="font-medium text-sm">{item.participante_nome || "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {item.refeicao_tipo || "Refeição"} • {ORIGEM_LABEL[item.origem] ?? item.origem}
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
