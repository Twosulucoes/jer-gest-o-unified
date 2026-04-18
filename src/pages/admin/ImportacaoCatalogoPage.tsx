import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEvent } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertTriangle, Search, RefreshCw, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface CatalogResponse {
  version: string;
  sport_aliases: Record<string, string[]>;
  single_category_fallback_whitelist: string[];
  age_band_to_category: Array<{ sportPattern: string; ageBand: string; categorySlug: string }>;
  accepted_status: string[];
  accepted_participant_types: Record<string, string>;
  accepted_birth_year_range: { min: number; max: number };
  notes: string[];
}

interface SportRow { id: string; name: string; slug: string; }
interface SportEventRow { id: string; name: string; slug: string; sport_id: string; category_id: string; }
interface CategoryRow { id: string; name: string; slug: string; }

export default function ImportacaoCatalogoPage() {
  const { activeEvent } = useEvent();
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [sports, setSports] = useState<SportRow[]>([]);
  const [sportEvents, setSportEvents] = useState<SportEventRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  async function load() {
    if (!activeEvent?.id) return;
    setLoading(true);
    try {
      const [catRes, sportsRes, seRes, catsRes] = await Promise.all([
        supabase.functions.invoke("import-catalog"),
        supabase.from("sports").select("id, name, slug").order("name"),
        supabase.from("sport_events").select("id, name, slug, sport_id, category_id").eq("event_id", activeEvent.id),
        supabase.from("categories").select("id, name, slug").eq("event_id", activeEvent.id).order("name"),
      ]);
      if (catRes.error) throw catRes.error;
      setCatalog(catRes.data as CatalogResponse);
      setSports((sportsRes.data as SportRow[]) ?? []);
      setSportEvents((seRes.data as SportEventRow[]) ?? []);
      setCategories((catsRes.data as CategoryRow[]) ?? []);
    } catch (e: any) {
      toast.error("Falha ao carregar catálogo: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [activeEvent?.id]);

  const sportSlugSet = useMemo(() => new Set(sports.map(s => s.slug)), [sports]);
  const eventSportIds = useMemo(() => new Set(sportEvents.map(se => se.sport_id)), [sportEvents]);
  const eventSports = useMemo(() => sports.filter(s => eventSportIds.has(s.id)), [sports, eventSportIds]);

  // Cobertura: para cada modalidade do evento, quantas provas (sport_events) e quantas categorias distintas
  const sportCoverage = useMemo(() => {
    return eventSports.map(s => {
      const provas = sportEvents.filter(se => se.sport_id === s.id);
      const cats = new Set(provas.map(p => p.category_id));
      const aliasList = catalog ? (catalog.sport_aliases[s.slug] ?? []) : [];
      return { sport: s, provasCount: provas.length, catsCount: cats.size, aliases: aliasList };
    }).filter(r => r.sport.name.toLowerCase().includes(filter.toLowerCase()) || r.sport.slug.includes(filter.toLowerCase()));
  }, [eventSports, sportEvents, catalog, filter]);

  // Aliases que apontam para slugs INEXISTENTES em sports global
  const orphanAliases = useMemo(() => {
    if (!catalog) return [];
    return Object.entries(catalog.sport_aliases)
      .filter(([slug]) => !sportSlugSet.has(slug))
      .map(([slug, aliases]) => ({ slug, aliases }));
  }, [catalog, sportSlugSet]);

  // Modalidades do evento SEM alias (podem falhar se planilha vier com nome diferente)
  const sportsWithoutAlias = useMemo(() => {
    if (!catalog) return [];
    return eventSports.filter(s => !catalog.sport_aliases[s.slug] || catalog.sport_aliases[s.slug].length === 0);
  }, [catalog, eventSports]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!catalog) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Catálogo de Importação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Regras embutidas no importador SIGECOM × modalidades reais do evento <strong>{activeEvent?.name}</strong>.
            Use esta tela para auditar o que está mapeado e o que pode falhar na importação.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" /> Recarregar
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{eventSports.length}</div><p className="text-xs text-muted-foreground">Modalidades no evento</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{sportEvents.length}</div><p className="text-xs text-muted-foreground">Provas (sport_events)</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{categories.length}</div><p className="text-xs text-muted-foreground">Categorias</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-amber-600">{sportsWithoutAlias.length}</div><p className="text-xs text-muted-foreground">Modalidades sem alias</p></CardContent></Card>
      </div>

      {sportsWithoutAlias.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Modalidades do evento sem alias no importador</AlertTitle>
          <AlertDescription>
            As seguintes modalidades existem no seu evento mas não têm alias mapeado. Se a planilha vier com qualquer variação de nome (acento, abreviação), a importação pode falhar:{" "}
            <strong>{sportsWithoutAlias.map(s => s.name).join(", ")}</strong>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="cobertura">
        <TabsList>
          <TabsTrigger value="cobertura">Cobertura do Evento</TabsTrigger>
          <TabsTrigger value="aliases">Aliases ({Object.keys(catalog.sport_aliases).length})</TabsTrigger>
          <TabsTrigger value="categorias">Categorias / Faixas</TabsTrigger>
          <TabsTrigger value="regras">Outras Regras</TabsTrigger>
        </TabsList>

        <TabsContent value="cobertura" className="space-y-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input placeholder="Filtrar modalidade..." value={filter} onChange={e => setFilter(e.target.value)} className="pl-9" />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Modalidades do Evento × Mapeamento do Importador</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sportCoverage.map(({ sport, provasCount, catsCount, aliases }) => {
                  const inWhitelist = catalog.single_category_fallback_whitelist.includes(sport.slug);
                  const hasAlias = aliases.length > 0;
                  return (
                    <div key={sport.id} className="flex items-center justify-between gap-4 p-3 border rounded-md">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{sport.name}</span>
                          <code className="text-xs text-muted-foreground">{sport.slug}</code>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {provasCount} provas · {catsCount} categorias
                          {aliases.length > 0 && <> · aliases: <em>{aliases.join(", ")}</em></>}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {hasAlias ? <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Alias</Badge>
                                  : <Badge variant="destructive">Sem alias</Badge>}
                        {inWhitelist && <Badge variant="secondary">Fallback 1-cat</Badge>}
                        {provasCount === 0 && <Badge variant="outline" className="text-amber-600">Sem provas</Badge>}
                      </div>
                    </div>
                  );
                })}
                {sportCoverage.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma modalidade encontrada.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aliases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aliases de modalidade (texto da planilha → slug canônico)</CardTitle>
              <CardDescription>O importador reconhece estes textos brutos vindos do SIGECOM. Aliases marcados em vermelho apontam para slugs que NÃO existem na tabela global de modalidades.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {Object.entries(catalog.sport_aliases).sort().map(([slug, aliases]) => {
                    const exists = sportSlugSet.has(slug);
                    return (
                      <div key={slug} className="p-3 border rounded-md">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-sm font-semibold">{slug}</code>
                          {exists ? <Badge variant="default" className="bg-green-600 text-xs">existe</Badge>
                                  : <Badge variant="destructive" className="text-xs">não cadastrado</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{aliases.join(" · ")}</div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              {orphanAliases.length > 0 && (
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {orphanAliases.length} aliases apontam para slugs sem modalidade cadastrada (planilhas que usem esses nomes vão pendenciar).
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categorias" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mapeamento Faixa Etária → Categoria</CardTitle>
              <CardDescription>Regras usadas quando a planilha traz a idade no texto (ex.: "15-17 ANOS").</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground border-b"><th className="py-2">Padrão Modalidade</th><th>Faixa</th><th>Categoria</th><th>Existe?</th></tr></thead>
                <tbody>
                  {catalog.age_band_to_category.map((rule, i) => {
                    const exists = categories.some(c => c.slug === rule.categorySlug);
                    return (
                      <tr key={i} className="border-b">
                        <td className="py-2"><code className="text-xs">{rule.sportPattern}</code></td>
                        <td><Badge variant="outline">{rule.ageBand}</Badge></td>
                        <td><code className="text-xs">{rule.categorySlug}</code></td>
                        <td>{exists ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Badge variant="destructive" className="text-xs">não</Badge>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Whitelist de Fallback (1 categoria)</CardTitle>
              <CardDescription>Quando a planilha não traz idade, o importador assume a única categoria do catálogo APENAS para estas modalidades.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {catalog.single_category_fallback_whitelist.map(slug => (
                  <Badge key={slug} variant={sportSlugSet.has(slug) ? "default" : "outline"}>{slug}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regras" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Status de Inscrição Aceitos</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {catalog.accepted_status.map(s => <Badge key={s} variant="default" className="bg-green-600">{s}</Badge>)}
              <p className="text-xs text-muted-foreground w-full mt-2">Comparação é case-insensitive e ignora acentos. Outros status são ignorados (não importados).</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Tipos de Participante</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground border-b"><th className="py-2">Texto da planilha</th><th>Tipo interno</th></tr></thead>
                <tbody>
                  {Object.entries(catalog.accepted_participant_types).map(([label, type]) => (
                    <tr key={label} className="border-b"><td className="py-2">{label}</td><td><code className="text-xs">{type}</code></td></tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Faixa de Data de Nascimento Aceita</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm">De <strong>{catalog.accepted_birth_year_range.min}</strong> até <strong>{catalog.accepted_birth_year_range.max}</strong> (faixa dinâmica até o ano corrente).</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Notas operacionais</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2 list-disc pl-5">
                {catalog.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
