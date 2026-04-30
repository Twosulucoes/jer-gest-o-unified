import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Medal, Trophy, Loader2, ArrowLeft } from "lucide-react";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
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
    <div className="op-screen flex flex-col min-h-screen">
      <PublicHeader 
        subtitle={selectedEventId ? "Quadro de Medalhas" : "Resultados Oficiais"} 
        onBack={handleBack} 
        showBackButton={!!selectedEventId} 
      />

      <main className="mx-auto w-full max-w-5xl p-4 space-y-6 flex-grow animate-fade-in">
        {!selectedEventId ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {loadingEvents ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4">
                <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <p className="text-sm font-medium text-muted-foreground animate-pulse">Carregando eventos...</p>
              </div>
            ) : events.length === 0 ? (
              <Card className="col-span-full op-card border-dashed">
                <CardContent className="py-20 text-center space-y-3">
                  <div className="bg-muted/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trophy className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="font-bold text-lg text-muted-foreground">Nenhum evento com resultados</p>
                </CardContent>
              </Card>
            ) : (
              events.map((ev, idx) => (
                <Card 
                  key={ev.id} 
                  className="op-card group cursor-pointer hover:scale-[1.02] hover:shadow-accent-glow animate-fade-in"
                  style={{ animationDelay: `${idx * 50}ms` }}
                  onClick={() => setSelectedEventId(ev.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="bg-primary/10 p-3 rounded-2xl group-hover:bg-primary/20 transition-all">
                        <Trophy className="h-6 w-6 text-primary" />
                      </div>
                      <Badge variant="secondary" className="font-bold text-[10px]">{ev.year}</Badge>
                    </div>
                    <CardTitle className="pt-4 font-black tracking-tight text-xl group-hover:text-primary transition-colors leading-tight">{ev.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="flex items-center text-primary font-bold text-xs uppercase tracking-widest gap-2">
                      Ver medalhas <ChevronRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Filtros */}
            <Card className="op-card overflow-hidden">
              <div className="bg-muted/30 px-5 py-2.5 border-b border-border/50">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Filtros de Visualização</p>
              </div>
              <CardContent className="p-5 grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider ml-1">Escopo</label>
                  <Select value={scope} onValueChange={(v) => setScope(v as ScopeFilter)}>
                    <SelectTrigger className="h-11 rounded-xl bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">Geral (JER + JERPA)</SelectItem>
                      <SelectItem value="jer">Somente JER</SelectItem>
                      <SelectItem value="jerpa">Somente JERPA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider ml-1">Tipo</label>
                  <Select value={type} onValueChange={(v) => setType(v as TypeFilter)}>
                    <SelectTrigger className="h-11 rounded-xl bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">Todas as modalidades</SelectItem>
                      <SelectItem value="collective">Somente Coletivas</SelectItem>
                      <SelectItem value="individual">Somente Individuais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider ml-1">Modalidade</label>
                  <Select value={sportId} onValueChange={setSportId}>
                    <SelectTrigger className="h-11 rounded-xl bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="__all__">Todas as Modalidades</SelectItem>
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
              <div className="flex items-start gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 animate-pulse">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-black text-xs uppercase tracking-wider text-amber-800">Resultados Parciais</p>
                  <p className="text-sm text-amber-800/80 font-medium">
                    Existem {data.partial.pendingSports} modalidades com resultados em processamento. Os números podem mudar!
                  </p>
                </div>
              </div>
            )}

            <Tabs defaultValue="medalhas" className="w-full space-y-6">
              <div className="glass-panel p-1.5 rounded-2xl inline-flex w-full sm:w-auto">
                <TabsList className="grid w-full sm:w-[400px] grid-cols-2 bg-transparent">
                  <TabsTrigger value="medalhas" className="rounded-xl py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white font-bold transition-all">
                    <Medal className="h-4 w-4 mr-2" /> Quadro de Medalhas
                  </TabsTrigger>
                  <TabsTrigger value="geral" className="rounded-xl py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white font-bold transition-all">
                    <Trophy className="h-4 w-4 mr-2" /> Ranking Geral
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="medalhas" className="mt-0 animate-fade-in">
                <Card className="op-card overflow-hidden">
                  <CardContent className="p-0">
                    {loadingData ? (
                      <div className="flex justify-center py-20"><div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
                    ) : !data || data.medalsBySchool.length === 0 ? (
                      <div className="py-20 text-center space-y-3">
                        <Medal className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Nenhum resultado oficial publicado</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow className="hover:bg-transparent border-border/50">
                              <TableHead className="w-16 font-black uppercase tracking-tighter text-[10px]">Pos</TableHead>
                              <TableHead className="font-black uppercase tracking-tighter text-[10px]">Instituição / Delegação</TableHead>
                              <TableHead className="text-center w-24 font-black uppercase tracking-tighter text-[10px]">Ouro</TableHead>
                              <TableHead className="text-center w-24 font-black uppercase tracking-tighter text-[10px]">Prata</TableHead>
                              <TableHead className="text-center w-24 font-black uppercase tracking-tighter text-[10px]">Bronze</TableHead>
                              <TableHead className="text-center w-24 font-black uppercase tracking-tighter text-[10px]">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.medalsBySchool.map((r) => (
                              <TableRow key={r.schoolId} className="hover:bg-primary/5 transition-colors border-border/30">
                                <TableCell className="font-black text-xl tabular-nums text-foreground/70">{r.pos}º</TableCell>
                                <TableCell>
                                  <p className="font-bold text-base tracking-tight leading-tight">{r.schoolName}</p>
                                  <p className="text-[10px] text-muted-foreground font-medium uppercase mt-0.5">Escola Participante</p>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-amber-400 shadow-[0_4px_12px_-4px_rgba(251,191,36,0.5)] text-amber-950 font-black text-lg">{r.ouro}</div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-slate-300 shadow-[0_4px_12px_-4px_rgba(148,163,184,0.5)] text-slate-900 font-black text-lg">{r.prata}</div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-amber-700 shadow-[0_4px_12px_-4px_rgba(180,83,9,0.5)] text-amber-50 font-black text-lg">{r.bronze}</div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="text-xl font-black text-foreground tabular-nums">{r.total}</span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="geral" className="mt-0 animate-fade-in">
                <Card className="op-card overflow-hidden">
                  <CardContent className="p-0">
                    {loadingData ? (
                      <div className="flex justify-center py-20"><div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
                    ) : !data || data.rankingGeral.length === 0 ? (
                      <div className="py-20 text-center space-y-3">
                        <Trophy className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Classificação não disponível</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow className="hover:bg-transparent border-border/50">
                              <TableHead className="w-16 font-black uppercase tracking-tighter text-[10px]">Pos</TableHead>
                              <TableHead className="font-black uppercase tracking-tighter text-[10px]">Instituição</TableHead>
                              <TableHead className="text-center font-black uppercase tracking-tighter text-[10px]">Pontuação Geral</TableHead>
                              <TableHead className="text-center font-black uppercase tracking-tighter text-[10px]">Ouros</TableHead>
                              <TableHead className="text-center font-black uppercase tracking-tighter text-[10px]">Pratas</TableHead>
                              <TableHead className="text-center font-black uppercase tracking-tighter text-[10px]">Bronzes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.rankingGeral.map((r) => (
                              <TableRow key={r.schoolId} className="hover:bg-primary/5 transition-colors border-border/30">
                                <TableCell className="font-black text-xl tabular-nums text-foreground/70">{r.pos}º</TableCell>
                                <TableCell>
                                  <p className="font-bold text-base tracking-tight">{r.schoolName}</p>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className="bg-primary text-white font-black px-4 py-1 text-base rounded-lg shadow-glow border-none">
                                    {r.totalGeral} pts
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center font-bold text-amber-600">{r.ouros}</TableCell>
                                <TableCell className="text-center font-bold text-slate-500">{r.pratas}</TableCell>
                                <TableCell className="text-center font-bold text-amber-800">{r.bronzes}</TableCell>
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

      <PublicFooter />
    </div>
  );
  );
}
