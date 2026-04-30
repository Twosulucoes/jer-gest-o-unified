import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Medal, Trophy, Loader2, ArrowLeft } from "lucide-react";
import { VisualIdentity } from "@/components/public/VisualIdentity";
import { Button } from "@/components/ui/button";
import { useMedalTableData, type MedalTableFilters, type ScopeFilter, type TypeFilter } from "../admin/relatorios/useMedalTableData";

export default function PublicMedalTablePage() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [sportId, setSportId] = useState<string>("__all__");

  // Fetch public events
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["public-events-medals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, year")
        .eq("is_public", true)
        .order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filters: MedalTableFilters = useMemo(
    () => ({ scope, type, sportId: sportId === "__all__" ? null : sportId }),
    [scope, type, sportId],
  );

  const { data, isLoading: loadingData } = useMedalTableData(selectedEventId, filters);

  const sportsList = data?.sportsList ?? [];
  const filteredSports = sportsList.filter((s) => {
    if (scope === "jer") return !s.isJerpa;
    if (scope === "jerpa") return s.isJerpa;
    return true;
  });

  const handleBack = () => {
    setSelectedEventId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedEventId && (
              <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <VisualIdentity size="sm" subtitle={selectedEventId ? "Quadro de Medalhas" : "Resultados Oficiais"} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 space-y-6">
        {!selectedEventId ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loadingEvents ? (
              <div className="col-span-full flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : events.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhum evento com resultados publicados no momento.
                </CardContent>
              </Card>
            ) : (
              events.map((ev) => (
                <Card 
                  key={ev.id} 
                  className="cursor-pointer hover:border-primary transition-colors group"
                  onClick={() => setSelectedEventId(ev.id)}
                >
                  <CardHeader>
                    <CardTitle className="group-hover:text-primary transition-colors">{ev.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{ev.year}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-primary font-medium text-sm">
                      Ver medalhas e ranking <Trophy className="ml-2 h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Filtros */}
            <Card>
              <CardContent className="p-4 grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Escopo</label>
                  <Select value={scope} onValueChange={(v) => setScope(v as ScopeFilter)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Geral</SelectItem>
                      <SelectItem value="jer">Somente JER</SelectItem>
                      <SelectItem value="jerpa">Somente JERPA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Tipo</label>
                  <Select value={type} onValueChange={(v) => setType(v as TypeFilter)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as modalidades</SelectItem>
                      <SelectItem value="collective">Somente Coletivas</SelectItem>
                      <SelectItem value="individual">Somente Individuais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Modalidade</label>
                  <Select value={sportId} onValueChange={setSportId}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas</SelectItem>
                      {filteredSports.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Banner parcial */}
            {data?.partial.hasPartial && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-200">Resultados Parciais</p>
                  <p className="text-amber-800 dark:text-amber-300">
                    Existem {data.partial.pendingSports} modalidades com resultados pendentes de publicação.
                  </p>
                </div>
              </div>
            )}

            <Tabs defaultValue="medalhas" className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                <TabsTrigger value="medalhas"><Medal className="h-4 w-4 mr-2" /> Medalhas</TabsTrigger>
                <TabsTrigger value="geral"><Trophy className="h-4 w-4 mr-2" /> Ranking</TabsTrigger>
              </TabsList>

              <TabsContent value="medalhas" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    {loadingData ? (
                      <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : !data || data.medalsBySchool.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-12 text-center">Nenhum resultado oficial publicado.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">Pos</TableHead>
                              <TableHead>Instituição / Delegação</TableHead>
                              <TableHead className="text-center w-20">Ouro</TableHead>
                              <TableHead className="text-center w-20">Prata</TableHead>
                              <TableHead className="text-center w-20">Bronze</TableHead>
                              <TableHead className="text-center w-20">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.medalsBySchool.map((r) => (
                              <TableRow key={r.schoolId}>
                                <TableCell className="font-bold text-lg">{r.pos}º</TableCell>
                                <TableCell className="font-medium">{r.schoolName}</TableCell>
                                <TableCell className="text-center">
                                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-yellow-400/20 text-yellow-700 font-bold">{r.ouro}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-400/20 text-gray-700 font-bold">{r.prata}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-amber-700/20 text-amber-800 font-bold">{r.bronze}</span>
                                </TableCell>
                                <TableCell className="text-center font-black">{r.total}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="geral" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    {loadingData ? (
                      <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : !data || data.rankingGeral.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-12 text-center">Classificação não disponível.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">Pos</TableHead>
                              <TableHead>Instituição</TableHead>
                              <TableHead className="text-center">Pontos</TableHead>
                              <TableHead className="text-center">Ouros</TableHead>
                              <TableHead className="text-center">Pratas</TableHead>
                              <TableHead className="text-center">Bronzes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.rankingGeral.map((r) => (
                              <TableRow key={r.schoolId}>
                                <TableCell className="font-bold text-lg">{r.pos}º</TableCell>
                                <TableCell className="font-medium">{r.schoolName}</TableCell>
                                <TableCell className="text-center font-black text-primary">{r.totalGeral}</TableCell>
                                <TableCell className="text-center">{r.ouros}</TableCell>
                                <TableCell className="text-center">{r.pratas}</TableCell>
                                <TableCell className="text-center">{r.bronzes}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground bg-muted/20 mt-12">
        <p className="font-bold">JER Gestão</p>
        <p className="text-xs">Plataforma de Gestão dos Jogos Escolares de Roraima</p>
      </footer>
    </div>
  );
}
