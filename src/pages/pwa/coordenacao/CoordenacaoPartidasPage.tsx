import { useEffect, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ClipboardList, Search } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";

interface MatchItem {
  id: string;
  match_date: string | null;
  status: string;
  match_number: number | null;
  phase: { name: string } | null;
}

export default function CoordenacaoPartidasPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = usePersistedState("coordenacao_partidas_filter", "");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("competition_matches")
        .select("id, match_date, status, match_number, phase:competition_phases(name)")
        .in("status", ["agendada", "em_andamento"])
        .order("match_date")
        .limit(50);
      setMatches((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = filter
    ? matches.filter(m => m.phase?.name?.toLowerCase().includes(filter.toLowerCase()) || String(m.match_number).includes(filter))
    : matches;

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader title="Partidas" icon={ClipboardList} backTo="/pwa/coordenacao-tecnica" />

      <main className="p-4 max-w-md mx-auto space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar por fase ou número..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">Nenhuma partida encontrada</div>
        )}

        {filtered.map((m) => (
          <Card key={m.id} className="cursor-pointer hover:bg-accent/50 active:scale-[0.98] transition-all"
            onClick={() => navigate(`/pwa/coordenacao-tecnica/partida/${m.id}`)}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{m.match_number ? `Jogo ${m.match_number}` : "Partida"}</p>
                <p className="text-xs text-muted-foreground">{m.phase?.name || "—"} • {m.match_date || "—"}</p>
              </div>
              <Badge variant={m.status === "em_andamento" ? "default" : "outline"}>
                {m.status === "em_andamento" ? "Em andamento" : "Agendada"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
