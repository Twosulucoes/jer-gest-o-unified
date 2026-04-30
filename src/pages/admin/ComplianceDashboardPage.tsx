import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { 
  ShieldCheck, AlertTriangle, FileCheck, Gavel, 
  Search, Filter, ChevronRight, Activity,
  Clock, CheckCircle2, XCircle, Info, Trophy, Plus, BadgeCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ComplianceDashboardPage() {
  const selectedEventId = useActiveEventId();

  // 1. Evidence Stats
  const { data: evidenceStats, isLoading: loadingEvidence } = useQuery({
    queryKey: ["compliance-evidence-stats", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return null;
      const { data, error } = await supabase
        .from("operational_evidence")
        .select("status, module")
        .eq("event_id", selectedEventId);
      
      if (error) throw error;
      
      const total = data.length;
      const approved = data.filter(e => e.status === 'approved').length;
      const pending = data.filter(e => e.status === 'pending').length;
      const rejected = data.filter(e => e.status === 'rejected').length;
      
      const byModule = data.reduce((acc: any, curr) => {
        acc[curr.module] = (acc[curr.module] || 0) + 1;
        return acc;
      }, {});

      return { total, approved, pending, rejected, byModule };
    },
    enabled: !!selectedEventId,
  });

  // 2. Irregularities
  const { data: irregularities, isLoading: loadingIrregularities } = useQuery({
    queryKey: ["compliance-irregularities", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("participation_irregularities")
        .select("*")
        .eq("event_id", selectedEventId)
        .neq("status", "resolved");
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  // 3. Protests
  const { data: protests, isLoading: loadingProtests } = useQuery({
    queryKey: ["compliance-protests", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("protests")
        .select("*")
        .eq("event_id", selectedEventId)
        .eq("status", "pending");
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  // 4. Missing Evidence (Heuristic: Matches without any evidence)
  const { data: missingEvidence, isLoading: loadingMissing } = useQuery({
    queryKey: ["compliance-missing-evidence", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      
      // Get all matches
      const { data: matches, error: mError } = await supabase
        .from("competition_matches")
        .select("id, match_number, sport_events(sports(name))")
        .eq("event_id", selectedEventId)
        .not("status", "eq", "scheduled"); // Only finished or ongoing matches
      
      if (mError) throw mError;

      // Get matches with evidence
      const { data: evMatches, error: eError } = await supabase
        .from("operational_evidence")
        .select("match_id")
        .eq("event_id", selectedEventId)
        .not("match_id", "is", null);
      
      if (eError) throw eError;
      
      const matchIdsWithEvidence = new Set(evMatches.map(e => e.match_id));
      return matches.filter(m => !matchIdsWithEvidence.has(m.id));
    },
    enabled: !!selectedEventId,
  });

  const isLoading = loadingEvidence || loadingIrregularities || loadingProtests || loadingMissing;

  if (!selectedEventId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <ShieldCheck className="h-16 w-16 text-muted-foreground/20 mb-4" />
        <h2 className="text-xl font-semibold">Selecione um Evento</h2>
        <p className="text-muted-foreground max-w-sm mt-2">
          Selecione um evento no cabeçalho para visualizar o painel de conformidade.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel de Conformidade</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Visão geral de auditoria e prestação de contas (OSC)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/relatorios/osc">
              <FileCheck className="mr-2 h-4 w-4" /> Relatório Formal (OSC)
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/auditoria">
              <Clock className="mr-2 h-4 w-4" /> Logs do Sistema
            </Link>
          </Button>
          <Button asChild>
            <Link to="/admin/evidencias-osc">
              <Plus className="mr-2 h-4 w-4" /> Enviar Evidência
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evidências Aprovadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : evidenceStats?.approved || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              de {evidenceStats?.total || 0} total enviadas
            </p>
            <Progress 
              value={evidenceStats?.total ? (evidenceStats.approved / evidenceStats.total) * 100 : 0} 
              className="h-1.5 mt-3" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Irregularidades Ativas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : irregularities.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Problemas de participação pendentes
            </p>
            <div className="mt-3">
              <Link to="/admin/irregularidades" className="text-xs text-primary hover:underline flex items-center gap-1">
                Ver detalhes <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Protestos Pendentes</CardTitle>
            <Gavel className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : protests.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Aguardando julgamento da CDE
            </p>
            <div className="mt-3">
              <Link to="/admin/protestos" className="text-xs text-primary hover:underline flex items-center gap-1">
                Acessar fila <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lapsos de Evidência</CardTitle>
            <Search className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : missingEvidence.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Partidas sem fotos/registros
            </p>
            <div className="mt-3">
              <Badge variant="outline" className="text-[10px] uppercase font-bold text-blue-600 border-blue-200 bg-blue-50">
                Crítico para OSC
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Missing Evidence List */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Partidas sem Evidência Operacional</CardTitle>
            <CardDescription>
              Lista de jogos realizados ou em andamento que ainda não possuem comprovação visual para prestação de contas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : missingEvidence.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed rounded-lg">
                <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
                <p className="text-sm font-medium">Tudo em conformidade!</p>
                <p className="text-xs text-muted-foreground">Todas as partidas possuem evidências vinculadas.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {missingEvidence.slice(0, 5).map((match: any) => (
                  <div key={match.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Trophy className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Jogo {match.match_number} - {match.sport_events?.sports?.name}</p>
                        <p className="text-xs text-muted-foreground">Falta evidência de abertura/andamento/pódio</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={`/admin/evidencias-osc?match=${match.id}`}>
                        <Plus className="h-4 w-4 mr-1" /> Vincular
                      </Link>
                    </Button>
                  </div>
                ))}
                {missingEvidence.length > 5 && (
                  <Button variant="link" className="w-full text-xs" asChild>
                    <Link to="/admin/evidencias-osc">Ver todas as {missingEvidence.length} partidas pendentes</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Scorecard */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Saúde da Auditoria</CardTitle>
            <CardDescription>KPIs de integridade dos dados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Activity className="h-4 w-4" /> Integridade Operacional
                </span>
                <span className="font-bold">85%</span>
              </div>
              <Progress value={85} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <BadgeCheck className="h-4 w-4" /> Cobertura de Evidências
                </span>
                <span className="font-bold">
                  {isLoading ? "..." : Math.round((1 - (missingEvidence.length / (missingEvidence.length + (evidenceStats?.total || 1)))) * 100)}%
                </span>
              </div>
              <Progress 
                value={isLoading ? 0 : Math.round((1 - (missingEvidence.length / (missingEvidence.length + (evidenceStats?.total || 1)))) * 100)} 
                className={`h-2 ${missingEvidence.length > 10 ? "[&>div]:bg-red-500" : ""}`}
              />
            </div>

            <Separator />

            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Alertas de Atenção</h4>
              <div className="flex gap-3">
                <div className="h-10 w-10 shrink-0 rounded bg-red-100 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Rejeições Críticas</p>
                  <p className="text-xs text-muted-foreground">
                    {evidenceStats?.rejected || 0} evidências foram rejeitadas na revisão e precisam de substituição imediata.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-10 w-10 shrink-0 rounded bg-amber-100 flex items-center justify-center">
                  <Info className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Prazos de OSC</p>
                  <p className="text-xs text-muted-foreground">
                    O prazo para fechamento do relatório consolidado da Etapa 2 expira em 5 dias.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
