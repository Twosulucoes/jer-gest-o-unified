import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AppKPI } from "@/components/app/AppKPI";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { PwaStatTriplet } from "@/components/pwa/PwaDashboardPrimitives";
import {
  Users, UserCheck, Calendar, MapPin,
  ClipboardList, Trophy, Bus, Gavel, ChevronRight, AlertTriangle,
} from "lucide-react";

export default function DelegacaoHomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [delegationId, setDelegationId] = useState<string | null>(null);
  const [delegationLabel, setDelegationLabel] = useState<string>("");
  const [kpis, setKpis] = useState({
    participantes: 0,
    atletas: 0,
    comissao: 0,
    partidasHoje: 0,
    credenciados: 0,
    pendentesCred: 0,
  });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/pwa/login", { replace: true }); return; }

      const { data: profile } = await supabase.from("profiles").select("active").eq("id", session.user.id).single();
      if (!(profile as any)?.active) { navigate("/pwa", { replace: true }); return; }

      const { data: userDelegation } = await supabase
        .from("user_delegations")
        .select("delegation_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userDelegation) {
        setLoading(false);
        return;
      }

      const delId = userDelegation.delegation_id;
      setDelegationId(delId);

      const { data: delRow } = await supabase
        .from("delegations")
        .select("school_name, chief_name")
        .eq("id", delId)
        .maybeSingle();

      if (delRow) {
        const chief = delRow.chief_name ? ` — Chefe: ${delRow.chief_name}` : "";
        setDelegationLabel(`Del. ${delRow.school_name ?? "Delegação"}${chief}`);
      }

      const [partRes, atletasRes, comissaoRes, credRes, pendRes] = await Promise.all([
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("delegation_id", delId),
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("delegation_id", delId).eq("participant_type", "athlete"),
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("delegation_id", delId).in("participant_type", ["coach", "head_of_delegation", "official", "staff"]),
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("delegation_id", delId).eq("participant_type", "athlete").eq("status", "confirmed"),
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("delegation_id", delId).eq("participant_type", "athlete").eq("status", "pending"),
      ]);

      setKpis({
        participantes: partRes.count || 0,
        atletas: atletasRes.count || 0,
        comissao: comissaoRes.count || 0,
        partidasHoje: 0,
        credenciados: credRes.count || 0,
        pendentesCred: pendRes.count || 0,
      });

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
    { label: "Protestos", icon: Gavel, to: "/pwa/delegacao/protestos" },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
      <PwaHeader title="Minha Delegação" icon={Users} backTo="/pwa" onSignOut={handleSignOut} />

      <main className="relative max-w-md mx-auto space-y-4 p-4">
        {!delegationId && !loading && (
          <Card className="border-warning/50">
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              Nenhuma delegação vinculada ao seu perfil
            </CardContent>
          </Card>
        )}

        {delegationId && delegationLabel && (
          <p className="text-center text-xs text-muted-foreground">{delegationLabel}</p>
        )}

        {delegationId && (
          <PwaStatTriplet
            loading={loading}
            items={[
              { label: "Atletas", value: kpis.atletas, tone: "amber" },
              { label: "Credenciados", value: kpis.credenciados, tone: "green" },
              { label: "Pendentes", value: kpis.pendentesCred, tone: "red" },
            ]}
          />
        )}

        {delegationId && kpis.pendentesCred > 0 && (
          <button
            type="button"
            onClick={() => navigate("/pwa/delegacao/participantes")}
            className="flex w-full items-center gap-3 rounded-2xl border border-red-500/35 bg-red-500/10 p-4 text-left transition-colors hover:bg-red-500/15"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                {kpis.pendentesCred} pendência{kpis.pendentesCred > 1 ? "s" : ""} de credencial
              </p>
              <p className="text-xs text-muted-foreground">Documento ausente ou inválido</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <AppKPI label="Participantes" value={kpis.participantes} icon={Users} loading={loading} />
          <AppKPI label="Comissão" value={kpis.comissao} icon={UserCheck} loading={loading} />
          <AppKPI label="Jogos hoje" value={kpis.partidasHoje} icon={Calendar} loading={loading} />
          <AppKPI label="Total atletas" value={kpis.atletas} icon={Trophy} loading={loading} />
        </div>

        {delegationId && (
          <div className="grid grid-cols-2 gap-3">
            {actions.map((action) => (
              <Card key={action.label} className="cursor-pointer border-border/80 bg-card/95 transition-all hover:-translate-y-0.5 hover:shadow-app-lg active:scale-[0.98]" onClick={() => navigate(action.to)}>
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--module-accent)/0.14)] text-[hsl(var(--module-accent))] shadow-app-sm">
                    <action.icon className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
