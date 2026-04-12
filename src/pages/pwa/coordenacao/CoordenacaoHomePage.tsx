import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppKPI } from "@/components/app/AppKPI";
import {
  ArrowLeft, Trophy, LogOut, Calendar, ClipboardList,
  Medal, BarChart3, Clock, CheckCircle,
} from "lucide-react";

export default function CoordenacaoHomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ partidasHoje: 0, emAndamento: 0, resultadosPendentes: 0, totalPartidas: 0 });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/pwa/login", { replace: true }); return; }

      const { data: profile } = await supabase.from("profiles").select("active").eq("id", session.user.id).single();
      if (!profile?.active) { navigate("/pwa", { replace: true }); return; }

      const today = new Date().toISOString().slice(0, 10);

      const [todayRes, andamentoRes, pendentesRes, totalRes] = await Promise.all([
        supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("match_date", today),
        supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("status", "em_andamento"),
        supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("status", "finalizada"),
        supabase.from("competition_matches").select("id", { count: "exact", head: true }),
      ]);

      setKpis({
        partidasHoje: todayRes.count || 0,
        emAndamento: andamentoRes.count || 0,
        resultadosPendentes: pendentesRes.count || 0,
        totalPartidas: totalRes.count || 0,
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
          <Trophy className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Coord. Técnica</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleSignOut}>
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <AppKPI label="Partidas hoje" value={kpis.partidasHoje} icon={Calendar} loading={loading} />
          <AppKPI label="Em andamento" value={kpis.emAndamento} icon={Clock} loading={loading} />
          <AppKPI label="Finalizadas" value={kpis.resultadosPendentes} icon={CheckCircle} loading={loading} />
          <AppKPI label="Total partidas" value={kpis.totalPartidas} icon={Trophy} loading={loading} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Agenda", icon: Calendar, to: "/pwa/coordenacao-tecnica/agenda", color: "text-primary" },
            { label: "Partidas", icon: ClipboardList, to: "/pwa/coordenacao-tecnica/partidas", color: "text-blue-600" },
            { label: "Resultados", icon: Medal, to: "/pwa/coordenacao-tecnica/resultados", color: "text-green-600" },
            { label: "Estatísticas", icon: BarChart3, to: "/pwa/coordenacao-tecnica/estatisticas", color: "text-amber-600" },
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
