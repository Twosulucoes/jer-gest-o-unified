import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { PwaContainer } from "@/components/pwa/PwaScreen";
import { PwaSectionLabel, PwaStatTriplet } from "@/components/pwa/PwaDashboardPrimitives";
import { PwaStatusBadge } from "@/components/pwa/PwaStatusBadge";
import { PwaActionGrid } from "@/components/pwa/PwaActionGrid";
import { Progress } from "@/components/ui/progress";
import { useEventContext } from "@/contexts/EventContext";
import {
  UtensilsCrossed, ScanLine, Search,
  Clock, BarChart3, AlertTriangle, Plus, ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FoodIncidentDialog } from "@/components/pwa/alimentacao/FoodIncidentDialog";
import { AlimentacaoDuplicateAlert } from "@/components/pwa/alimentacao/AlimentacaoDuplicateAlert";
import { format } from "date-fns";

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
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ consumosHoje: 0, janelasAbertas: 0, tiposRefeicao: 0, totalJanelas: 0 });
  const [openWindow, setOpenWindow] = useState<OpenWindowState | null>(null);
  const [incidentOpen, setIncidentOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/pwa/login", { replace: true }); return; }

      const { data: profile } = await supabase.from("profiles").select("active").eq("id", session.user.id).single();
      if (!profile?.active) { navigate("/pwa", { replace: true }); return; }

      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();

      const [consumoRes, janelasAbertasRes, tiposRes, totalJanelasRes, windowsRes] = await Promise.all([
        supabase.from("meal_consumptions").select("id", { count: "exact", head: true }).innerJoin("meal_windows", "meal_window_id", "id").eq("meal_windows.event_id", activeEventId).gte("consumed_at", today + "T00:00:00"),
        supabase.from("meal_windows").select("id", { count: "exact", head: true }).eq("event_id", activeEventId).lte("window_start", now).gte("window_end", now),
        supabase.from("meal_types").select("id", { count: "exact", head: true }).eq("event_id", activeEventId),
        supabase.from("meal_windows").select("id", { count: "exact", head: true }).eq("event_id", activeEventId).gte("window_start", today + "T00:00:00"),
        supabase
          .from("meal_windows")
          .select("id, window_start, window_end, label, meal_type:meal_types(name)")
          .eq("event_id", activeEventId)
          .gte("window_start", today + "T00:00:00")
          .order("window_start"),
      ]);

      const windows = (windowsRes.data as any[]) || [];
      const nowDate = new Date();
      const active = windows.find((w) => {
        const start = new Date(w.window_start);
        const end = new Date(w.window_end);
        return nowDate >= start && nowDate <= end;
      });

      let open: OpenWindowState | null = null;
      if (active) {
        const { count } = await supabase
          .from("meal_consumptions")
          .select("id, { count: 'exact', head: true }")
          .eq("meal_window_id", active.id)
          .gte("consumed_at", today + "T00:00:00");
        open = {
          id: active.id,
          mealName: active.meal_type?.name || "Refeição",
          label: active.label,
          windowStart: active.window_start,
          windowEnd: active.window_end,
          served: count || 0,
        };
      }

      setOpenWindow(open);
      setKpis({
        consumosHoje: consumoRes.count || 0,
        janelasAbertas: janelasAbertasRes.count || 0,
        tiposRefeicao: tiposRes.count || 0,
        totalJanelas: totalJanelasRes.count || 0,
      });
      setLoading(false);
    })();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/pwa/login", { replace: true });
  };

  const eventSubtitle = undefined;

  return (
    <div className="op-screen">
      <PwaHeader
        title="Alimentação"
        subtitle={eventSubtitle}
        icon={UtensilsCrossed}
        backTo="/pwa"
        onSignOut={handleSignOut}
        rightSlot={
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-muted/40 hover:text-foreground" onClick={() => setIncidentOpen(true)}>
            <AlertTriangle className="h-5 w-5" />
          </Button>
        }
      />

      <PwaContainer>
        <AlimentacaoDuplicateAlert />

        <PwaStatTriplet
          loading={loading}
          items={[
            { label: "Refeições hoje", value: kpis.consumosHoje, tone: "module" },
            { label: "Janelas ativas", value: kpis.janelasAbertas, tone: "amber" },
            { label: "Janelas hoje", value: kpis.totalJanelas, tone: "blue" },
          ]}
        />

        {openWindow && (
          <div className="op-card-elevated p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <PwaSectionLabel>Janela atual</PwaSectionLabel>
              <PwaStatusBadge tone="ok" pulse>Aberta</PwaStatusBadge>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-foreground">{openWindow.mealName}</h3>
              {openWindow.label && <p className="text-xs text-muted-foreground">{openWindow.label}</p>}
              <p className="mt-1 text-sm font-medium text-foreground/80">
                {format(new Date(openWindow.windowStart), "HH:mm")} – {format(new Date(openWindow.windowEnd), "HH:mm")}
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span><span className="font-bold text-module">{openWindow.served}</span> servidas nesta janela</span>
                <span><span className="font-bold text-foreground">{kpis.consumosHoje}</span> no dia</span>
              </div>
              <Progress
                value={
                  kpis.consumosHoje > 0
                    ? Math.min(100, Math.round((openWindow.served / kpis.consumosHoje) * 100))
                    : openWindow.served > 0 ? 100 : 0
                }
                className="h-2.5 bg-muted/40"
                indicatorClassName="bg-module"
              />
            </div>
            <Button className="op-btn-primary" onClick={() => navigate("/pwa/alimentacao/scan")}>
              <Plus className="h-5 w-5" />
              Registrar consumo
            </Button>
          </div>
        )}

        <PwaActionGrid
          actions={[
            { label: "Scan QR", icon: ScanLine, to: "/pwa/alimentacao/scan" },
            { label: "Buscar", icon: Search, to: "/pwa/alimentacao/buscar" },
            { label: "Janelas", icon: Clock, to: "/pwa/alimentacao/janelas" },
            { label: "Histórico", icon: BarChart3, to: "/pwa/alimentacao/historico" },
            { label: "Lista de Consumos", icon: ListChecks, to: "/pwa/alimentacao/lista-consumos" },
          ]}
        />
      </PwaContainer>

      <FoodIncidentDialog open={incidentOpen} onOpenChange={setIncidentOpen} />
    </div>
  );
}
