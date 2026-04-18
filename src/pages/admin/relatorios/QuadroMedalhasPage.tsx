import { useMemo, useState } from "react";
import { useEventContext } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Download, FileSpreadsheet, Medal, Trophy } from "lucide-react";
import { useMedalTableData, type MedalTableFilters, type ScopeFilter, type TypeFilter } from "./useMedalTableData";
import { useEventBranding } from "@/hooks/useEventBranding";
import { exportMedalTablePdf, exportRankingGeralPdf } from "./medalTablePdfExporter";
import { exportMedalTableXlsx, exportRankingGeralXlsx } from "./medalTableXlsxExporter";

export default function QuadroMedalhasPage() {
  const { activeEvent } = useEventContext();
  const eventId = activeEvent?.id;
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [sportId, setSportId] = useState<string>("__all__");

  const filters: MedalTableFilters = useMemo(
    () => ({ scope, type, sportId: sportId === "__all__" ? null : sportId }),
    [scope, type, sportId],
  );

  const { data, isLoading } = useMedalTableData(eventId, filters);
  const { data: branding } = useEventBranding(eventId);

  const sportsList = data?.sportsList ?? [];
  const filteredSports = sportsList.filter((s) => {
    if (scope === "jer") return !s.isJerpa;
    if (scope === "jerpa") return s.isJerpa;
    return true;
  });

  const onExportMedalsPdf = () => data && exportMedalTablePdf(data, {
    eventName: activeEvent?.name ?? "Evento",
    branding: branding ?? null,
    generatedAt: new Date(),
    scope,
  });
  const onExportMedalsXlsx = () => data && exportMedalTableXlsx(data, {
    eventName: activeEvent?.name ?? "Evento",
    generatedAt: new Date(),
    scope,
  });
  const onExportRankingPdf = () => data && exportRankingGeralPdf(data, {
    eventName: activeEvent?.name ?? "Evento",
    branding: branding ?? null,
    generatedAt: new Date(),
    scope,
  });
  const onExportRankingXlsx = () => data && exportRankingGeralXlsx(data, {
    eventName: activeEvent?.name ?? "Evento",
    generatedAt: new Date(),
    scope,
  });

  if (!eventId) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-muted-foreground">Selecione um evento ativo para visualizar o quadro de medalhas.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Quadro de Medalhas e Classificação Geral</h1>
          <p className="text-sm text-muted-foreground">{activeEvent?.name}</p>
        </div>
      </header>

      {/* Filtros */}
      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Escopo</label>
            <Select value={scope} onValueChange={(v) => setScope(v as ScopeFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Geral</SelectItem>
                <SelectItem value="jer">Somente JER</SelectItem>
                <SelectItem value="jerpa">Somente JERPA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
            <Select value={type} onValueChange={(v) => setType(v as TypeFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as modalidades</SelectItem>
                <SelectItem value="collective">Somente Coletivas</SelectItem>
                <SelectItem value="individual">Somente Individuais</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Modalidade</label>
            <Select value={sportId} onValueChange={setSportId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
            <p className="font-semibold text-amber-900 dark:text-amber-200">Dados parciais</p>
            <p className="text-amber-800 dark:text-amber-300">
              {data.partial.pendingSports} modalidade(s) ainda possuem resultados não publicados. O quadro pode mudar.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="medalhas">
        <TabsList>
          <TabsTrigger value="medalhas"><Medal className="h-4 w-4 mr-1.5" /> Quadro de Medalhas</TabsTrigger>
          <TabsTrigger value="geral"><Trophy className="h-4 w-4 mr-1.5" /> Classificação Geral</TabsTrigger>
        </TabsList>

        {/* QUADRO DE MEDALHAS */}
        <TabsContent value="medalhas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Quadro de Medalhas</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onExportMedalsPdf} disabled={!data}>
                  <Download className="h-4 w-4 mr-1.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={onExportMedalsXlsx} disabled={!data}>
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" /> XLSX
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : !data || data.medalsBySchool.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum resultado publicado ainda. O quadro será preenchido automaticamente conforme os resultados forem publicados.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Pos</TableHead>
                      <TableHead>Escola</TableHead>
                      <TableHead className="text-center"><span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-yellow-400 inline-block" />Ouro</span></TableHead>
                      <TableHead className="text-center"><span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-gray-400 inline-block" />Prata</span></TableHead>
                      <TableHead className="text-center"><span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-700 inline-block" />Bronze</span></TableHead>
                      <TableHead className="text-center">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.medalsBySchool.map((r) => (
                      <TableRow key={r.schoolId} className={r.pos <= 3 ? "bg-primary/5" : ""}>
                        <TableCell className="font-semibold">{r.pos}º</TableCell>
                        <TableCell>{r.schoolName}</TableCell>
                        <TableCell className="text-center font-medium">{r.ouro}</TableCell>
                        <TableCell className="text-center">{r.prata}</TableCell>
                        <TableCell className="text-center">{r.bronze}</TableCell>
                        <TableCell className="text-center font-bold">{r.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CLASSIFICAÇÃO GERAL */}
        <TabsContent value="geral">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Classificação Geral — Campeonato Geral</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onExportRankingPdf} disabled={!data}>
                  <Download className="h-4 w-4 mr-1.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={onExportRankingXlsx} disabled={!data}>
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" /> XLSX
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : !data || data.rankingGeral.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum resultado publicado ainda.
                </p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Pos</TableHead>
                        <TableHead>Escola</TableHead>
                        <TableHead className="text-center">Pts Coletivas</TableHead>
                        <TableHead className="text-center">Pts Individuais</TableHead>
                        <TableHead className="text-center">Total Geral</TableHead>
                        <TableHead className="w-32">Proporção</TableHead>
                        <TableHead className="text-center">Ouros</TableHead>
                        <TableHead className="text-center">Pratas</TableHead>
                        <TableHead className="text-center">Bronzes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rankingGeral.map((r) => {
                        const total = r.totalGeral || 1;
                        const colPct = (r.ptsColetivas / total) * 100;
                        const indPct = (r.ptsIndividuais / total) * 100;
                        return (
                          <TableRow key={r.schoolId} className={r.pos <= 3 ? "bg-primary/5" : ""}>
                            <TableCell className="font-semibold">{r.pos}º</TableCell>
                            <TableCell>{r.schoolName}</TableCell>
                            <TableCell className="text-center">{r.ptsColetivas}</TableCell>
                            <TableCell className="text-center">{r.ptsIndividuais}</TableCell>
                            <TableCell className="text-center font-bold">{r.totalGeral}</TableCell>
                            <TableCell>
                              <div className="flex h-2 rounded-full overflow-hidden bg-muted" title={`Coletivas ${Math.round(colPct)}% · Individuais ${Math.round(indPct)}%`}>
                                <div className="bg-primary" style={{ width: `${colPct}%` }} />
                                <div className="bg-accent" style={{ width: `${indPct}%` }} />
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{r.ouros}</TableCell>
                            <TableCell className="text-center">{r.pratas}</TableCell>
                            <TableCell className="text-center">{r.bronzes}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground mt-3 italic">
                    Pontuação conforme Art. 108 (1º=10, 2º=8, 3º=6, 4º=5, 5º=4, 6º=3, 7º=2, 8º=1).
                    Desempate conforme Art. 111 (mais ouros → pratas → bronzes → desempenho coletivas).
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
