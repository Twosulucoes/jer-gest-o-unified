import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import {
  Trophy, CheckCircle2, TrendingUp, CalendarDays,
  ClipboardList, AlertTriangle, Swords, UserCheck, Users,
  BarChart3, Loader2, Info, ShieldCheck, Lock, Eye, Filter
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AppKPI } from "@/components/app/AppKPI";
import { AppPageHeader } from "@/components/app/AppPageHeader";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { useUserSportLinks } from "@/hooks/useUserSportLinks";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CoordenadorModalidadeDashboard() {
  const { profile } = useAuth();
  const eventId = useActiveEventId();
  const { activeEvent } = useEventContext();
  const { sportIds, isLoading: loadingLinks } = useUserSportLinks();
  const [selectedStageId, setSelectedStageId] = useState<string>("");

  // Fetch event stages
  const { data: stages = [], isLoading: loadingStages } = useQuery({
    queryKey: ["event-stages", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("event_stages")
        .select("id, name")
        .eq("event_id", eventId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // Automatically select the first stage if none selected
  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) {
      setSelectedStageId(stages[0].id);
    }
  }, [stages, selectedStageId]);

  // Fetch sport names for the linked sports
  const { data: sports = [], isLoading: loadingSports } = useQuery({
    queryKey: ["my-sports-info", sportIds],
    queryFn: async () => {
      if (!sportIds || sportIds.length === 0) return [];
      const { data, error } = await supabase
        .from("sports")
        .select("id, name")
        .in("id", sportIds);
      if (error) throw error;
      return data;
    },
    enabled: !!sportIds && sportIds.length > 0,
  });

  // Fetch match IDs for the selected stage
  const { data: stageMatchIds = [], isLoading: loadingStageMatches } = useQuery({
    queryKey: ["stage-match-ids", selectedStageId],
    queryFn: async () => {
      if (!selectedStageId) return [];
      
      const { data: pses } = await supabase
        .from("participant_sport_events")
        .select("id")
        .eq("event_stage_id", selectedStageId);
      
      const pseIds = (pses ?? []).map(p => p.id);
      if (pseIds.length === 0) return [];

      const { data: entries } = await supabase
        .from("competition_match_entries")
        .select("match_id")
        .in("participant_sport_event_id", pseIds);
      
      return Array.from(new Set((entries ?? []).map(e => e.match_id)));
    },
    enabled: !!selectedStageId,
  });

  // Fetch KPIs filtered by sports AND stage
  const { data: compData = { matches: 0, results: 0, validated: 0, published: 0 }, isLoading: loadingKPIs } = useQuery({
    queryKey: ["coord-dash-competition", eventId, sportIds, selectedStageId, stageMatchIds.length],
    queryFn: async () => {
      if (!eventId || !sportIds || sportIds.length === 0 || !selectedStageId) return { matches: 0, results: 0, validated: 0, published: 0 };
      
      // First get sport_events for these sports
      const { data: sportEvents } = await supabase
        .from("sport_events")
        .select("id")
        .eq("event_id", eventId)
        .in("sport_id", sportIds);
      
      const sportEventIds = (sportEvents ?? []).map(se => se.id);
      if (sportEventIds.length === 0) return { matches: 0, results: 0, validated: 0, published: 0 };

      // Base query for matches in this event and sports
      let matchQuery = supabase
        .from("competition_matches")
        .select("id", { count: "exact" })
        .eq("event_id", eventId)
        .in("sport_event_id", sportEventIds);
      
      // Apply stage filter if match IDs are found
      if (stageMatchIds.length > 0) {
        matchQuery = matchQuery.in("id", stageMatchIds);
      } else {
        // If stage selected but no matches found for it, return zero
        return { matches: 0, results: 0, validated: 0, published: 0 };
      }

      const { data: matchesData, count: matchesCount } = await matchQuery;
      const filteredMatchIds = (matchesData ?? []).map(m => m.id);
      
      if (!filteredMatchIds.length) return { matches: 0, results: 0, validated: 0, published: 0 };

      const { count: results } = await supabase
        .from("competition_match_results")
        .select("id", { count: "exact", head: true })
        .in("match_id", filteredMatchIds);

      const { count: validated } = await supabase
        .from("competition_match_results")
        .select("id", { count: "exact", head: true })
        .in("match_id", filteredMatchIds)
        .not("validated_at", "is", null);

      const { count: published } = await supabase
        .from("competition_match_results")
        .select("id", { count: "exact", head: true })
        .in("match_id", filteredMatchIds)
        .eq("result_status", "publicado");

      return {
        matches: matchesCount ?? 0,
        results: results ?? 0,
        validated: validated ?? 0,
        published: published ?? 0
      };
    },
    enabled: !!eventId && !!sportIds && sportIds.length > 0 && !!selectedStageId,
  });

  const isLoading = loadingLinks || loadingSports || loadingKPIs || loadingStages || loadingStageMatches;

  if (sportIds && sportIds.length === 0 && !loadingLinks) {
    return (
      <div className="animate-fade-in space-y-6">
        <AppPageHeader title="Painel do Coordenador" description="Gestão de modalidades" />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sem modalidades vinculadas</AlertTitle>
          <AlertDescription>
            Você está logado como Coordenador de Modalidade, mas ainda não possui nenhuma modalidade atribuída ao seu perfil para este evento.
            Contate a Secretaria ou Coordenação Técnica para realizar o vínculo.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <AppPageHeader
        title="Painel do Coordenador"
        description={`Bem-vindo, ${profile?.full_name || "Coordenador"}`}
      >
        <div className="flex flex-wrap gap-2">
          {sports.map(s => (
            <Badge key={s.id} variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              {s.name}
            </Badge>
          ))}
          {activeEvent && (
            <Badge variant="outline" className="text-xs">
              {activeEvent.name}
            </Badge>
          )}
        </div>
      </AppPageHeader>

      {/* Stage Selection - Mandatory Filter */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2 text-primary font-semibold shrink-0">
              <Filter className="h-4 w-4" />
              <span className="text-sm">Etapa do Evento:</span>
            </div>
            <div className="flex-1 max-w-md">
              <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                <SelectTrigger className="bg-background border-primary/20">
                  <SelectValue placeholder="Selecione a etapa obrigatória..." />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!selectedStageId && !loadingStages && (
              <Badge variant="destructive" className="animate-pulse">
                Seleção Obrigatória
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedStageId ? (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Selecione uma etapa</AlertTitle>
          <AlertDescription className="text-amber-700 font-medium">
            Para gerenciar a agenda e lançar resultados, você deve primeiro selecionar a etapa do evento no filtro acima.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Info Alert */}
          <Alert className="bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/20">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 dark:text-blue-400">
              Você está visualizando apenas os dados da etapa selecionada e das modalidades que coordena.
            </AlertDescription>
          </Alert>

          {/* Quick Actions */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Ações de Gestão
            </h2>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <QuickActionCard
                title="Agenda de Jogos"
                description="Gerenciar horários e locais das partidas"
                icon={<CalendarDays className="h-6 w-6" />}
                to={`/admin/competicao/partidas-agenda?stage=${selectedStageId}`}
                color="bg-amber-500"
              />
              <QuickActionCard
                title="Lançar Resultados"
                description="Registrar placares e súmulas das partidas"
                icon={<ClipboardList className="h-6 w-6" />}
                to={`/admin/competicao/resultados?stage=${selectedStageId}`}
                color="bg-emerald-500"
              />
              <QuickActionCard
                title="Relatórios"
                description="Boletins e documentos da modalidade"
                icon={<BarChart3 className="h-6 w-6" />}
                to={`/admin/relatorios?stage=${selectedStageId}`}
                color="bg-blue-500"
              />
              <QuickActionCard
                title="Inscritos"
                description="Lista de atletas e equipes confirmados"
                icon={<Users className="h-6 w-6" />}
                to={`/admin/participantes?stage=${selectedStageId}`}
                color="bg-purple-500"
              />
            </div>
          </div>

          {/* KPIs Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5" /> Estatísticas da Modalidade (Etapa Atual)
              </h2>
            </div>
            
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <AppKPI label="Total de Partidas" value={compData.matches} icon={Swords} loading={isLoading} />
              <AppKPI label="Resultados Lançados" value={compData.results} icon={CheckCircle2} loading={isLoading} />
              <AppKPI 
                label="Validados" 
                value={compData.validated} 
                icon={UserCheck} 
                loading={isLoading}
                sub={compData.results > 0 ? `${Math.round((compData.validated / compData.results) * 100)}% concluído` : undefined}
              />
              <AppKPI
                label="Publicados" 
                value={compData.published} 
                icon={TrendingUp} 
                loading={isLoading}
                alert={compData.validated > compData.published}
              />
            </div>
          </section>

          {/* Status Overview Card */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-app-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Progresso da Competição</CardTitle>
                <CardDescription>Status geral das partidas na etapa selecionada</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Partidas com Resultado</span>
                        <span className="font-medium">{compData.results} / {compData.matches}</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-500" 
                          style={{ width: `${compData.matches > 0 ? (compData.results / compData.matches) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Resultados Validados</span>
                        <span className="font-medium">{compData.validated} / {compData.results}</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-500" 
                          style={{ width: `${compData.results > 0 ? (compData.validated / compData.results) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-app-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Acesso Rápido a Boletins</CardTitle>
                <CardDescription>Documentos oficiais publicados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start text-xs h-9" asChild>
                    <Link to={`/admin/relatorios/boletins?stage=${selectedStageId}`}>
                      <ClipboardList className="mr-2 h-4 w-4 text-muted-foreground" />
                      Visualizar Boletins Publicados
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-xs h-9" asChild>
                    <Link to={`/admin/competicao/painel?stage=${selectedStageId}`}>
                      <Trophy className="mr-2 h-4 w-4 text-muted-foreground" />
                      Painel Geral de Resultados
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
      
      {/* Access and Permissions Section */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm font-bold uppercase tracking-wider">
              Suas Permissões e Acessos
            </CardTitle>
          </div>
          <CardDescription>
            Confira as telas e ações liberadas exclusivamente para sua modalidade
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold flex items-center gap-1.5 text-foreground/80">
                <Eye className="h-3.5 w-3.5" /> Telas Acessíveis
              </h3>
              <ul className="text-xs space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  <span><strong>Gestão de Competição:</strong> Agenda de jogos e lançamento de resultados.</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  <span><strong>Participantes:</strong> Consulta de atletas e equipes vinculadas às suas modalidades.</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  <span><strong>Relatórios:</strong> Acesso aos boletins e quadro de medalhas oficial.</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  <span><strong>Suporte:</strong> Chat de ajuda e abertura de chamados técnicos.</span>
                </li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-xs font-semibold flex items-center gap-1.5 text-foreground/80">
                <Lock className="h-3.5 w-3.5" /> Restrição de Escopo
              </h3>
              <div className="rounded-lg border border-primary/10 bg-background/50 p-3 space-y-2">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Seu acesso é <strong>estritamente restrito</strong> às modalidades listadas no topo desta página.
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Você não possui permissão para visualizar dados de outras modalidades, gerenciar credenciamento global, alojamentos ou finanças do evento.
                </p>
                <div className="pt-1">
                  <Badge variant="outline" className="text-[10px] py-0 h-5 border-primary/20 text-primary">
                    Validação de Segurança Ativa
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickActionCard({ title, description, icon, to, color }: { title: string; description: string; icon: React.ReactNode; to: string; color: string }) {
  const colorMap: Record<string, string> = {
    "bg-amber-500": "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    "bg-emerald-500": "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    "bg-blue-500": "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    "bg-purple-500": "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  };
  const colorClass = colorMap[color] || "bg-primary/10 text-primary";

  return (
    <Link to={to} className="group">
      <Card className="h-full border border-border/50 transition-all duration-200 hover:shadow-app-md hover:border-primary/20 active:scale-[0.98]">
        <CardContent className="p-5 flex flex-col gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorClass} shadow-sm group-hover:scale-110 transition-transform`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

