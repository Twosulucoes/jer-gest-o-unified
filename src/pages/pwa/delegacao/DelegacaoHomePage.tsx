import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { PwaContainer } from "@/components/pwa/PwaScreen";
import { PwaStatTriplet } from "@/components/pwa/PwaDashboardPrimitives";
import { PwaListItem, PwaListAvatar } from "@/components/pwa/PwaListItem";
import { PwaActionGrid } from "@/components/pwa/PwaActionGrid";
import { useEventContext } from "@/contexts/EventContext";
import {
  Users, Calendar, MapPin,
  ClipboardList, Bus, Gavel, ChevronRight, AlertTriangle,
} from "lucide-react";

interface AthleteRow {
  id: string;
  full_name: string | null;
  status: string | null;
  participant_type: string | null;
  meta?: any;
}

export default function DelegacaoHomePage() {
  const navigate = useNavigate();
  const { activeEvent } = useEventContext();
  const [loading, setLoading] = useState(true);
  const [delegationId, setDelegationId] = useState<string | null>(null);
  const [delegationLabel, setDelegationLabel] = useState<string>("");
  const [delegationName, setDelegationName] = useState<string>("");
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [kpis, setKpis] = useState({
    atletas: 0,
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

      if (!userDelegation) { setLoading(false); return; }

      const delId = userDelegation.delegation_id;
      setDelegationId(delId);

      const { data: delRow } = await supabase
        .from("delegations")
        .select("school_name, chief_name")
        .eq("id", delId)
        .maybeSingle();

      if (delRow) {
        setDelegationName(`Del. ${delRow.school_name ?? "Delegação"}`);
        const chief = delRow.chief_name ? ` — Chefe: ${delRow.chief_name}` : "";
        setDelegationLabel(`${delRow.school_name ?? "Delegação"}${chief}`);
      }

      const [atletasRes, credRes, pendRes, listRes] = await Promise.all([
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("delegation_id", delId).eq("participant_type", "athlete"),
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("delegation_id", delId).eq("participant_type", "athlete").eq("status", "confirmed"),
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("delegation_id", delId).eq("participant_type", "athlete").eq("status", "pending"),
        supabase.from("participants").select("id, full_name, status, participant_type").eq("delegation_id", delId).eq("participant_type", "athlete").order("full_name").limit(8),
      ]);

      setKpis({
        atletas: atletasRes.count || 0,
        credenciados: credRes.count || 0,
        pendentesCred: pendRes.count || 0,
      });
      setAthletes((listRes.data as any) || []);
      setLoading(false);
    })();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/pwa/login", { replace: true });
  };

  const initials = (name: string | null) => (name || "?").split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <div className="op-screen">
      <PwaHeader title={delegationName || "Minha Delegação"} icon={Users} backTo="/pwa" onSignOut={handleSignOut} />

      <PwaContainer>
        {!delegationId && !loading && (
          <div className="op-card border-amber/40 p-4 text-center text-sm text-muted-foreground">
            Nenhuma delegação vinculada ao seu perfil
          </div>
        )}

        {delegationId && delegationLabel && (
          <p className="text-center text-[11px] uppercase tracking-widest text-muted-foreground">{delegationLabel}</p>
        )}

        {delegationId && (
          <PwaStatTriplet
            loading={loading}
            items={[
              { label: "Atletas", value: kpis.atletas, tone: "module" },
              { label: "Credenciados", value: kpis.credenciados, tone: "green" },
              { label: "Pendentes", value: kpis.pendentesCred, tone: "red" },
            ]}
          />
        )}

        {delegationId && kpis.pendentesCred > 0 && (
          <button
            type="button"
            onClick={() => navigate("/pwa/delegacao/participantes")}
            className="op-card flex w-full items-center gap-3 border-destructive/40 bg-destructive/10 p-4 text-left transition-colors hover:bg-destructive/15"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-destructive">
                {kpis.pendentesCred} pendência{kpis.pendentesCred > 1 ? "s" : ""} de credencial
              </p>
              <p className="text-xs text-muted-foreground">Documento ausente ou inválido</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </button>
        )}

        {delegationId && athletes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="op-label">Atletas</span>
              <button onClick={() => navigate("/pwa/delegacao/participantes")} className="text-[11px] font-semibold text-module hover:underline">
                Ver todos
              </button>
            </div>
            <div className="space-y-2">
              {athletes.map((a) => (
                <PwaListItem
                  key={a.id}
                  leading={<PwaListAvatar initials={initials(a.full_name)} />}
                  title={a.full_name || "Sem nome"}
                  subtitle="Atleta"
                  status={{
                    label: a.status === "confirmed" ? "OK" : a.status === "pending" ? "Pendente" : (a.status || "—"),
                    tone: a.status === "confirmed" ? "ok" : a.status === "pending" ? "pending" : "neutral",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {delegationId && (
          <PwaActionGrid
            actions={[
              { label: "Participantes", icon: ClipboardList, to: "/pwa/delegacao/participantes" },
              { label: "Agenda", icon: Calendar, to: "/pwa/delegacao/agenda" },
              { label: "Logística", icon: Bus, to: "/pwa/delegacao/logistica" },
              { label: "Locais", icon: MapPin, to: "/pwa/delegacao/locais" },
              { label: "Protestos", icon: Gavel, to: "/pwa/delegacao/protestos" },
            ]}
          />
        )}
      </PwaContainer>
    </div>
  );
}
