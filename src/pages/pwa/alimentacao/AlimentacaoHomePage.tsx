import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PwaContainer } from "@/components/pwa/PwaScreen";
import { PwaSectionLabel, PwaStatTriplet } from "@/components/pwa/PwaDashboardPrimitives";
import { PwaStatusBadge } from "@/components/pwa/PwaStatusBadge";
import { PwaActionGrid } from "@/components/pwa/PwaActionGrid";
import { Progress } from "@/components/ui/progress";
import { useEventContext } from "@/contexts/EventContext";
import { useActiveStageId } from "@/contexts/StageContext";
import {
  ScanLine, Search,
  Clock, Plus, ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FoodIncidentDialog } from "@/components/pwa/alimentacao/FoodIncidentDialog";
import { AlimentacaoDuplicateAlert } from "@/components/pwa/alimentacao/AlimentacaoDuplicateAlert";
import { format } from "date-fns";
import { usePwaAudit } from "@/hooks/usePwaAudit";
import PwaLayout from "@/components/pwa/PwaLayout";
import { useTodayString } from "@/hooks/useTodayString";


interface OpenWindowState {
  id: string;
  mealName: string;
  label: string | null;
  windowStart: string;
  windowEnd: string;
  served: number;
}

export default function AlimentacaoHomePage() {
  const navigate = useNavigate();
  const { activeEventId } = useEventContext();
  const stageId = useActiveStageId();
  const today = useTodayString();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ consumosHoje: 0, janelasAbertas: 0, tiposRefeicao: 0, totalJanelas: 0 });
  const [openWindows, setOpenWindows] = useState<OpenWindowState[]>([]);
  const [incidentOpen, setIncidentOpen] = useState(false);

  usePwaAudit("alimentacao");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login", { replace: true }); return; }

      const { data: profile } = await supabase.from("profiles").select("active").eq("id", session.user.id).single();
      if (!profile?.active) { navigate("/pwa", { replace: true }); return; }

      const nowDate = new Date();

      let windowsQ = supabase.from("meal_windows").select("id, start_time, end_time, service_date, label, meal_type:meal_types(name)").eq("event_id", activeEventId).eq("service_date", today).order("start_time");
      if (stageId) windowsQ = windowsQ.eq("event_stage_id", stageId);

      let totalJanelasQ = supabase.from("meal_windows").select("id", { count: "exact", head: true }).eq("event_id", activeEventId).eq("service_date", today);
      if (stageId) totalJanelasQ = totalJanelasQ.eq("event_stage_id", stageId);

      let consumoQ = supabase.from("meal_consumptions").select("id, meal_windows!meal_window_id!inner(event_id, event_stage_id)", { count: "exact", head: true }).eq("meal_windows.event_id", activeEventId).gte("consumed_at", today + "T00:00:00");
      if (stageId) consumoQ = consumoQ.eq("meal_windows.event_stage_id", stageId);

      const [consumoRes, tiposRes, totalJanelasRes, windowsRes] = await Promise.all([
        consumoQ,
        supabase.from("meal_types").select("id", { count: "exact", head: true }).eq("event_id", activeEventId),
        totalJanelasQ,
        windowsQ,
      ]);

      const windows = (windowsRes.data as any[]) || [];
      const activeWindows = windows.filter((w) => {
        const start = new Date(`${w.service_date}T${w.start_time}`);
        const end = new Date(`${w.service_date}T${w.end_time}`);
        return nowDate >= start && nowDate <= end;
      });
      const janelasAbertas = activeWindows.length;

      const openList: OpenWindowState[] = await Promise.all(
        activeWindows.map(async (w) => {
          const [{ count: mcCount }, { count: vuCount }] = await Promise.all([
            supabase.from("meal_consumptions").select("id", { count: "exact", head: true }).eq("meal_window_id", w.id),
            supabase.from("service_voucher_uses").select("id", { count: "exact", head: true }).eq("service_kind", "meals").eq("context_id", w.id),
          ]);
          return {
            id: w.id,
            mealName: w.meal_type?.name || "Refeição",
            label: w.label,
            windowStart: `${w.service_date}T${w.start_time}`,
            windowEnd: `${w.service_date}T${w.end_time}`,
            served: (mcCount || 0) + (vuCount || 0),
          };
        })
      );

      setOpenWindows(openList);
      setKpis({
        consumosHoje: consumoRes.count || 0,
        janelasAbertas,
        tiposRefeicao: tiposRes.count || 0,
        totalJanelas: totalJanelasRes.count || 0,
      });
      setLoading(false);
    })();
  }, [navigate, activeEventId, stageId, today]);

  return (
    <PwaLayout onBack={() => navigate(-1)} moduleTitle="Alimentação">
      <AlimentacaoDuplicateAlert />

      {/* Aviso explícito quando o operador não tem etapa selecionada e os KPIs
          contam o evento inteiro (Fase 2 da auditoria de Dashboard/KPIs). */}
      {!stageId && !loading && (
        <div className="mx-3 mt-2 rounded-md border border-amber-300/60 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-950/20 p-2.5 text-[11px] text-amber-900 dark:text-amber-200">
          ⚠️ Sem etapa selecionada — KPIs abaixo somam o evento inteiro. Selecione uma etapa para ver só a operação da sua jornada.
        </div>
      )}

      <PwaStatTriplet
        loading={loading}
        items={[
          { label: "Refeições hoje", value: kpis.consumosHoje, tone: "module" },
          { label: "Janelas ativas", value: kpis.janelasAbertas, tone: "amber" },
          { label: "Janelas hoje", value: kpis.totalJanelas, tone: "blue" },
        ]}
      />

      <PwaContainer>
        {openWindows.map((ow) => (
          <div key={ow.id} className="op-card-elevated p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <PwaSectionLabel>Janela aberta</PwaSectionLabel>
              <PwaStatusBadge tone="ok" pulse>Aberta</PwaStatusBadge>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-foreground">{ow.mealName}</h3>
              {ow.label && <p className="text-xs text-muted-foreground">{ow.label}</p>}
              <p className="mt-1 text-sm font-medium text-foreground/80">
                {format(new Date(ow.windowStart), "HH:mm")} – {format(new Date(ow.windowEnd), "HH:mm")}
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span><span className="font-bold text-module">{ow.served}</span> servidas nesta janela</span>
                <span><span className="font-bold text-foreground">{kpis.consumosHoje}</span> no dia</span>
              </div>
              <Progress
                value={kpis.consumosHoje > 0 ? Math.min(100, Math.round((ow.served / kpis.consumosHoje) * 100)) : ow.served > 0 ? 100 : 0}
                className="h-2.5 bg-muted/40"
                indicatorClassName="bg-module"
              />
            </div>
            <Button className="op-btn-primary" onClick={() => navigate("/pwa/alimentacao/scan", { state: { windowId: ow.id } })}>
              <Plus className="h-5 w-5" />
              Registrar consumo
            </Button>
          </div>
        ))}

        <PwaActionGrid
          actions={[
            { label: "Scan QR", description: "Registrar consumo agora", icon: ScanLine, to: "/pwa/alimentacao/scan", featured: true },
            { label: "Buscar", icon: Search, to: "/pwa/alimentacao/buscar" },
            { label: "Janelas", icon: Clock, to: "/pwa/alimentacao/janelas" },
            { label: "Lista de Consumos", icon: ListChecks, to: "/pwa/alimentacao/consumos" },
          ]}
        />

        <FoodIncidentDialog open={incidentOpen} onOpenChange={setIncidentOpen} />
      </PwaContainer>
    </PwaLayout>
  );
}
