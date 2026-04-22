import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Trophy, CheckCircle2, TrendingUp, CalendarDays,
  ClipboardList, AlertTriangle, Swords, UserCheck, Users,
  BarChart3, Loader2, Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AppKPI } from "@/components/app/AppKPI";
import { AppPageHeader } from "@/components/app/AppPageHeader";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { useUserSportLinks } from "@/hooks/useUserSportLinks";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CoordenadorModalidadeDashboard() {
  const { profile, roles } = useAuth();
  const eventId = useActiveEventId();
  const { activeEvent } = useEventContext();
  const { sportIds, isLoading: loadingLinks } = useUserSportLinks();

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

  // Fetch KPIs filtered by sports
  const { data: compData = { matches: 0, results: 0, validated: 0, published: 0 }, isLoading: loadingKPIs } = useQuery({
    queryKey: ["coord-dash-competition", eventId, sportIds],
    queryFn: async () => {
      if (!eventId || !sportIds || sportIds.length === 0) return { matches: 0, results: 0, validated: 0, published: 0 };
      
      // First get sport_events for these sports
      const { data: sportEvents } = await supabase
        .from("sport_events")
        .select("id")
        .eq("event_id", eventId)
        .in("sport_id", sportIds);
      
      const sportEventIds = (sportEvents ?? []).map(se => se.id);
      if (sportEventIds.length === 0) return { matches: 0, results: 0, validated: 0, published: 0 };

      const { count: matches } = await supabase
        .from("competition_matches")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .in("sport_event_id", sportEventIds);

      const { data: matchIds } = await supabase
        .from("competition_matches")
        .select("id")
        .eq("event_id", eventId)
        .in("sport_event_id", sportEventIds);
      
      if (!matchIds?.length) return { matches: matches ?? 0, results: 0, validated: 0, published: 0 };
      const ids = matchIds.map(m => m.id);

      const { count: results } = await supabase
        .from("competition_match_results")
        .select("id", { count: "exact", head: true })
        .in("match_id", ids);

      const { count: validated } = await supabase
        .from("competition_match_results")
        .select("id", { count: "exact", head: true })
        .in("match_id", ids)
        .not("validated_at", "is", null);

      const { count: published } = await supabase
        .from("competition_match_results")
        .select("id", { count: "exact", head: true })
        .in("match_id", ids)
        .eq("result_status", "publicado");

      return {
        matches: matches ?? 0,
        results: results ?? 0,
        validated: validated ?? 0,
        published: published ?? 0
      };
    },
    enabled: !!eventId && !!sportIds && sportIds.length > 0,
  });

  const isLoading = loadingLinks || loadingSports || loadingKPIs;

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

      {/* Info Alert */}
      <Alert className="bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/20">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 dark:text-blue-400">
          Você está visualizando apenas os dados das modalidades que coordena. Todas as ferramentas abaixo estão pré-filtradas para sua atuação.
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
            to="/admin/competicao/partidas-agenda"
            color="bg-amber-500"
          />
          <QuickActionCard
            title="Lançar Resultados"
            description="Registrar placares e súmulas das partidas"
            icon={<ClipboardList className="h-6 w-6" />}
            to="/admin/competicao/resultados"
            color="bg-emerald-500"
          />
          <QuickActionCard
            title="Relatórios"
            description="Boletins e documentos da modalidade"
            icon={<BarChart3 className="h-6 w-6" />}
            to="/admin/relatorios"
            color="bg-blue-500"
          />
          <QuickActionCard
            title="Inscritos"
            description="Lista de atletas e equipes confirmados"
            icon={<Users className="h-6 w-6" />}
            to="/admin/participantes"
            color="bg-purple-500"
          />
        </div>
      </div>

      {/* KPIs Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5" /> Estatísticas da Modalidade
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
            <CardDescription>Status geral das partidas agendadas</CardDescription>
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
                <Link to="/admin/relatorios/boletins">
                  <ClipboardList className="mr-2 h-4 w-4 text-muted-foreground" />
                  Visualizar Boletins Publicados
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start text-xs h-9" asChild>
                <Link to="/admin/competicao/painel">
                  <Trophy className="mr-2 h-4 w-4 text-muted-foreground" />
                  Painel Geral de Resultados
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickActionCard({ title, description, icon, to, color }: { title: string; description: string; icon: React.ReactNode; to: string; color: string }) {
  return (
    <Link to={to} className="group">
      <Card className="h-full border border-border/50 transition-all duration-200 hover:shadow-app-md hover:border-primary/20 active:scale-[0.98]">
        <CardContent className="p-5 flex flex-col gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color} text-white shadow-sm group-hover:scale-110 transition-transform`}>
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
