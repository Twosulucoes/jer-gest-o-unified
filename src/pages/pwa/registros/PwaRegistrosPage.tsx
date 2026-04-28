import { useState, useMemo } from "react";
import { useRegistros } from "@/hooks/useRegistros";
import { useEventContext } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import PwaLayout from "@/components/pwa/PwaLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Calendar, MapPin, ChevronRight, Plus, Search, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PwaRegistrosPage() {
  const { activeEvent } = useEventContext();
  const { matches, isLoading } = useRegistros();
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const matchName = `${m.entries?.[0]?.team?.name || ""} vs ${m.entries?.[1]?.team?.name || ""}`.toLowerCase();
      const sportName = (m.sport_event?.name || "").toLowerCase();
      const search = searchTerm.toLowerCase();
      return matchName.includes(search) || sportName.includes(search);
    });
  }, [matches, searchTerm]);

  // Group by date
  const groupedMatches = useMemo(() => {
    const groups: Record<string, typeof matches> = {};
    filteredMatches.forEach(m => {
      const date = m.match_date || "Sem data";
      if (!groups[date]) groups[date] = [];
      groups[date].push(m);
    });
    return groups;
  }, [filteredMatches]);

  if (!activeEvent) {
    return (
      <PwaLayout moduleTitle="Registros">
        <div className="flex flex-col items-center justify-center p-8 text-center h-[60vh]">
          <Trophy className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h2 className="text-xl font-bold">Nenhum evento ativo</h2>
          <p className="text-muted-foreground">Selecione um evento para ver os registros.</p>
        </div>
      </PwaLayout>
    );
  }

  return (
    <PwaLayout moduleTitle="Registros" moduleIcon={Trophy}>
      <div className="p-4 space-y-4">
        {/* Header/Stats */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Partidas do Campo</h2>
          <Button size="sm" className="rounded-full" onClick={() => navigate("/pwa/registros/novo")}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            className="w-full bg-muted border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 ring-primary"
            placeholder="Buscar por modalidade ou equipe..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mb-2 opacity-10" />
            <p>Nenhuma partida encontrada.</p>
          </div>
        ) : (
          Object.entries(groupedMatches).sort((a, b) => b[0].localeCompare(a[0])).map(([date, dateMatches]) => (
            <div key={date} className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                {date === "Sem data" ? date : format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </h3>
              
              <div className="space-y-3">
                {dateMatches.map((match) => {
                  const entryA = match.entries?.find(e => e.side === "home");
                  const entryB = match.entries?.find(e => e.side === "away");
                  const time = match.start_time ? match.start_time.slice(0, 5) : "--:--";
                  
                  return (
                    <Card 
                      key={match.id} 
                      className="border-none shadow-sm rounded-2xl overflow-hidden active:scale-95 transition-transform cursor-pointer"
                      onClick={() => navigate(`/pwa/registros/detalhe/${match.id}`)}
                    >
                      <CardContent className="p-0">
                        <div className="p-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary text-[10px] font-bold">
                                {match.sport_event?.name || "Modalidade"}
                              </Badge>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {time}
                              </div>
                            </div>
                            <Badge variant={match.status === "finished" ? "secondary" : "default"} className="text-[10px]">
                              {match.status === "finished" ? "Finalizada" : "Agendada"}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col gap-1">
                                <p className="font-bold text-sm truncate">{entryA?.team?.name || "Equipe A"}</p>
                                <p className="font-bold text-sm truncate">{entryB?.team?.name || "Equipe B"}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-center font-black text-xl">
                                <span>{entryA?.score?.score_final ?? "-"}</span>
                                <span>{entryB?.score?.score_final ?? "-"}</span>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground/30" />
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{match.venue?.name || "Local não definido"}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </PwaLayout>
  );
}
