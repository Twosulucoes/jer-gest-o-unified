import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppKPI } from "@/components/app/AppKPI";
import {
  ArrowLeft, Bus, LogOut, ScanLine, MapPin, Clock,
  Users, CheckCircle, Route,
} from "lucide-react";

export default function TransporteHomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ viagensHoje: 0, embarcados: 0, veiculos: 0, rotas: 0 });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/pwa/login", { replace: true }); return; }

      const { data: profile } = await supabase.from("profiles").select("active").eq("id", session.user.id).single();
      if (!profile?.active) { navigate("/pwa", { replace: true }); return; }

      const today = new Date().toISOString().slice(0, 10);

      const [tripsRes, vehiclesRes, routesRes] = await Promise.all([
        supabase.from("trips" as any).select("id", { count: "exact", head: true }).gte("departure_time", today + "T00:00:00"),
        supabase.from("vehicles" as any).select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("routes" as any).select("id", { count: "exact", head: true }),
      ]);

      setKpis({
        viagensHoje: tripsRes.count || 0,
        embarcados: 0,
        veiculos: vehiclesRes.count || 0,
        rotas: routesRes.count || 0,
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
          <Bus className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Transporte</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleSignOut}>
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <AppKPI label="Viagens hoje" value={kpis.viagensHoje} icon={Clock} loading={loading} />
          <AppKPI label="Embarcados" value={kpis.embarcados} icon={Users} loading={loading} />
          <AppKPI label="Veículos ativos" value={kpis.veiculos} icon={Bus} loading={loading} />
          <AppKPI label="Rotas" value={kpis.rotas} icon={Route} loading={loading} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Scan QR", icon: ScanLine, to: "/pwa/transporte/scan", color: "text-primary" },
            { label: "Viagens", icon: Clock, to: "/pwa/transporte/viagens", color: "text-blue-600" },
            { label: "Embarque", icon: CheckCircle, to: "/pwa/transporte/embarque", color: "text-green-600" },
            { label: "Rotas", icon: MapPin, to: "/pwa/transporte/rotas", color: "text-amber-600" },
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
