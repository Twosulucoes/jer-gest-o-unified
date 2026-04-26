import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";

interface MatchItem {
  id: string;
  match_date: string | null;
  start_time: string | null;
  status: string;
  match_number: number | null;
  venue: { name: string } | null;
  phase: { name: string } | null;
}

export default function DelegacaoAgendaPage() {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("competition_matches")
        .select("id, match_date, start_time, status, match_number, venue:venues(name), phase:competition_phases(name)")
        .gte("match_date", today)
        .order("match_date")
        .order("start_time")
        .limit(30);
      setMatches((data as any) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader title="Agenda" icon={Calendar} backTo="/pwa/delegacao" />

      <main className="p-4 max-w-md mx-auto space-y-3">
        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}

        {!loading && matches.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">Nenhuma partida agendada</div>
        )}

        {matches.map((m) => (
          <Card key={m.id}>
            <CardContent className="p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">
                  {m.match_date} {m.start_time ? `• ${m.start_time.slice(0, 5)}` : ""}
                </span>
                <Badge variant={m.status === "agendada" ? "outline" : "default"}>
                  {m.status === "agendada" ? "Agendada" : m.status === "em_andamento" ? "Em andamento" : m.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{m.phase?.name || "—"}</p>
              {m.venue?.name && <p className="text-xs text-muted-foreground">📍 {m.venue.name}</p>}
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
