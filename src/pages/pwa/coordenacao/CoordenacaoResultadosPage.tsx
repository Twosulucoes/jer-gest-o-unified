import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Medal } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";

interface ResultItem {
  id: string;
  match_number: number | null;
  match_date: string | null;
  status: string;
  phase: { name: string } | null;
}

export default function CoordenacaoResultadosPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("competition_matches")
        .select("id, match_number, match_date, status, phase:competition_phases(name)")
        .eq("status", "finalizada")
        .order("match_date", { ascending: false })
        .limit(50);
      setMatches((data as any) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader title="Resultados" icon={Medal} backTo="/pwa/coordenacao-tecnica" />

      <main className="p-4 max-w-md mx-auto space-y-3">
        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}

        {!loading && matches.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">Nenhuma partida finalizada</div>
        )}

        {matches.map((m) => (
          <Card key={m.id} className="cursor-pointer hover:bg-accent/50 active:scale-[0.98] transition-all"
            onClick={() => navigate(`/pwa/coordenacao-tecnica/partida/${m.id}`)}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{m.match_number ? `Jogo ${m.match_number}` : "Partida"}</p>
                <p className="text-xs text-muted-foreground">{m.phase?.name || "—"} • {m.match_date || "—"}</p>
              </div>
              <Badge variant="module">Finalizada</Badge>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
