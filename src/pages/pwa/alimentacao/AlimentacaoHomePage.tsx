import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppKPI } from "@/components/app/AppKPI";
import {
  ArrowLeft, UtensilsCrossed, LogOut, ScanLine, Search,
  Clock, CheckCircle, BarChart3,
} from "lucide-react";

export default function AlimentacaoHomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ consumosHoje: 0, janelasAbertas: 0, tiposRefeicao: 0, totalJanelas: 0 });

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

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 h-14">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/pwa")} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <UtensilsCrossed className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Alimentação</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleSignOut}>
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <AppKPI label="Consumos hoje" value={kpis.consumosHoje} icon={CheckCircle} loading={loading} />
          <AppKPI label="Janelas abertas" value={kpis.janelasAbertas} icon={Clock} loading={loading} />
          <AppKPI label="Tipos refeição" value={kpis.tiposRefeicao} icon={UtensilsCrossed} loading={loading} />
          <AppKPI label="Janelas hoje" value={kpis.totalJanelas} icon={BarChart3} loading={loading} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Scan QR", icon: ScanLine, to: "/pwa/alimentacao/scan", color: "text-primary" },
            { label: "Buscar", icon: Search, to: "/pwa/alimentacao/buscar", color: "text-blue-600" },
            { label: "Janelas", icon: Clock, to: "/pwa/alimentacao/janelas", color: "text-green-600" },
            { label: "Histórico", icon: BarChart3, to: "/pwa/alimentacao/historico", color: "text-amber-600" },
          ].map((action) => (
            <Card key={action.label} className="cursor-pointer hover:bg-accent/50 active:scale-[0.98] transition-all" onClick={() => navigate(action.to)}>
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <action.icon className={`h-8 w-8 ${action.color}`} />
                <span className="text-sm font-medium">{action.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
