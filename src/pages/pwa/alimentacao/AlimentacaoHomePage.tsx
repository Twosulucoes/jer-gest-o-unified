import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AppKPI } from "@/components/app/AppKPI";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { PwaSectionLabel, PwaStatTriplet } from "@/components/pwa/PwaDashboardPrimitives";
import { Progress } from "@/components/ui/progress";
import { useEventContext } from "@/contexts/EventContext";
import {
  UtensilsCrossed, ScanLine, Search,
  Clock, CheckCircle, BarChart3, AlertTriangle, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const { activeEvent } = useEventContext();
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
        supabase.from("meal_consumptions").select("id", { count: "exact", head: true }).gte("consumed_at", today + "T00:00:00"),
        supabase.from("meal_windows").select("id", { count: "exact", head: true }).lte("window_start", now).gte("window_end", now),
        supabase.from("meal_types").select("id", { count: "exact", head: true }),
        supabase.from("meal_windows").select("id", { count: "exact", head: true }).gte("window_start", today + "T00:00:00"),
        supabase
          .from("meal_windows")
          .select("id, window_start, window_end, label, meal_type:meal_types(name)")
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
          .select("id", { count: "exact", head: true })
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

  const eventSubtitle = activeEvent?.name
    ? `${activeEvent.name}${activeEvent.year ? ` — ${activeEvent.year}` : ""}`
    : null;

  const actions = [
    { label: "Scan QR", icon: ScanLine, to: "/pwa/alimentacao/scan" },
    { label: "Buscar", icon: Search, to: "/pwa/alimentacao/buscar" },
    { label: "Janelas", icon: Clock, to: "/pwa/alimentacao/janelas" },
    { label: "Histórico", icon: BarChart3, to: "/pwa/alimentacao/historico" },
    { label: "Lista de Consumos", icon: UtensilsCrossed, to: "/pwa/alimentacao/lista-consumos" },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
      <PwaHeader
        title="Alimentação"
        icon={UtensilsCrossed}
        backTo="/pwa"
        onSignOut={handleSignOut}
        rightSlot={
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => setIncidentOpen(true)}>
            <AlertTriangle className="h-5 w-5" />
          </Button>
        }
      />

      <main className="relative max-w-md mx-auto space-y-4 p-4">
        {eventSubtitle && <p className="text-center text-xs text-muted-foreground">{eventSubtitle}</p>}
        <AlimentacaoDuplicateAlert />

        <PwaStatTriplet
          loading={loading}
          items={[
            { label: "Refeições hoje", value: kpis.consumosHoje, tone: "green" },
            { label: "Janelas ativas", value: kpis.janelasAbertas, tone: "amber" },
            { label: "Janelas hoje", value: kpis.totalJanelas, tone: "blue" },
          ]}
        />

        {openWindow && (
          <Card className="border-border/80 bg-card/95 shadow-app-md">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <PwaSectionLabel>Janela atual</PwaSectionLabel>
                <Badge className="rounded-full border-0 bg-green-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-green-700 dark:text-green-400">
                  Aberta
                </Badge>
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{openWindow.mealName}</h3>
                {openWindow.label && <p className="text-xs text-muted-foreground">{openWindow.label}</p>}
                <p className="mt-1 text-sm text-muted-foreground">
                  {format(new Date(openWindow.windowStart), "HH:mm")} – {format(new Date(openWindow.windowEnd), "HH:mm")}
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>
                    <span className="font-semibold text-foreground">{openWindow.served}</span> nesta janela
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">{kpis.consumosHoje}</span> no dia
                  </span>
                </div>
                <Progress
                  value={
                    kpis.consumosHoje > 0
                      ? Math.min(100, Math.round((openWindow.served / kpis.consumosHoje) * 100))
                      : openWindow.served > 0
                        ? 100
                        : 0
                  }
                  className="h-2.5 bg-muted"
                  indicatorClassName="bg-green-500"
                />
              </div>
              <Button className="h-12 w-full rounded-xl font-semibold" variant="module" onClick={() => navigate("/pwa/alimentacao/scan")}>
                <Plus className="mr-2 h-5 w-5" />
                Registrar consumo
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          <AppKPI label="Tipos refeição" value={kpis.tiposRefeicao} icon={UtensilsCrossed} loading={loading} />
          <AppKPI label="Detalhe janelas" value={kpis.totalJanelas} icon={BarChart3} loading={loading} sub="Cadastradas hoje" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Card key={action.label} className="cursor-pointer border-border/80 bg-card/95 hover:shadow-app-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all" onClick={() => navigate(action.to)}>
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--module-accent)/0.14)] text-[hsl(var(--module-accent))] shadow-app-sm">
                  <action.icon className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium">{action.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <FoodIncidentDialog open={incidentOpen} onOpenChange={setIncidentOpen} />
    </div>
  );
}