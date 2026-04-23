import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { PwaContainer } from "@/components/pwa/PwaScreen";
import { PwaStatTriplet } from "@/components/pwa/PwaDashboardPrimitives";
import { PwaListItem } from "@/components/pwa/PwaListItem";
import { PwaActionGrid } from "@/components/pwa/PwaActionGrid";
import { useEventContext } from "@/contexts/EventContext";
import {
  Trophy, Calendar, ClipboardList,
  Medal, BarChart3, Search, AlertTriangle, AlertOctagon,
} from "lucide-react";
import { format } from "date-fns";

interface MatchRow {
  id: string;
  match_date: string | null;
  start_time: string | null;
  status: string;
  sport_event_id: string | null;
  venue_id: string | null;
  venue?: { name: string } | null;
}

export default function CoordenacaoHomePage() {
  const navigate = useNavigate();
  const { activeEvent } = useEventContext();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ partidasHoje: 0, emAndamento: 0, finalizadas: 0, totalPartidas: 0 });
  const [agenda, setAgenda] = useState<MatchRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/pwa/login", { replace: true }); return; }

      const { data: profile } = await supabase.from("profiles").select("active").eq("id", session.user.id).single();
      if (!profile?.active) { navigate("/pwa", { replace: true }); return; }

      const today = new Date().toISOString().slice(0, 10);

      const [todayRes, andamentoRes, pendentesRes, totalRes, agendaRes] = await Promise.all([
        supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("match_date", today),
        supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("status", "em_andamento"),
        supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("status", "finalizada"),
        supabase.from("competition_matches").select("id", { count: "exact", head: true }),
        supabase
          .from("competition_matches")
          .select("id, match_date, start_time, status, sport_event_id, venue_id, venue:venues(name)")
          .eq("match_date", today)
          .order("start_time", { ascending: true })
          .limit(8),
      ]);

      setKpis({
        partidasHoje: todayRes.count || 0,
        emAndamento: andamentoRes.count || 0,
        finalizadas: pendentesRes.count || 0,
        totalPartidas: totalRes.count || 0,
      });
      setAgenda((agendaRes.data as any) || []);
      setLoading(false);
    })();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/pwa/login", { replace: true });
  };

  const eventSubtitle = "Painel técnico operacional";

  const statusTone = (s: string) => {
    if (s === "em_andamento") return "live";
    if (s === "finalizada") return "ok";
    if (s === "scheduled") return "scheduled";
    return "neutral";
  };
  const statusLabel = (s: string) => {
    if (s === "em_andamento") return "Em curso";
    if (s === "finalizada") return "Concluído";
    if (s === "scheduled") return "Próximo";
    return s;
  };

  return (
    <div className="op-screen">
      <PwaHeader title="Coordenação" subtitle={eventSubtitle} icon={Trophy} backTo="/pwa" onSignOut={handleSignOut} />

      <PwaContainer>
        <PwaStatTriplet
          loading={loading}
          items={[
            { label: "Hoje", value: kpis.partidasHoje, tone: "module" },
            { label: "Em curso", value: kpis.emAndamento, tone: "red" },
            { label: "Finalizadas", value: kpis.finalizadas, tone: "green" },
          ]}
        />

        {kpis.emAndamento > 0 && (
          <div className="op-card border-destructive/40 bg-destructive/10 p-3 flex items-center gap-3">
            <AlertOctagon className="h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-destructive uppercase tracking-wider">Alertas ativos</p>
              <p className="text-sm font-semibold text-foreground">{kpis.emAndamento} partida(s) em andamento</p>
            </div>
          </div>
        )}

        {agenda.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="op-label">Agenda de hoje</span>
              <button onClick={() => navigate("/pwa/coordenacao-tecnica/agenda")} className="text-[11px] font-semibold text-module hover:underline">
                Ver todas
              </button>
            </div>
            <div className="space-y-2">
              {agenda.map((m) => {
                const time = m.start_time ? m.start_time.slice(0, 5) : "—";
                return (
                  <PwaListItem
                    key={m.id}
                    leading={
                      <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-module-soft text-module">
                        <span className="text-[10px] font-bold uppercase">{format(new Date(), "EEE")}</span>
                        <span className="text-sm font-extrabold leading-none">{time}</span>
                      </div>
                    }
                    title={`Partida ${m.id.slice(0, 8)}`}
                    subtitle={m.venue?.name || "Local não definido"}
                    status={{ label: statusLabel(m.status), tone: statusTone(m.status) as any }}
                    onClick={() => navigate(`/pwa/coordenacao-tecnica/partidas`)}
                  />
                );
              })}
            </div>
          </div>
        )}

        <PwaActionGrid
          actions={[
            { label: "Consulta", icon: Search, to: "/pwa/coordenacao-tecnica/consulta" },
            { label: "Agenda", icon: Calendar, to: "/pwa/coordenacao-tecnica/agenda" },
            { label: "Partidas", icon: ClipboardList, to: "/pwa/coordenacao-tecnica/partidas" },
            { label: "Resultados", icon: Medal, to: "/pwa/coordenacao-tecnica/resultados" },
            { label: "Estatísticas", icon: BarChart3, to: "/pwa/coordenacao-tecnica/estatisticas" },
            { label: "Incidentes", icon: AlertTriangle, to: "/pwa/coordenacao-tecnica/partidas" },
          ]}
        />
      </PwaContainer>
    </div>
  );
}
