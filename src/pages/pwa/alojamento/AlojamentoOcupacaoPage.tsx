import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { getSelectedFacility } from "@/hooks/useAlojamento";
import { useEventContext } from "@/contexts/EventContext";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import {
  PwaSectionLabel,
  PwaStatTriplet,
  occupancyBarClass,
  occupancyTone,
} from "@/components/pwa/PwaDashboardPrimitives";
import { Building, FileBarChart, ScanLine } from "lucide-react";

interface RoomInfo {
  id: string;
  code: string;
  capacity: number;
  occupied: number;
}

interface BlockInfo {
  id: string;
  name: string;
  gender_policy: string;
  rooms: RoomInfo[];
}

export default function AlojamentoOcupacaoPage() {
  const navigate = useNavigate();
  const { activeEvent } = useEventContext();
  const [blocks, setBlocks] = useState<BlockInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpis, setKpis] = useState({ assigned: 0, total: 0, hospedados: 0 });
  const facilityId = getSelectedFacility();

  useEffect(() => {
    if (!facilityId) return;
    (async () => {
      const [{ data: occ }, { data: kpi }] = await Promise.all([
        supabase.rpc("get_alojamento_ocupacao" as any, { p_facility_id: facilityId }),
        supabase.rpc("get_alojamento_kpis" as any, { p_facility_id: facilityId }),
      ]);
      setBlocks((Array.isArray(occ) ? occ : []) as BlockInfo[]);
      setLoading(false);
      const k = (kpi || {}) as Record<string, number>;
      setKpis({
        assigned: k.assigned_beds ?? 0,
        total: Math.max(1, k.total_beds ?? 1),
        hospedados: k.hospedados ?? 0,
      });
      setKpiLoading(false);
    })();
  }, [facilityId]);

  const livres = Math.max(0, kpis.total - kpis.assigned);
  const pctGlobal = Math.round((kpis.assigned / kpis.total) * 100);

  const blockSummaries = useMemo(() => {
    return blocks.map((block) => {
      const cap = block.rooms.reduce((s, r) => s + r.capacity, 0);
      const occ = block.rooms.reduce((s, r) => s + r.occupied, 0);
      const pct = cap > 0 ? Math.round((occ / cap) * 100) : 0;
      return { block, cap, occ, pct };
    });
  }, [blocks]);

  const genderLabel: Record<string, string> = {
    misto: "Misto",
    masculino: "Masculino",
    feminino: "Feminino",
  };

  const eventSubtitle = activeEvent?.name
    ? `${activeEvent.name}${activeEvent.year ? ` — ${activeEvent.year}` : ""}`
    : "Ocupação por local";

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
      <PwaHeader title="Alojamento" icon={Building} backTo="/pwa/alojamento" />

      <main className="relative max-w-md mx-auto space-y-4 px-4 pb-28 pt-2">
        <div>
          <p className="text-xs text-muted-foreground">{eventSubtitle}</p>
        </div>

        <PwaStatTriplet
          loading={kpiLoading}
          items={[
            { label: "Ocupados", value: kpis.assigned, tone: "purple" },
            { label: "Livres", value: livres, tone: "green" },
            { label: "Hospedados", value: kpis.hospedados, tone: "amber" },
          ]}
        />

        <div className="space-y-2">
          <PwaSectionLabel>Locais de alojamento</PwaSectionLabel>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : blocks.length === 0 ? (
            <Card className="border-border/80 bg-card/95">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhum bloco cadastrado</CardContent>
            </Card>
          ) : (
            blockSummaries.map(({ block, cap, occ, pct }) => (
              <Card
                key={block.id}
                className="overflow-hidden border-border/80 bg-card/95 shadow-app-sm transition-shadow hover:shadow-app-md"
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{block.name}</p>
                      <p className="text-xs text-muted-foreground">{genderLabel[block.gender_policy] || block.gender_policy}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 rounded-full border-0 px-2.5 py-0.5 text-xs font-bold ${
                        pct >= 85
                          ? "bg-red-500/15 text-red-600 dark:text-red-400"
                          : pct >= 65
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "bg-green-500/15 text-green-700 dark:text-green-400"
                      }`}
                    >
                      {pct}%
                    </Badge>
                  </div>
                  <Progress value={pct} indicatorClassName={occupancyBarClass(pct)} className="h-2.5 bg-muted" />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>
                      <span className={occupancyTone(pct) === "red" ? "font-medium text-red-600 dark:text-red-400" : "font-medium text-foreground"}>
                        {occ}
                      </span>{" "}
                      ocupados
                    </span>
                    <span>
                      <span className="font-medium text-foreground">{Math.max(0, cap - occ)}</span> vagas de{" "}
                      <span className="font-medium text-foreground">{cap}</span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border/80 bg-background/95 p-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-md gap-3">
          <Button variant="module" className="h-12 flex-1 rounded-xl font-semibold" onClick={() => navigate("/pwa/alojamento/scan")}>
            <ScanLine className="mr-2 h-4 w-4" />
            Check-in
          </Button>
          <Button variant="outline" className="h-12 flex-1 rounded-xl border-purple-500/50 font-semibold text-purple-700 hover:bg-purple-500/10 dark:text-purple-300" onClick={() => navigate("/pwa/alojamento/lista-completa")}>
            <FileBarChart className="mr-2 h-4 w-4" />
            Relatório
          </Button>
        </div>
      </div>
    </div>
  );
}
