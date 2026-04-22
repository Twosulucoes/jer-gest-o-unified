import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { resolveQrCredential } from "@/lib/resolveQrCredential";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ScanLine, User, Trophy, MapPin, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ParticipantDetail {
  id: string;
  full_name: string;
  participant_type: string;
  delegation_name?: string;
  category_name?: string;
  sport_name?: string;
  photo_url?: string;
  status?: string;
}

export default function CoordenacaoConsultaPage() {
  const navigate = useNavigate();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ParticipantDetail[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantDetail | null>(null);
  const [searched, setSearched] = useState(false);

  const fetchParticipantDetail = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("participants")
        .select(`
          id, 
          full_name, 
          participant_type, 
          status,
          delegation:delegations(name),
          category:categories(name),
          sport:sports(name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      const detail: ParticipantDetail = {
        id: data.id,
        full_name: data.full_name,
        participant_type: data.participant_type,
        status: data.status,
        delegation_name: (data as any).delegation?.name,
        category_name: (data as any).category?.name,
        sport_name: (data as any).sport?.name,
      };

      setSelectedParticipant(detail);
      setResults([]);
    } catch (err) {
      console.error("Erro ao buscar detalhes:", err);
      toast.error("Erro ao carregar dados do participante");
    } finally {
      setLoading(false);
    }
  };

  const handleScan = useCallback(async (payload: string) => {
    setScannerOpen(false);
    setLoading(true);
    try {
      const resolved = await resolveQrCredential(payload);
      if (resolved) {
        await fetchParticipantDetail(resolved.participant_id);
      } else {
        toast.error("QR Code não reconhecido ou inválido para este evento");
      }
    } catch (err) {
      toast.error("Erro ao processar QR Code");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setSelectedParticipant(null);
    try {
      const { data, error } = await supabase
        .from("participants")
        .select(`
          id, 
          full_name, 
          participant_type,
          delegation:delegations(name)
        `)
        .or(`full_name.ilike.%${query.trim()}%,cpf.ilike.%${query.trim()}%`)
        .limit(10);

      if (error) throw error;

      setResults(data.map(d => ({
        id: d.id,
        full_name: d.full_name,
        participant_type: d.participant_type,
        delegation_name: (d as any).delegation?.name
      })));
    } catch (err) {
      toast.error("Erro na busca");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <PwaHeader title="Consulta Rápida" icon={Search} backTo="/pwa/coordenacao-tecnica" />

      <main className="p-4 max-w-md mx-auto space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Nome ou CPF"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button variant="secondary" onClick={() => setScannerOpen(true)}>
            <ScanLine className="h-4 w-4" />
          </Button>
          <Button onClick={handleSearch} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </Button>
        </div>

        {loading && !selectedParticipant && [1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}

        {!loading && searched && results.length === 0 && !selectedParticipant && (
          <div className="text-center py-8 text-muted-foreground italic">Nenhum resultado encontrado</div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Resultados</h3>
            {results.map((p) => (
              <Card 
                key={p.id} 
                className="cursor-pointer hover:bg-accent/50 active:scale-[0.98] transition-all"
                onClick={() => fetchParticipantDetail(p.id)}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.participant_type} {p.delegation_name ? ` • ${p.delegation_name}` : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {selectedParticipant && (
          <Card className="overflow-hidden border-primary/20 shadow-lg animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-primary/5 p-6 flex flex-col items-center text-center gap-3 border-b border-primary/10">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                <User className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{selectedParticipant.full_name}</h2>
                <Badge variant={selectedParticipant.status === "active" ? "default" : "secondary"}>
                  {selectedParticipant.participant_type}
                </Badge>
              </div>
            </div>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Delegação</p>
                    <p className="text-sm font-semibold">{selectedParticipant.delegation_name || "Não informada"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Modalidade / Categoria</p>
                    <p className="text-sm font-semibold">
                      {selectedParticipant.sport_name || "—"} / {selectedParticipant.category_name || "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Status no Evento</p>
                    <Badge variant={selectedParticipant.status === "active" ? "outline" : "secondary"} className="mt-1">
                      {selectedParticipant.status === "active" ? "Credenciado" : "Pendente"}
                    </Badge>
                  </div>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full mt-4" 
                onClick={() => setSelectedParticipant(null)}
              >
                Limpar Consulta
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Consulta de Participante"
      />
    </div>
  );
}
