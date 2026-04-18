import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar } from "lucide-react";
import { format } from "date-fns";

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
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("competition_matches")
        .select("id, match_date, start_time, status, match_number, venue:venues(name), phase:competition_phases(name, sport_event:sport_events(sport:sports(name), category:categories(name)))")
        .eq("match_date", today)
        .order("start_time");
      setMatches((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    agendada: { label: "Agendada", variant: "outline" },
    em_andamento: { label: "Em andamento", variant: "default" },
    finalizada: { label: "Finalizada", variant: "secondary" },
    cancelada: { label: "Cancelada", variant: "destructive" },
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button onClick={() => navigate("/pwa/coordenacao-tecnica")} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Calendar className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Agenda de Hoje</span>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-3">
        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}

        {!loading && matches.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">Nenhuma partida agendada para hoje</div>
        )}

        {matches.map((m) => {
          const s = statusMap[m.status] || { label: m.status, variant: "outline" as const };
          const sportName = (m.phase as any)?.sport_event?.sport?.name || "";
          const catName = (m.phase as any)?.sport_event?.category?.name || "";
          return (
            <Card key={m.id} className="cursor-pointer hover:bg-accent/50 active:scale-[0.98] transition-all"
              onClick={() => navigate(`/pwa/coordenacao-tecnica/partida/${m.id}`)}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">
                    {m.start_time ? format(new Date(`${m.match_date}T${m.start_time}`), "HH:mm") : "—"}
                    {m.match_number ? ` • Jogo ${m.match_number}` : ""}
                  </span>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[sportName, catName].filter(Boolean).join(" • ") || m.phase?.name || "—"}
                </p>
                {m.venue?.name && <p className="text-xs text-muted-foreground">📍 {m.venue.name}</p>}
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
