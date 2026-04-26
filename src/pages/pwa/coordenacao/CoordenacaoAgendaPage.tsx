import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useActiveStageId } from "@/contexts/StageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface MatchItem {
  id: string;
  match_date: string | null;
  start_time: string | null;
  status: string;
  match_number: number | null;
  venue: { name: string } | null;
  phase: { name: string; sport_event: { sport: { name: string } | null; category: { name: string } | null } | null } | null;
}

export default function CoordenacaoAgendaPage() {
  const navigate = useNavigate();
  const eventId = useActiveEventId();
  const stageId = useActiveStageId();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);

      // Se há etapa em escopo, primeiro descobre quais venues servem essa etapa (N:N)
      let venueIdsFilter: string[] | null = null;
      if (stageId) {
        const { data: links } = await (supabase as any)
          .from("venue_event_stages")
          .select("venue_id")
          .eq("event_stage_id", stageId);
        venueIdsFilter = (links ?? []).map((l: any) => l.venue_id as string);
        if (venueIdsFilter.length === 0) {
          setMatches([]);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from("competition_matches")
        .select("id, match_date, start_time, status, match_number, venue:venues!inner(name, event_id), phase:competition_phases(name, sport_event:sport_events(sport:sports(name), category:categories(name)))")
        .eq("match_date", today)
        .eq("venues.event_id", eventId);

      if (venueIdsFilter) {
        query = query.in("venue_id", venueIdsFilter);
      }

      const { data } = await query.order("start_time");
      setMatches((data as any) || []);
      setLoading(false);
    })();
  }, [eventId, stageId]);

  const statusStyle: Record<string, { label: string; className: string }> = {
    agendada: { label: "Próximo", className: "bg-muted text-muted-foreground" },
    scheduled: { label: "Próximo", className: "bg-muted text-muted-foreground" },
    em_andamento: { label: "Em curso", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    in_progress: { label: "Em curso", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    finalizada: { label: "Concluído", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
    finished: { label: "Concluído", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
    cancelada: { label: "Cancelada", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
    cancelled: { label: "Cancelada", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
      <header className="relative flex h-14 items-center gap-2 border-b border-border/80 bg-card/95 px-4 shadow-app-sm backdrop-blur-sm">
        <button type="button" onClick={() => navigate("/pwa/coordenacao-tecnica")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Calendar className="h-5 w-5 text-primary" />
        <div className="flex flex-col">
          <span className="font-semibold leading-tight text-foreground">Agenda de hoje</span>
          <span className="text-[11px] text-muted-foreground">Painel técnico do evento</span>
        </div>
      </header>

      <main className="relative mx-auto max-w-md space-y-3 p-4">
        {loading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-[88px] w-full rounded-2xl" />)}

        {!loading && matches.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma partida agendada para hoje</div>
        )}

        {matches.map((m) => {
          const s = statusStyle[m.status] || { label: m.status, className: "bg-muted text-muted-foreground" };
          const sportName = (m.phase as any)?.sport_event?.sport?.name || "";
          const catName = (m.phase as any)?.sport_event?.category?.name || "";
          const title = [sportName, catName].filter(Boolean).join(" — ") || m.phase?.name || "Partida";
          const timeStr = m.start_time ? format(new Date(`${m.match_date}T${m.start_time}`), "HH:mm") : "—";

          return (
            <Card
              key={m.id}
              className="cursor-pointer border-border/80 bg-card/95 shadow-app-sm transition-all hover:shadow-app-md active:scale-[0.99]"
              onClick={() => navigate(`/pwa/coordenacao-tecnica/partida/${m.id}`)}
            >
              <CardContent className="flex gap-3 p-4">
                <div className="w-14 shrink-0 text-center">
                  <p className="font-mono text-lg font-bold leading-none text-foreground">{timeStr}</p>
                  {m.match_number != null && (
                    <p className="mt-1 text-[10px] font-medium text-muted-foreground">#{m.match_number}</p>
                  )}
                </div>
                <div className="min-w-0 flex-1 border-l border-border/60 pl-3">
                  <p className="text-sm font-semibold leading-snug text-foreground">{title}</p>
                  {m.venue?.name && <p className="mt-1 text-xs text-muted-foreground">{m.venue.name}</p>}
                </div>
                <Badge className={cn("h-fit shrink-0 rounded-full border-0 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide", s.className)}>
                  {s.label}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
