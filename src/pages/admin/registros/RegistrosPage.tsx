import { useState } from "react";
import { useRegistros } from "@/hooks/useRegistros";
import { useEventContext } from "@/contexts/EventContext";
import { Button } from "@/components/ui/button";
import { Plus, Trophy, Calendar, MapPin, Filter, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import RegistroFormDialog from "./RegistroFormDialog";

export default function RegistrosPage() {
  const { activeEvent } = useEventContext();
  const { matches, isLoading } = useRegistros();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (!activeEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">Selecione um evento</h2>
        <p className="text-muted-foreground">Você precisa selecionar um evento para gerenciar os registros.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Módulo de Registros</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão simplificada de partidas e resultados para o evento {activeEvent.name}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filtrar
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Registro
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Partidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{matches.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Simplificadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {matches.filter(m => m.source === "simple").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Publicadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {matches.filter(m => m.status === "published" || m.status === "publicado").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Partidas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : matches.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              Nenhuma partida registrada neste evento.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Partida</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match) => {
                    const date = match.match_date ? format(parseISO(match.match_date), "dd/MM/yyyy") : "—";
                    const time = match.start_time ? match.start_time.slice(0, 5) : "—";
                    
                    const entryA = match.entries?.find(e => e.side === "home");
                    const entryB = match.entries?.find(e => e.side === "away");
                    
                    const scoreA = entryA?.score?.score_final;
                    const scoreB = entryB?.score?.score_final;
                    
                    return (
                      <TableRow key={match.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{date}</span>
                            <span className="text-xs text-muted-foreground">{time}</span>
                          </div>
                        </TableCell>
                        <TableCell>{match.sport_event?.name || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span className="font-semibold">{entryA?.team?.name || "—"}</span>
                            <span className="text-muted-foreground">vs</span>
                            <span className="font-semibold">{entryB?.team?.name || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {scoreA !== undefined || scoreB !== undefined ? (
                            <div className="flex items-center gap-2 font-bold text-lg">
                              <span>{scoreA ?? 0}</span>
                              <span className="text-muted-foreground">×</span>
                              <span>{scoreB ?? 0}</span>
                            </div>
                          ) : (
                            <Badge variant="outline">Pendente</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {match.venue?.name || "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={match.source === "simple" ? "secondary" : "outline"}>
                            {match.source === "simple" ? "Simplificado" : "Complexo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" title="Remover">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RegistroFormDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
      />
    </div>
  );
}
