import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AppKPI } from "@/components/app/AppKPI";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import {
  UtensilsCrossed, ScanLine, Search,
  Clock, CheckCircle, BarChart3, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FoodIncidentDialog } from "@/components/pwa/alimentacao/FoodIncidentDialog";

export default function AlimentacaoHomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ consumosHoje: 0, janelasAbertas: 0, tiposRefeicao: 0, totalJanelas: 0 });
  const [incidentOpen, setIncidentOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/pwa/login", { replace: true }); return; }

      const { data: profile } = await supabase.from("profiles").select("active").eq("id", session.user.id).single();
      if (!profile?.active) { navigate("/pwa", { replace: true }); return; }

      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();

      const [consumoRes, janelasAbertasRes, tiposRes, totalJanelasRes] = await Promise.all([
        supabase.from("meal_consumptions").select("id", { count: "exact", head: true }).gte("consumed_at", today + "T00:00:00"),
        supabase.from("meal_windows").select("id", { count: "exact", head: true }).lte("window_start", now).gte("window_end", now),
        supabase.from("meal_types").select("id", { count: "exact", head: true }),
        supabase.from("meal_windows").select("id", { count: "exact", head: true }).gte("window_start", today + "T00:00:00"),
      ]);

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

  const actions = [
    { label: "Scan QR", icon: ScanLine, to: "/pwa/alimentacao/scan" },
    { label: "Buscar", icon: Search, to: "/pwa/alimentacao/buscar" },
    { label: "Janelas", icon: Clock, to: "/pwa/alimentacao/janelas" },
    { label: "Histórico", icon: BarChart3, to: "/pwa/alimentacao/historico" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader title="Alimentação" icon={UtensilsCrossed} backTo="/pwa" onSignOut={handleSignOut}>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIncidentOpen(true)}>
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="hidden sm:inline">Ocorrência</span>
        </Button>
      </PwaHeader>

      <main className="p-4 max-w-md mx-auto space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <AppKPI label="Consumos hoje" value={kpis.consumosHoje} icon={CheckCircle} loading={loading} />
          <AppKPI label="Janelas abertas" value={kpis.janelasAbertas} icon={Clock} loading={loading} />
          <AppKPI label="Tipos refeição" value={kpis.tiposRefeicao} icon={UtensilsCrossed} loading={loading} />
          <AppKPI label="Janelas hoje" value={kpis.totalJanelas} icon={BarChart3} loading={loading} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Card key={action.label} className="cursor-pointer hover:shadow-app-md active:scale-[0.98] transition-all" onClick={() => navigate(action.to)}>
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
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