import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AppKPI } from "@/components/app/AppKPI";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import {
  Users, UserCheck, Calendar, MapPin,
  ClipboardList, Trophy, Bus,
} from "lucide-react";

export default function DelegacaoHomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [delegationId, setDelegationId] = useState<string | null>(null);
  const [kpis, setKpis] = useState({ participantes: 0, atletas: 0, comissao: 0, partidasHoje: 0 });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/pwa/login", { replace: true }); return; }

      const { data: profile } = await supabase.from("profiles").select("active").eq("id", session.user.id).single();
      if (!(profile as any)?.active) { navigate("/pwa", { replace: true }); return; }

      await supabase.from("user_roles").select("role").eq("user_id", session.user.id);

      const { data: delegations } = await supabase
        .from("delegations")
        .select("id")
        .eq("status", "ativa")
        .limit(1);

      const del = delegations?.[0];
      if (del) {
        setDelegationId(del.id);

        const [partRes, atletasRes, comissaoRes] = await Promise.all([
          supabase.from("participants").select("id", { count: "exact", head: true }).eq("delegation_id", del.id),
          supabase.from("participants").select("id", { count: "exact", head: true }).eq("delegation_id", del.id).eq("participant_type", "atleta"),
          supabase.from("participants").select("id", { count: "exact", head: true }).eq("delegation_id", del.id).in("participant_type", ["tecnico", "dirigente", "apoio"]),
        ]);

        setKpis({
          participantes: partRes.count || 0,
          atletas: atletasRes.count || 0,
          comissao: comissaoRes.count || 0,
          partidasHoje: 0,
        });
      }
      setLoading(false);
    })();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/pwa/login", { replace: true });
  };

  const actions = [
    { label: "Participantes", icon: ClipboardList, to: "/pwa/delegacao/participantes" },
    { label: "Agenda", icon: Calendar, to: "/pwa/delegacao/agenda" },
    { label: "Logística", icon: Bus, to: "/pwa/delegacao/logistica" },
    { label: "Locais", icon: MapPin, to: "/pwa/delegacao/locais" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader title="Delegação" icon={Users} backTo="/pwa" onSignOut={handleSignOut} />

      <main className="p-4 max-w-md mx-auto space-y-4">
        {!delegationId && !loading && (
          <Card className="border-warning/50">
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              Nenhuma delegação vinculada ao seu perfil
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          <AppKPI label="Participantes" value={kpis.participantes} icon={Users} loading={loading} />
          <AppKPI label="Atletas" value={kpis.atletas} icon={Trophy} loading={loading} />
          <AppKPI label="Comissão" value={kpis.comissao} icon={UserCheck} loading={loading} />
          <AppKPI label="Jogos hoje" value={kpis.partidasHoje} icon={Calendar} loading={loading} />
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
