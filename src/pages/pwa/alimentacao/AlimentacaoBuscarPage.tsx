import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Loader2 } from "lucide-react";
import PwaLayout from "@/components/pwa/PwaLayout";
import { searchParticipantsByNameOrCpf, type ParticipantManualSearchRow } from "@/lib/participantManualSearch";
import { useEventContext } from "@/contexts/EventContext";
import { useStageContext } from "@/contexts/StageContext";

export default function AlimentacaoBuscarPage() {
  const { activeEventId } = useEventContext();
  const { activeStageId } = useStageContext();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParticipantManualSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || !activeEventId) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchParticipantsByNameOrCpf(query.trim(), activeEventId, 12, activeStageId);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PwaLayout backTo="/pwa/alimentacao" moduleTitle="Buscar Pessoa">
      <main className="p-4 max-w-md mx-auto space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Nome ou CPF"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">Nenhuma pessoa encontrada</div>
        )}

        <div className="space-y-2">
          {results.map((p) => {
            const blockReason = p.is_active === false
              ? "inativo"
              : p.needs_meals === false
                ? "não precisa alim."
                : !p.credentialed_at
                  ? "sem credencial"
                  : p.left_event_at
                    ? "saiu do evento"
                    : null;
            return (
              <Card key={p.participant_id} className="cursor-pointer hover:bg-accent/50 active:scale-[0.98] transition-all">
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.participant_type}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {blockReason && (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        {blockReason}
                      </span>
                    )}
                    {p.cpf && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">{p.cpf}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </PwaLayout>
  );
}
