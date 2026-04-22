import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Trophy, User, Calendar, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import ParticipantSportHistory from "@/components/admin/ParticipantSportHistory";

export default function HistoricoBuscaPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<any>(null);

  const { data: people, isLoading: searching } = useQuery({
    queryKey: ["historico-search-people", searchTerm],
    enabled: searchTerm.trim().length >= 3,
    queryFn: async () => {
      const term = searchTerm.trim();
      const isCpf = /^\d+$/.test(term.replace(/\D/g, "")) && term.replace(/\D/g, "").length >= 3;
      const cpfClean = term.replace(/\D/g, "");
      
      let q = supabase.from("people").select("id, full_name, cpf, gender, birth_date");
      if (isCpf) {
        q = q.ilike("cpf", `%${cpfClean}%`);
      } else {
        q = q.ilike("full_name", `%${term}%`);
      }
      
      const { data, error } = await q.limit(10);
      if (error) throw error;
      return data;
    },
  });

  const { data: participations, isLoading: loadingParticipations } = useQuery({
    queryKey: ["person-participations", selectedPerson?.id],
    enabled: !!selectedPerson?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select(`
          id, 
          participant_type, 
          status, 
          event:events(id, name, year),
          delegation:delegations(id, school_name, institution:institutions(name))
        `)
        .eq("person_id", selectedPerson.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [selectedParticipationId, setSelectedParticipationId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" /> Histórico do Participante
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Busque por nome ou CPF para visualizar o histórico esportivo consolidado em todos os eventos.
        </p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Digite o nome ou CPF para buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
          
          {searching && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!searching && people && people.length > 0 && (
            <div className="mt-4 border rounded-lg overflow-hidden divide-y">
              {people.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPerson(p);
                    setSelectedParticipationId(null);
                  }}
                  className={`w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-center justify-between ${
                    selectedPerson?.id === p.id ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground">{p.cpf || "Sem CPF registrado"}</p>
                    </div>
                  </div>
                  {selectedPerson?.id === p.id && <Badge variant="secondary">Selecionado</Badge>}
                </button>
              ))}
            </div>
          )}

          {!searching && searchTerm.trim().length >= 3 && people?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma pessoa encontrada.</p>
          )}
        </CardContent>
      </Card>

      {selectedPerson && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Participações
                </CardTitle>
                <CardDescription>Eventos registrados para esta pessoa.</CardDescription>
              </CardHeader>
              <CardContent className="px-2">
                {loadingParticipations ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : participations?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma participação encontrada.</p>
                ) : (
                  <div className="space-y-1">
                    {participations?.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedParticipationId(p.id)}
                        className={`w-full text-left p-2.5 rounded-lg hover:bg-muted/50 transition-colors ${
                          selectedParticipationId === p.id ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <p className="font-semibold text-xs truncate max-w-[140px]">{p.event?.name}</p>
                          <Badge variant="outline" className={`text-[10px] h-4 px-1 ${selectedParticipationId === p.id ? "border-white/40 text-white" : ""}`}>
                            {p.event?.year}
                          </Badge>
                        </div>
                        <p className={`text-[10px] mt-0.5 truncate ${selectedParticipationId === p.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                          {p.delegation?.institution?.name || p.delegation?.school_name || "Sem delegação"}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            {selectedParticipationId ? (
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <div>
                    <CardTitle className="text-lg">Detalhes Esportivos</CardTitle>
                    <CardDescription>Resultados técnicos na edição selecionada.</CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm" className="h-8 gap-1">
                    <Link to={`/admin/participantes/${selectedParticipationId}`}>
                      <ExternalLink className="h-3.5 w-3.5" /> Ver Perfil
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="pt-4">
                  <ParticipantSportHistory participantId={selectedParticipationId} />
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground space-y-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Trophy className="h-6 w-6 opacity-40" />
                </div>
                <p>Selecione uma participação ao lado para ver os resultados.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
