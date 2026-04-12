import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppKPI } from "@/components/app/AppKPI";
import {
  ArrowLeft, Users, LogOut, UserCheck, Calendar, MapPin,
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

      const { data: profile } = await supabase.from("profiles").select("active, institution_id").eq("id", session.user.id).single();
      if (!profile?.active) { navigate("/pwa", { replace: true }); return; }

      // Find delegation for user's institution
      if (profile.institution_id) {
        const { data: del } = await supabase
          .from("delegations")
          .select("id")
          .eq("institution_id", profile.institution_id)
          .eq("status", "ativa")
          .limit(1)
          .single();

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
      }
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
          <Users className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Delegação</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleSignOut}>
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        {!delegationId && !loading && (
          <Card className="border-amber-500/50">
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
          {[
            { label: "Participantes", icon: ClipboardList, to: "/pwa/delegacao/participantes", color: "text-primary" },
            { label: "Agenda", icon: Calendar, to: "/pwa/delegacao/agenda", color: "text-blue-600" },
            { label: "Logística", icon: Bus, to: "/pwa/delegacao/logistica", color: "text-green-600" },
            { label: "Locais", icon: MapPin, to: "/pwa/delegacao/locais", color: "text-amber-600" },
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
