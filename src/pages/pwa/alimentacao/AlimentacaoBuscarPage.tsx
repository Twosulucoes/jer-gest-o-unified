import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Search, Loader2 } from "lucide-react";
import { PwaRefreshButton } from "@/components/pwa/PwaRefreshButton";

interface PersonResult {
  id: string;
  full_name: string;
  participant_type: string;
  food_restrictions: string | null;
}

export default function AlimentacaoBuscarPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await supabase
        .from("participants")
        .select("id, full_name, participant_type, food_restrictions")
        .or(`full_name.ilike.%${query.trim()}%,cpf.ilike.%${query.trim()}%`)
        .limit(20);
      setResults((data as any) || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button onClick={() => navigate("/pwa/alimentacao")} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Search className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Buscar Pessoa</span>
        <div className="ml-auto"><PwaRefreshButton /></div>
      </header>

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
          {results.map((p) => (
            <Card key={p.id} className="cursor-pointer hover:bg-accent/50 active:scale-[0.98] transition-all">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">{p.participant_type}</p>
                </div>
                {p.food_restrictions && (
                  <Badge variant="outline" className="text-xs text-amber-600">Restrição</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
