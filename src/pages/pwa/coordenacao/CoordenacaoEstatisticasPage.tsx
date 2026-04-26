import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { PwaRefreshButton } from "@/components/pwa/PwaRefreshButton";

export default function CoordenacaoEstatisticasPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, agendadas: 0, emAndamento: 0, finalizadas: 0, canceladas: 0 });

  useEffect(() => {
    (async () => {
      const [totalRes, agendRes, andRes, finRes, canRes] = await Promise.all([
        supabase.from("competition_matches").select("id", { count: "exact", head: true }),
        supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("status", "agendada"),
        supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("status", "em_andamento"),
        supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("status", "finalizada"),
        supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("status", "cancelada"),
      ]);
      setStats({
        total: totalRes.count || 0,
        agendadas: agendRes.count || 0,
        emAndamento: andRes.count || 0,
        finalizadas: finRes.count || 0,
        canceladas: canRes.count || 0,
      });
      setLoading(false);
    })();
  }, []);

  const items = [
    { label: "Total de partidas", value: stats.total, color: "text-foreground" },
    { label: "Agendadas", value: stats.agendadas, color: "text-blue-600" },
    { label: "Em andamento", value: stats.emAndamento, color: "text-green-600" },
    { label: "Finalizadas", value: stats.finalizadas, color: "text-muted-foreground" },
    { label: "Canceladas", value: stats.canceladas, color: "text-destructive" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button onClick={() => navigate("/pwa/coordenacao-tecnica")} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <BarChart3 className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Estatísticas</span>
        <div className="ml-auto"><PwaRefreshButton /></div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-3">
        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}

        {!loading && items.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4 flex items-center justify-between">
              <span className="text-sm font-medium">{item.label}</span>
              <span className={`text-2xl font-bold ${item.color}`}>{item.value}</span>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
