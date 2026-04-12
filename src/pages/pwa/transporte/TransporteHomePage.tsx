import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AppKPI } from "@/components/app/AppKPI";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import {
  Bus, ScanLine, MapPin, Clock,
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

  const actions = [
    { label: "Scan QR", icon: ScanLine, to: "/pwa/transporte/scan" },
    { label: "Viagens", icon: Clock, to: "/pwa/transporte/viagens" },
    { label: "Embarque", icon: CheckCircle, to: "/pwa/transporte/embarque" },
    { label: "Rotas", icon: MapPin, to: "/pwa/transporte/rotas" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader title="Transporte" icon={Bus} backTo="/pwa" onSignOut={handleSignOut} />

      <main className="p-4 max-w-md mx-auto space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <AppKPI label="Viagens hoje" value={kpis.viagensHoje} icon={Clock} loading={loading} />
          <AppKPI label="Embarcados" value={kpis.embarcados} icon={Users} loading={loading} />
          <AppKPI label="Veículos ativos" value={kpis.veiculos} icon={Bus} loading={loading} />
          <AppKPI label="Rotas" value={kpis.rotas} icon={Route} loading={loading} />
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
