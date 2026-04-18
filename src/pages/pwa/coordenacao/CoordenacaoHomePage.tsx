import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AppKPI } from "@/components/app/AppKPI";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import {
  Trophy, Calendar, ClipboardList,
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

  const actions = [
    { label: "Agenda", icon: Calendar, to: "/pwa/coordenacao-tecnica/agenda" },
    { label: "Partidas", icon: ClipboardList, to: "/pwa/coordenacao-tecnica/partidas" },
    { label: "Resultados", icon: Medal, to: "/pwa/coordenacao-tecnica/resultados" },
    { label: "Estatísticas", icon: BarChart3, to: "/pwa/coordenacao-tecnica/estatisticas" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader title="Coord. Técnica" icon={Trophy} backTo="/pwa" onSignOut={handleSignOut} />

      <main className="p-4 max-w-md mx-auto space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <AppKPI label="Partidas hoje" value={kpis.partidasHoje} icon={Calendar} loading={loading} />
          <AppKPI label="Em andamento" value={kpis.emAndamento} icon={Clock} loading={loading} />
          <AppKPI label="Finalizadas" value={kpis.resultadosPendentes} icon={CheckCircle} loading={loading} />
          <AppKPI label="Total partidas" value={kpis.totalPartidas} icon={Trophy} loading={loading} />
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
    </div>
  );
}
